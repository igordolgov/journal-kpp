// app/composables/useJournalPage.ts
// Назначение: Логика управления модальными окнами и действиями на странице журнала.
// Обрабатывает выход, возврат, редактирование и удаление записей.
// При любом изменении журнала вызывает integration.reloadJournal() для синхронизации с симулятором.

import { ref, computed, reactive, watch } from 'vue'
import { useDatabase } from './useDatabase'
import { useJournal } from './useJournal'
import { useFamily } from './useFamily'
import { useSimulatorIntegration } from './useSimulatorIntegration' // <-- добавлен импорт

const STORAGE_KEY_WIDTHS = 'journal-column-widths'

export const useJournalPage = () => {
  const { getAllItems, updateItem, addItem, deleteItem } = useDatabase()
  const { processedJournal, loadData: loadJournalData, getCompanions } = useJournal()
  const { getFullFamily } = useFamily()
  const integration = useSimulatorIntegration() // <-- единый экземпляр интеграции

  // --- Состояния модальных окон ---
  const isExitModalOpen = ref(false)
  const isReturnModalOpen = ref(false)
  const isEditJournalOpen = ref(false)
  const isPersonDetailOpen = ref(false)

  // --- Данные форм ---
  const exitForm = reactive({
    id: null as number | null,
    person_id: null as number | null,  // <-- добавлено для создания новой записи
    destination: '',
    vehicle_out: '',                   // <-- добавлено: транспорт, на котором выходит
    groupCandidates: [] as any[],
    selectedGroupIds: [] as number[]
  })

  const returnForm = reactive({
    id: null as number | null,
    person_id: null as number | null,
    person_fio: '',
    vehicle_out: '',
    vehicle_in: '',
    note: '',
    groupCandidates: [] as any[],
    selectedGroupIds: [] as number[]
  })

  const editForm = reactive({
    id: null as number | null,
    destination: '',
    note: ''
  })

  const detailPerson = ref<any>(null)

  // --- Данные ---
  const vehiclesList = ref<any[]>([])
  const peopleList = ref<any[]>([])

  // --- Ширина колонок (с сохранением) ---
  const defaultWidths = {
    fio: 200,
    time_out: 120,
    time_in: 120,
    destination: 150,
    vehicle: 140,
    status: 100
  }

  const getSavedWidths = () => {
    if (process.client) {
      const saved = localStorage.getItem(STORAGE_KEY_WIDTHS)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Ошибка чтения ширины колонок', e)
        }
      }
    }
    return {}
  }

  const columnWidths = ref({
    ...defaultWidths,
    ...getSavedWidths()
  })

  watch(columnWidths, (newVal) => {
    if (process.client) {
      localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(newVal))
    }
  }, { deep: true })

  /**
   * Вычисляет список транспорта для модалки возврата.
   */
  const availableVehicles = computed(() => {
    if (!returnForm.person_id) return []

    const list: any[] = []
    const addedPlates = new Set<string>()

    if (returnForm.vehicle_out && !returnForm.vehicle_out.includes('🚶')) {
      const vOut = returnForm.vehicle_out.trim()
      if (!addedPlates.has(vOut)) {
        list.push({
          id: 'exit_vehicle',
          plate: vOut,
          is_primary: true
        })
        addedPlates.add(vOut)
      }
    }

    const ownedVehicles = vehiclesList.value.filter(v => v.owner_id === returnForm.person_id)
    ownedVehicles.forEach(v => {
      const plate = v.plate?.trim()
      if (plate && !addedPlates.has(plate)) {
        list.push(v)
        addedPlates.add(plate)
      }
    })

    return list
  })

  const isWalkingSelected = computed(() => {
    return returnForm.vehicle_in === '' || returnForm.vehicle_in === '🚶 Пеш.'
  })

  // --- Загрузка данных ---
  const loadVehicles = async () => {
    vehiclesList.value = await getAllItems('vehicles')
    peopleList.value = await getAllItems('people')
  }

  // --- Логика модалок ---

  /**
   * Открывает модалку выхода.
   * Запоминает person_id и транспорт, на котором человек въехал (если есть),
   * чтобы создать новую запись выхода с этими данными.
   */
  const openExitModal = (entry: any) => {
    if (!entry) return

    exitForm.id = entry.id                             // id текущей записи (не используется для создания новой)
    exitForm.person_id = entry.person_id               // сохраняем id человека
    exitForm.vehicle_out = entry.vehicle_in || '🚶 Пеш.' // транспорт, с которым выходит (по умолчанию тот же, что при входе)
    exitForm.destination = entry.destination || ''
    exitForm.selectedGroupIds = []

    const activeEntries = processedJournal.value.filter((row: any) =>
      row.timestamp_in && !row.timestamp_out && row.id !== entry.id
    )

    exitForm.groupCandidates = activeEntries.map((row: any) => ({
      id: row.id,
      fio: row.person_fio
    }))

    isExitModalOpen.value = true
  }

  /**
   * Сохраняет выход путём создания НОВОЙ записи.
   * Не изменяет существующую запись входа.
   */
  const handleSaveExit = async () => {
    if (!exitForm.person_id) return

    const timestamp = Date.now()
    // Создаём новую запись выхода
    await addItem('journal', {
      person_id: exitForm.person_id,
      timestamp_out: timestamp,
      vehicle_out: exitForm.vehicle_out || '🚶 Пеш.',
      destination: exitForm.destination || '',
      created_at: timestamp
    })

    // Обработка попутчиков (аналогично групповой логике)
    for (const companionJournalId of exitForm.selectedGroupIds) {
      const companionEntry = processedJournal.value.find((e: any) => e.id === companionJournalId)
      if (companionEntry) {
        await addItem('journal', {
          person_id: companionEntry.person_id,
          timestamp_out: timestamp,
          vehicle_out: exitForm.vehicle_out || '🚶 Пеш.',
          destination: exitForm.destination || '',
          created_at: timestamp
        })
      }
    }

    isExitModalOpen.value = false
    await loadJournalData()
    await integration.reloadJournal() // синхронизация с симулятором
  }

  /**
   * Открывает модалку возврата.
   */
  const openReturnModal = (entry: any) => {
    if (!entry) return

    returnForm.id = entry.id
    returnForm.person_id = entry.person_id
    returnForm.person_fio = entry.person_fio
    returnForm.vehicle_out = entry.vehicle_out || '🚶 Пеш.'
    returnForm.vehicle_in = entry.vehicle_out || ''
    returnForm.note = ''
    returnForm.selectedGroupIds = []

    const companionsRaw = getCompanions(entry.person_id)
    const mainPerson = peopleList.value.find((p: any) => String(p.id) === String(entry.person_id))

    let familyMap = new Map<string, string>()
    if (mainPerson) {
      const family = getFullFamily(mainPerson, peopleList.value)
      family.forEach((f: any) => {
        familyMap.set(String(f.id), f.relation || 'Родств.')
      })
    }

    returnForm.groupCandidates = companionsRaw.map((c: any) => {
      const person = peopleList.value.find((p: any) => String(p.id) === String(c.person_id))
      const isChild = person?.category === 'Ребенок' || person?.is_child === true || String(person?.fio).startsWith('+')
      const relation = familyMap.get(String(c.person_id)) || ''
      return { ...c, isChild, relation }
    })

    isReturnModalOpen.value = true
  }

  /**
   * Сохраняет возврат путём обновления существующей записи выхода.
   */
  const handleSaveReturn = async () => {
    if (!returnForm.id) return

    const timestamp = Date.now()
    const vehicle = returnForm.vehicle_in || '🚶 Пеш.'

    await updateItem('journal', {
      id: returnForm.id,
      timestamp_in: timestamp,
      vehicle_in: vehicle,
      note: returnForm.note
    })

    for (const companionJournalId of returnForm.selectedGroupIds) {
      await updateItem('journal', {
        id: companionJournalId,
        timestamp_in: timestamp,
        vehicle_in: vehicle
      })
    }

    isReturnModalOpen.value = false
    await loadJournalData()
    await integration.reloadJournal() // синхронизация
  }

  const selectAllReturnCandidates = () => {
    returnForm.selectedGroupIds = returnForm.groupCandidates.map(c => c.id)
  }

  const selectAllExitCandidates = () => {
    exitForm.selectedGroupIds = exitForm.groupCandidates.map(c => c.id)
  }

  /**
   * Открывает редактирование записи.
   */
  const openEditJournal = (entry: any) => {
    editForm.id = entry.id
    editForm.destination = entry.destination || ''
    editForm.note = entry.note || ''
    isEditJournalOpen.value = true
  }

  /**
   * Сохраняет изменения в записи.
   */
  const handleSaveEdit = async () => {
    if (!editForm.id) return
    await updateItem('journal', {
      id: editForm.id,
      destination: editForm.destination,
      note: editForm.note
    })
    isEditJournalOpen.value = false
    await loadJournalData()
    await integration.reloadJournal()
  }

  /**
   * Удаляет запись.
   */
  const handleDeleteEntry = async () => {
    if (!editForm.id || !confirm('Удалить запись?')) return
    await deleteItem('journal', editForm.id)
    isEditJournalOpen.value = false
    await loadJournalData()
    await integration.reloadJournal()
  }

  /**
   * Открывает карточку человека.
   */
  const openPersonCard = (personId: number) => {
    if (!personId) return
    const person = peopleList.value.find(p => p.id === personId)
    if (person) {
      detailPerson.value = person
      isPersonDetailOpen.value = true
    }
  }

  /**
   * Обработчик нажатия кнопки выхода в таблице.
   */
  const handleTableExit = (entry: any) => {
    openExitModal(entry)
  }

  /**
   * Групповое действие (универсальное для выхода/входа).
   */
  const handleGroupAction = async (payload: any) => {
    const { mainPerson, passengers, vehicle, actionKey, destination, note } = payload

    if (!mainPerson || !mainPerson.id) return

    const everyone = [mainPerson, ...(passengers || [])]
    const timestamp = Date.now()
    const vehiclePlate = vehicle?.plate || ''

    try {
      if (actionKey === 'exit') {
        // Для каждого создаём новую запись выхода
        for (const person of everyone) {
          const newEntry = {
            person_id: person.id,
            timestamp_out: timestamp,
            vehicle_out: vehiclePlate,
            destination: destination || '',
            note: note || ''
          }
          await addItem('journal', newEntry)
        }
      } else if (actionKey === 'enter') {
        // Для каждого пытаемся закрыть активную запись выхода
        for (const person of everyone) {
          const activeEntry = processedJournal.value.find((e: any) =>
            String(e.person_id) === String(person.id) && e.timestamp_out && !e.timestamp_in
          )
          if (activeEntry) {
            await updateItem('journal', {
              id: activeEntry.id,
              timestamp_in: timestamp,
              vehicle_in: vehiclePlate,
              note: note || activeEntry.note
            })
          }
        }
      }
    } catch (e) {
      console.error('[useJournalPage] Ошибка сохранения группы', e)
    } finally {
      await loadJournalData()
      await integration.reloadJournal()
    }
  }

  const handleSimpleAction = (payload: any) => {
    handleGroupAction({ ...payload, passengers: [], mainPerson: payload.person })
  }

  return {
    // State
    isExitModalOpen,
    isReturnModalOpen,
    isEditJournalOpen,
    isPersonDetailOpen,
    exitForm,
    returnForm,
    editForm,
    detailPerson,
    vehiclesList,
    suggestedVehicles: computed(() => []),
    availableVehicles,
    isWalkingSelected,
    selectedItem: ref(null),
    columnWidths,
    sortOrder: ref(-1),

    // Actions
    loadVehicles,
    openExitModal,
    handleSaveExit,
    openReturnModal,
    handleSaveReturn,
    selectAllReturnCandidates,
    selectAllExitCandidates,
    openEditJournal,
    handleSaveEdit,
    handleDeleteEntry,

    // Group Actions
    handleSimpleAction,
    handleGroupAction,

    handleTableExit,
    openPersonCard
  }
}