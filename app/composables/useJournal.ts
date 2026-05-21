// app/composables/useJournal.ts
import { useState, computed, ref } from '#imports'
import { useDatabase } from './useDatabase'

export const useJournal = () => {
  const { getAllItems, addItem, updateItem, deleteItem: dbDeleteItem } = useDatabase()
  
  const peopleList = useState<any[]>('journal-people', () => [])
  const journalList = useState<any[]>('journal-raw', () => [])

  /**
   * ИСПРАВЛЕНО: Статистика считается по активным записям журнала.
   */
  const stats = computed(() => {
    let residentsOut = 0
    let outsidersIn = 0

    // Проходим по всем записям журнала
    journalList.value.forEach((entry: any) => {
      // Находим человека, связанного с записью
      const person = peopleList.value.find((p: any) => String(p.id) === String(entry.person_id))
      if (!person) return

      // Определяем, является ли человек жителем или гостем по его базовому месту положению
      // Житель: location != 'вне территории' (или по вашей логике)
      const isResident = person.location && 
                        person.location.trim().toLowerCase() !== 'вне территории' && 
                        person.location !== 'outside'

      // Случай 1: Человек сейчас СНАРУЖИ (есть timestamp_out, нет timestamp_in)
      if (entry.timestamp_out && !entry.timestamp_in) {
        if (isResident) {
          // Житель ушел (отсутствует)
          residentsOut++
        }
        // Гость, который вышел, нас не интересует для статистики "В гостях"
      }
      // Случай 2: Человек сейчас ВНУТРИ (есть timestamp_in, нет timestamp_out)
      // Это типичная запись для Гостя, который вошел
      else if (entry.timestamp_in && !entry.timestamp_out) {
        if (!isResident) {
          // Гость вошел (в гостях)
          outsidersIn++
        }
        // Житель, который внутри (вернулся), не считается "отсутствующим"
      }
    })

    return { residentsOut, outsidersIn }
  })

  const processedJournal = computed(() => {
    return journalList.value.map((entry: any) => {
      const person = peopleList.value.find((p: any) => String(p.id) === String(entry.person_id))
      
      let fio = entry.person_fio || person?.fio || 'Неизвестно'
      const isChild = person?.category === 'Ребенок'
      if (isChild && !fio.startsWith('+')) {
        fio = `+ ${fio}`
      }

      return {
        ...entry,
        person_fio: fio,
        person_category: person?.category || '-',
        sortTime: new Date(entry.timestamp_out || entry.timestamp_in || entry.created_at || 0).getTime()
      }
    }).sort((a: any, b: any) => b.sortTime - a.sortTime)
  })

  const loadData = async () => {
    try {
      const [people, journalRaw] = await Promise.all([
        getAllItems('people'),
        getAllItems('journal')
      ])
      
      peopleList.value = people || []

      const brokenIds: number[] = []
      const cleanJournal = (journalRaw || []).filter((entry: any) => {
        const isValid = entry.person_id !== undefined && entry.person_id !== null
        if (!isValid) {
          brokenIds.push(entry.id)
        }
        return isValid
      })

      if (brokenIds.length > 0) {
        console.warn(`[useJournal] 🧹 Удаление ${brokenIds.length} битых записей.`)
        Promise.all(brokenIds.map(id => dbDeleteItem('journal', id))).catch(e => console.error(e))
      }

      journalList.value = cleanJournal
      
      console.log(`[useJournal] 📥 Загрузка: Люди=${people?.length || 0}, Записи=${cleanJournal.length}`)
      
    } catch (e) {
      console.error('[useJournal] 💥 Ошибка загрузки', e)
    }
  }

  const addEntry = async (entry: any) => {
    if (!entry.person_id) {
      console.error('[useJournal] Попытка сохранить запись без person_id', entry)
      return
    }
    await addItem('journal', entry)
    await loadData()
  }

  const updateEntryFull = async (entry: any) => {
    await updateItem('journal', entry)
    await loadData()
  }

  const deleteEntry = async (id: number) => {
    await dbDeleteItem('journal', id)
    await loadData()
  }

  const formatTime = (ts: number | string | Date) => {
    if (!ts) return '—'
    try {
      const date = new Date(ts)
      if (isNaN(date.getTime())) return '—'
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  }
  
  const sortField = ref('date')
  const sortOrder = ref(-1)
  const displayMode = ref('timeline')

  /**
   * Поиск попутчиков.
   */
  const getCompanions = (personId: string | number) => {
    const targetEntry = journalList.value.find((e: any) => 
      String(e.person_id) === String(personId) && e.timestamp_out && !e.timestamp_in
    )

    if (!targetEntry || !targetEntry.timestamp_out) {
      return []
    }

    const targetTime = new Date(targetEntry.timestamp_out).getTime()
    const TIME_WINDOW = 15 * 60 * 1000

    const companions: any[] = []

    journalList.value.forEach((entry: any) => {
      if (!entry.timestamp_out || entry.timestamp_in) return
      if (String(entry.person_id) === String(personId)) return

      const entryTime = new Date(entry.timestamp_out).getTime()
      const diff = Math.abs(targetTime - entryTime)

      if (diff < TIME_WINDOW) {
        const person = peopleList.value.find((p: any) => String(p.id) === String(entry.person_id))
        
        companions.push({
          id: entry.id,
          person_id: entry.person_id,
          fio: person?.fio || 'Неизвестный',
          timestamp_out: entry.timestamp_out
        })
      }
    })

    return companions
  }

  return {
    peopleList,
    journalList,
    processedJournal,
    stats,
    loadData,
    addEntry,
    updateEntryFull,
    deleteEntry,
    formatTime,
    sortField,
    sortOrder,
    displayMode,
    getCompanions
  }
}