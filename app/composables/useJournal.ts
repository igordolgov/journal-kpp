// app/composables/useJournal.ts
// Исправления:
// 1. O(n²) → O(1): peopleMap вместо find() внутри map/forEach
// 2. Оптимистичные обновления: addEntry/deleteEntry не делают полный reload
// 3. useJournalPage больше не нужен свой peopleList — использует этот

import { useState, computed, ref } from '#imports'
import { useDatabase } from './useDatabase'

export const useJournal = () => {
  const { getAllItems, addItem, updateItem, deleteItem: dbDeleteItem } = useDatabase()

  const peopleList = useState<any[]>('journal-people', () => [])
  const journalList = useState<any[]>('journal-raw', () => [])

  // O(1) карта людей вместо find() в каждом computed
  const peopleMap = computed<Map<string, any>>(() => {
    const map = new Map<string, any>()
    for (const p of peopleList.value) {
      map.set(String(p.id), p)
    }
    return map
  })

  // Определение "проживает на территории" по полю location.
  // БАГ БЫЛ: сравнение со строками 'вне территории' / 'outside', которых в проекте не существует
  // (реальные значения — 'На территории' / 'В городе' / 'Город', см. PersonFormModal.vue,
  // GeneratorModal.vue) — из-за этого residentsOut/outsidersIn считались неверно.
  const isResidentLocation = (location?: string | null): boolean => {
    const loc = (location || '').trim().toLowerCase()
    if (!loc) return true // нет данных — считаем местным/на территории
    return !(loc.includes('город') || loc === 'outside' || loc === 'вне территории')
  }

  const stats = computed(() => {
    let residentsOut = 0
    let outsidersIn = 0

    for (const entry of journalList.value) {
      const person = peopleMap.value.get(String(entry.person_id))
      if (!person) continue

      const isResident = isResidentLocation(person.location)

      if (entry.timestamp_out && !entry.timestamp_in) {
        if (isResident) residentsOut++
      } else if (entry.timestamp_in && !entry.timestamp_out) {
        if (!isResident) outsidersIn++
      }
    }

    return { residentsOut, outsidersIn }
  })

  const processedJournal = computed(() => {
    return journalList.value
      .map((entry: any) => {
        const person = peopleMap.value.get(String(entry.person_id))

        let fio = entry.person_fio || person?.fio || 'Неизвестно'
        const isChild = person?.category === 'Ребенок'
        if (isChild && !fio.startsWith('+')) {
          fio = `+ ${fio}`
        }

        return {
          ...entry,
          person_fio: fio,
          person_category: person?.category || '-',
          sortTime: new Date(
            entry.timestamp_out || entry.timestamp_in || entry.created_at || 0
          ).getTime(),
        }
      })
      .sort((a: any, b: any) => b.sortTime - a.sortTime)
  })

  const loadData = async () => {
    try {
      const [people, journalRaw] = await Promise.all([
        getAllItems('people'),
        getAllItems('journal'),
      ])

      peopleList.value = people || []

      const brokenIds: number[] = []
      const cleanJournal = (journalRaw || []).filter((entry: any) => {
        const isValid = entry.person_id !== undefined && entry.person_id !== null
        if (!isValid) brokenIds.push(entry.id)
        return isValid
      })

      if (brokenIds.length > 0) {
        console.warn(`[useJournal] 🧹 Удаление ${brokenIds.length} битых записей.`)
        Promise.all(brokenIds.map(id => dbDeleteItem('journal', id))).catch(console.error)
      }

      journalList.value = cleanJournal
    } catch (e) {
      console.error('[useJournal] 💥 Ошибка загрузки', e)
    }
  }

  // Оптимистичное добавление: вставляем в локальный массив сразу
  const addEntry = async (entry: any) => {
    if (!entry.person_id) {
      console.error('[useJournal] Попытка сохранить запись без person_id', entry)
      return
    }
    const id = await addItem('journal', entry)
    journalList.value = [...journalList.value, { ...entry, id }]
  }

  const updateEntryFull = async (entry: any) => {
    await updateItem('journal', entry)
    const idx = journalList.value.findIndex((e: any) => e.id === entry.id)
    if (idx !== -1) {
      journalList.value = [
        ...journalList.value.slice(0, idx),
        { ...journalList.value[idx], ...entry },
        ...journalList.value.slice(idx + 1),
      ]
    }
  }

  const deleteEntry = async (id: number) => {
    await dbDeleteItem('journal', id)
    journalList.value = journalList.value.filter((e: any) => e.id !== id)
  }

  const formatTime = (ts: number | string | Date) => {
    if (!ts) return '—'
    try {
      const date = new Date(ts)
      if (isNaN(date.getTime())) return '—'
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '—'
    }
  }

  const sortField = ref('date')
  const sortOrder = ref(-1)
  const displayMode = ref('timeline')

  const getCompanions = (personId: string | number) => {
    const targetEntry = journalList.value.find(
      (e: any) =>
        String(e.person_id) === String(personId) &&
        e.timestamp_out &&
        !e.timestamp_in
    )

    if (!targetEntry?.timestamp_out) return []

    const targetTime = new Date(targetEntry.timestamp_out).getTime()
    const TIME_WINDOW = 15 * 60 * 1000

    return journalList.value
      .filter((entry: any) => {
        if (!entry.timestamp_out || entry.timestamp_in) return false
        if (String(entry.person_id) === String(personId)) return false
        return Math.abs(new Date(entry.timestamp_out).getTime() - targetTime) < TIME_WINDOW
      })
      .map((entry: any) => {
        const person = peopleMap.value.get(String(entry.person_id))
        return {
          id: entry.id,
          person_id: entry.person_id,
          fio: person?.fio || 'Неизвестный',
          timestamp_out: entry.timestamp_out,
        }
      })
  }

  return {
    peopleList,
    journalList,
    peopleMap,       // <-- экспортируем карту для useJournalPage
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
    getCompanions,
  }
}
