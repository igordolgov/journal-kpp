// app/composables/useJournalPage.ts
// Назначение: Логика управления модальными окнами и действиями на странице журнала.
// Обрабатывает выход, возврат, редактирование и удаление записей.
// При любом изменении журнала вызывает integration.reloadJournal() для синхронизации с симулятором.
//
// [UI/UX Фаза 2 — аудит действий]:
//  1. [FIX] тосты + try/catch во ВСЕХ save-действиях (раньше ошибка БД
//     закрывала модалку молча — данные не сохранялись, пользователь не знал);
//  2. [FIX] защита от двойной фиксации: saving-флаги (двойной клик создавал
//     дублирующие записи выезда);
//  3. [UX] ConfirmDialog при удалении — предупреждает о попутчиках группы;
//
// [FIX] АВТОРСТВО ЗАПИСЕЙ: точки создания/редактирования не писали
// created_by/updated_by — мета-дропдаун «Создано/Автор» в JournalTable
// всегда был пустым. Теперь автор = дежурный текущей смены (useShift).
// Бонус-фикс: в ветке exit->addItem отсутствовал created_at — такие записи
// пропадали из группировки «По дням» (groupedRows отсекал записи без даты).

import { ref, computed, reactive, watch } from 'vue'
import { useState } from '#imports'
import { useDatabase } from './useDatabase'
import { useJournal } from './useJournal'
import { useFamily } from './useFamily'
import { useSimulatorIntegration } from './useSimulatorIntegration'
import { useConfirm } from './useConfirm'
import { useToast } from './useToast'
import { useShift } from './useShift'

const STORAGE_KEY_WIDTHS = 'journal-column-widths'

export const useJournalPage = () => {
  const { getAllItems, updateItem, addItem, deleteItem, getItem } = useDatabase()
  const { processedJournal, loadData: loadJournalData, getCompanions } = useJournal()
  const { getFullFamily } = useFamily()
  const integration = useSimulatorIntegration()
  const { confirmDialog } = useConfirm()
  const toast = useToast()
  const { currentShift } = useShift()

  /** Автор действия — дежурный текущей смены (null, если смена не принята) */
  const currentAuthor = () => currentShift.value?.guard_name || null

  // --- Состояния модальных окон ---
  const isExitModalOpen = ref(false)
  const isReturnModalOpen = ref(false)
  const isEditJournalOpen = ref(false)
  const isPersonDetailOpen = ref(false)

  // --- [FIX] флаги сохранения — защита от двойной фиксации ---
  const isSavingExit = ref(false)
  const isSavingReturn = ref(false)
  const isSavingEdit = ref(false)

  // --- Выбранная запись (общая через useState) ---
  // Тип: запись журнала или undefined. Используется в v-model:selectedItem для JournalSidebar.
  const selectedItem = useState<Record<string, any> | undefined>(
    'journal-selected-item',
    () => undefined
  )

  // --- Данные форм ---
  const exitForm = reactive({
    id: null as number | null,
    person_id: null as number | null,
    person_fio: '',       // [UX] ФИО — для шапки модалки выезда
    destination: '',
    vehicle_out: '',
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
    if (import.meta.client) {
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
    if (import.meta.client) {
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
   * [UX] попутчики помечаются isChild — для подсветки в модалке.
   */
  const openExitModal = (entry: any) => {
    if (!entry) return

    exitForm.id = entry.id
    exitForm.person_id = entry.person_id
    exitForm.person_fio = entry.person_fio || ''   // [UX] для шапки модалки
    exitForm.vehicle_out = entry.vehicle_in || '🚶 Пеш.'
    exitForm.destination = entry.destination || ''
    exitForm.selectedGroupIds = []

    const activeEntries = processedJournal.value.filter((row: any) =>
      row.timestamp_in && !row.timestamp_out && row.id !== entry.id
    )

    // [UX] попутчики: помечаем детей — чтобы охранник видел, кого отмечает
    exitForm.groupCandidates = activeEntries.map((row: any) => {
      const person = peopleList.value.find((p: any) => String(p.id) === String(row.person_id))
      const isChild = person?.category === 'Ребенок' || person?.is_child === true || String(person?.fio).startsWith('+')
      return { id: row.id, fio: row.person_fio, isChild }
    })

    isExitModalOpen.value = true
  }

  /**
   * Сохраняет выход путём создания НОВОЙ записи.
   * Не изменяет существующую запись входа.
   * [FIX] try/catch + тост + saving-флаг (защита от двойной фиксации).
   * [FIX] created_by/created_at пишутся во все создаваемые записи.
   */
  const handleSaveExit = async () => {
    if (!exitForm.person_id) return
    if (isSavingExit.value) return   // [FIX] двойной клик
    isSavingExit.value = true

    try {
      const timestamp = Date.now()
      const author = currentAuthor()

      const saveOneExit = async (personId: number, vehiclePlate: string, destination: string) => {
        // 1. Ищем активную запись ВХОДА (есть timestamp_in, нет timestamp_out)
        const activeEntry = processedJournal.value.find(
          (e: any) => String(e.person_id) === String(personId) && e.timestamp_in && !e.timestamp_out
        )
        if (activeEntry) {
          // Закрываем её – добавляем timestamp_out и транспорт выезда
          await updateItem('journal', {
            id: activeEntry.id,
            timestamp_out: timestamp,
            vehicle_out: vehiclePlate,
            destination: destination || activeEntry.destination,
            created_by: activeEntry.created_by || author,   // [FIX] если вход создан без автора — дописываем
          })
        } else {
          // Нет активного входа – создаём запись только с выходом
          await addItem('journal', {
            person_id: personId,
            timestamp_out: timestamp,
            vehicle_out: vehiclePlate,
            destination: destination || '',
            created_by: author,      // [FIX] автор
            created_at: timestamp,   // [FIX] дата (для группировки «По дням»)
          })
        }
      }

      // Сохраняем выход для основного человека
      await saveOneExit(exitForm.person_id, exitForm.vehicle_out || '🚶 Пеш.', exitForm.destination || '')

      // Сохраняем выход для попутчиков
      for (const companionJournalId of exitForm.selectedGroupIds) {
        const companionEntry = processedJournal.value.find((e: any) => e.id === companionJournalId)
        if (companionEntry) {
          await saveOneExit(companionEntry.person_id, exitForm.vehicle_out || '🚶 Пеш.', exitForm.destination || '')
        }
      }

      isExitModalOpen.value = false
      // [UX] сводка: кто и сколько
      const groupCount = exitForm.selectedGroupIds.length
      toast.success(exitForm.person_fio
        ? `Выезд зафиксирован: ${exitForm.person_fio}${groupCount ? ` + ${groupCount} попутчик(ов)` : ''}`
        : 'Выезд зафиксирован')
      await loadJournalData()
      await integration.reloadJournal()
    } catch (e: any) {
      console.error('[useJournalPage] Save exit error:', e)
      // [UX] ошибка БД — модалка ОСТАЁТСЯ открытой, данные формы целы
      toast.error('Не удалось зафиксировать выезд: ' + (e?.message || 'ошибка базы'))
    } finally {
      isSavingExit.value = false
    }
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
   * [FIX] try/catch + тост + saving-флаг; updated_by/updated_at.
   */
  const handleSaveReturn = async () => {
    if (!returnForm.id) return
    if (isSavingReturn.value) return   // [FIX] двойной клик
    isSavingReturn.value = true

    try {
      const timestamp = Date.now()
      const vehicle = returnForm.vehicle_in || '🚶 Пеш.'
      const author = currentAuthor()

      await updateItem('journal', {
        id: returnForm.id,
        timestamp_in: timestamp,
        vehicle_in: vehicle,
        note: returnForm.note,
        updated_by: author,    // [FIX] редактор
        updated_at: timestamp, // [FIX] время правки
      })

      for (const companionJournalId of returnForm.selectedGroupIds) {
        await updateItem('journal', {
          id: companionJournalId,
          timestamp_in: timestamp,
          vehicle_in: vehicle,
          updated_by: author,    // [FIX]
          updated_at: timestamp, // [FIX]
        })
      }

      isReturnModalOpen.value = false
      const groupCount = returnForm.selectedGroupIds.length
      toast.success(returnForm.person_fio
        ? `Возврат зафиксирован: ${returnForm.person_fio}${groupCount ? ` + ${groupCount} попутчик(ов)` : ''}`
        : 'Возврат зафиксирован')
      await loadJournalData()
      await integration.reloadJournal()
    } catch (e: any) {
      console.error('[useJournalPage] Save return error:', e)
      toast.error('Не удалось зафиксировать возврат: ' + (e?.message || 'ошибка базы'))
    } finally {
      isSavingReturn.value = false
    }
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
   * [FIX] try/catch + тост + saving-флаг + updated_by/updated_at.
   */
  const handleSaveEdit = async () => {
    if (!editForm.id) return
    if (isSavingEdit.value) return
    isSavingEdit.value = true

    try {
      await updateItem('journal', {
        id: editForm.id,
        destination: editForm.destination,
        note: editForm.note,
        updated_by: currentAuthor(),  // [FIX] редактор
        updated_at: Date.now(),       // [FIX] время правки
      })
      isEditJournalOpen.value = false
      toast.success('Запись обновлена')
      await loadJournalData()
      await integration.reloadJournal()
    } catch (e: any) {
      console.error('[useJournalPage] Save edit error:', e)
      toast.error('Не удалось обновить запись: ' + (e?.message || 'ошибка базы'))
    } finally {
      isSavingEdit.value = false
    }
  }

  /**
   * Удаляет запись.
   * [UX] ConfirmDialog: при активном выезде с группой — предупреждает о попутчиках.
   */
  const handleDeleteEntry = async () => {
    if (!editForm.id) return

    // Если запись — чей-то активный выезд, ищем попутчиков той же поездки
    const entry = processedJournal.value.find((e: any) => e.id === editForm.id)
    const hasActiveGroup = entry?.timestamp_out && !entry.timestamp_in &&
      processedJournal.value.some((e: any) =>
        e.id !== editForm.id && e.timestamp_out && !e.timestamp_in &&
        Math.abs(new Date(e.timestamp_out).getTime() - new Date(entry.timestamp_out).getTime()) < 60000
      )

    const ok = await confirmDialog({
      title: 'Удалить запись журнала?',
      message: hasActiveGroup
        ? 'Это активный выезд с попутчиками. Будет удалена только эта запись — попутчики останутся «снаружи».'
        : 'Запись о въезде/выезде будет удалена безвозвратно. Статус человека пересчитается.',
      confirmLabel: 'Удалить',
      danger: true
    })
    if (!ok) return

    try {
      await deleteItem('journal', editForm.id)
      isEditJournalOpen.value = false
      toast.success('Запись удалена')
      await loadJournalData()
      await integration.reloadJournal()
    } catch (e: any) {
      console.error('[useJournalPage] Delete error:', e)
      toast.error('Не удалось удалить запись')
    }
  }

    /**
   * Открывает карточку человека.
   * [FIX Фаза 3] перечитываем запись из БД: раньше брали из кэша peopleList,
   * и свежесохранённые поля (position/department) не показывались до F5.
   */
  const openPersonCard = async (personId: number) => {
    if (!personId) return
    try {
      // Свежая копия из БД — источник истины
      const fresh = await getItem('people', personId)
      const person = fresh || peopleList.value.find(p => p.id === personId)
      if (person) {
        // Обновляем кэш, чтобы следующие открытия не мерцали старым
        const idx = peopleList.value.findIndex(p => p.id === personId)
        if (idx !== -1 && fresh) peopleList.value[idx] = fresh
        detailPerson.value = person
        isPersonDetailOpen.value = true
      }
    } catch (e) {
      console.error('[useJournalPage] openPersonCard error:', e)
      // Фолбэк на кэш, если БД недоступна
      const person = peopleList.value.find(p => p.id === personId)
      if (person) {
        detailPerson.value = person
        isPersonDetailOpen.value = true
      }
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
   * [FIX] тосты результата; created_by/created_at/updated_by — во все записи;
   * [FIX] потерянный else между ветками exit/enter.
   */
  const handleGroupAction = async (payload: any) => {
    const { mainPerson, passengers, vehicle, actionKey, destination, note } = payload

    if (!mainPerson || !mainPerson.id) return

    const everyone = [mainPerson, ...(passengers || [])]
    const timestamp = Date.now()
    const vehiclePlate = vehicle?.plate || ''
    const author = currentAuthor()

    try {
      if (actionKey === 'exit') {
        for (const person of everyone) {
          const existingExit = processedJournal.value.find((e: any) =>
            String(e.person_id) === String(person.id) && e.timestamp_out && !e.timestamp_in
          )
          if (existingExit) {
            await updateItem('journal', {
              id: existingExit.id,
              vehicle_out: vehiclePlate,
              destination: destination || existingExit.destination,
              created_by: existingExit.created_by || author,   // [FIX] автор выхода
            })
          } else {
            const newEntry = {
              person_id: person.id,
              timestamp_out: timestamp,
              vehicle_out: vehiclePlate,
              destination: destination || '',
              note: note || '',
              created_by: author,    // [FIX] автор
              created_at: timestamp, // [FIX] дата (группировка «По дням»)
            }
            await addItem('journal', newEntry)
          }
        }
      } else if (actionKey === 'enter') {
        // [FIX] был потерян else — ветки выполнялись независимо
        for (const person of everyone) {
          const activeEntry = processedJournal.value.find((e: any) =>
            String(e.person_id) === String(person.id) && e.timestamp_out && !e.timestamp_in
          )
          if (activeEntry) {
            await updateItem('journal', {
              id: activeEntry.id,
              timestamp_in: timestamp,
              vehicle_in: vehiclePlate,
              note: note || activeEntry.note,
              updated_by: author,    // [FIX] редактор
              updated_at: timestamp, // [FIX]
            })
          } else {
            await addItem('journal', {
              person_id: person.id,
              timestamp_in: timestamp,
              vehicle_in: vehiclePlate,
              destination: destination || '',
              note: note || '',
              created_by: author,    // [FIX] автор
              created_at: timestamp, // [FIX]
            })
          }
        }
      }
      // [UX] тост результата группы
      const n = everyone.length
      const who = n === 1 ? (mainPerson.fio_short || mainPerson.fio || 'человек') : `${n} чел.`
      toast.success(actionKey === 'exit'
        ? `Выезд: ${who}${vehiclePlate ? ` (${vehiclePlate})` : ''}`
        : `Въезд: ${who}${vehiclePlate ? ` (${vehiclePlate})` : ''}`)
    } catch (e) {
      console.error('[useJournalPage] Ошибка сохранения группы', e)
      toast.error('Ошибка сохранения поездки')
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
    suggestedVehicles: computed(() => []), // [ТЕХДОЛГ] заглушка — потребитель index.vue
    availableVehicles,
    isWalkingSelected,
    isSavingExit,        // [ДОБАВЛЕНО] защита от двойной фиксации
    isSavingReturn,      // [ДОБАВЛЕНО]
    isSavingEdit,        // [ДОБАВЛЕНО]
    selectedItem,
    columnWidths,

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