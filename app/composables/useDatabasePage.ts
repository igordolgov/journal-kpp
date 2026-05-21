// composables/useDatabasePage.ts
// Назначение: Управление данными страницы Базы Данных (Люди, Машины).
// Реализует: Поиск (Fuse.js), Сортировку, Группировку по семьям и Подсветку результатов.

import { ref, computed, watch } from 'vue'
import { useState } from '#imports'
import Fuse from 'fuse.js'
import { useDatabase } from './useDatabase'
import { useFamily } from './useFamily'
import { useCompanions } from './useCompanions'

export const useDatabasePage = () => {
  const { getAllItems } = useDatabase()
  const { getFullFamily } = useFamily()
  const { isChild } = useCompanions()

  // --- State ---
  
  const allPeopleList = ref<IPerson[]>([])
  const vehiclesList = ref<IVehicle[]>([])
  
  // Глобальное состояние поиска (сохраняется при навигации)
  const searchQuery = useState<string>('kpp-global-search', () => '')
  
  // Результаты поиска (ID найденных людей)
  const foundIds = ref<Set<number>>(new Set())
  
  // Объект с индексами для подсветки
  const highlights = ref<Record<number, any>>({})
  
  // Сортировка
  const sortField = ref('fio')
  const sortOrder = ref(1) // 1 = ASC, -1 = DESC

  // Fuse instances
  let fusePeople: Fuse<IPerson> | null = null
  let fuseVehicles: Fuse<IVehicle> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // --- Methods ---
  
  /**
   * Загрузка данных и инициализация поискового индекса.
   */
  const loadAllData = async () => {
    const people = await getAllItems('people')
    const vehicles = await getAllItems('vehicles')
    
    allPeopleList.value = people
    vehiclesList.value = vehicles

    // Настройка Fuse.js для людей
    fusePeople = new Fuse(people, {
      keys: ['fio', 'phone', 'location', 'category'],
      includeMatches: true,
      threshold: 0.3,
      minMatchCharLength: 3,
      ignoreLocation: true
    })

    // Настройка Fuse.js для транспорта
    fuseVehicles = new Fuse(vehicles, {
      keys: ['plate', 'model'],
      includeMatches: true,
      threshold: 0.3,
      minMatchCharLength: 3,
      ignoreLocation: true
    })
    
    if (searchQuery.value) {
      runSearch(searchQuery.value)
    }
  }

  /**
   * Сброс поиска.
   */
  const clearSearch = () => {
    searchQuery.value = ''
    foundIds.value = new Set()
    highlights.value = {}
  }

  /**
   * Смена сортировки.
   */
  const setSort = (field: string) => {
    if (sortField.value === field) sortOrder.value = sortOrder.value * -1
    else { sortField.value = field; sortOrder.value = 1 }
  }

  /**
   * Основная логика поиска.
   */
  const runSearch = (query: string) => {
    const q = query.trim()
    
    if (!q || q.length < 3 || !fusePeople || !fuseVehicles) {
      foundIds.value = new Set()
      highlights.value = {}
      return
    }

    const newFoundIds = new Set<number>()
    const newHighlights: Record<number, any> = {}

    // 1. Поиск по людям
    const peopleRes = fusePeople.search(q)
    peopleRes.forEach(res => {
      const id = res.item.id
      newFoundIds.add(id)
      if (!newHighlights[id]) newHighlights[id] = {}
      
      res.matches?.forEach((m: any) => { 
        newHighlights[id][m.key] = m.indices 
      })
    })

    // 2. Поиск по машинам
    const vehicleRes = fuseVehicles.search(q)
    vehicleRes.forEach(res => {
      const ownerId = res.item.owner_id
      if (ownerId) {
        newFoundIds.add(ownerId) 
        
        if (!newHighlights[ownerId]) newHighlights[ownerId] = {}
        if (!newHighlights[ownerId].vehicles) newHighlights[ownerId].vehicles = {}
        
        newHighlights[ownerId].vehicles[res.item.id] = res.matches?.[0]?.indices
      }
    })

    foundIds.value = newFoundIds
    highlights.value = newHighlights
  }

  // Watcher с Debounce
  watch(searchQuery, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    
    debounceTimer = setTimeout(() => {
      runSearch(val)
    }, 300)
  })

  // --- Computed ---

  /**
   * Результирующий список людей.
   */
  const processedResults = computed(() => {
    let baseList: IPerson[]
    const hasSearch = searchQuery.value.trim().length >= 3 && foundIds.value.size > 0
    
    if (hasSearch) {
      baseList = allPeopleList.value.filter(p => foundIds.value.has(p.id))
    } else {
      baseList = allPeopleList.value
    }

    const heads = baseList.filter(p => !p.main_family_id)
    const children = baseList.filter(p => p.main_family_id)

    heads.sort((a, b) => {
      let valA = a[sortField.value as keyof IPerson] ?? ''
      let valB = b[sortField.value as keyof IPerson] ?? ''
      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()
      
      if (valA < valB) return -1 * sortOrder.value
      if (valA > valB) return 1 * sortOrder.value
      return 0
    })

    children.sort((a, b) => (a.fio || '').localeCompare(b.fio || ''))
    
    const result: any[] = []
    const addedChildIds = new Set<number>()

    heads.forEach(h => {
      result.push({ ...h, _isChild: false })
      
      children
        .filter(c => c.main_family_id === h.id)
        .forEach(kid => {
          result.push({ ...kid, _isChild: true })
          addedChildIds.add(kid.id)
        })
    })

    children.forEach(c => { 
      if (!addedChildIds.has(c.id)) {
        result.push({ ...c, _isChild: true })
      } 
    })

    return result
  })

  /**
   * Список только взрослых.
   */
  const adultPeopleList = computed(() => allPeopleList.value.filter(p => !isChild(p)))

  /**
   * Функция подсветки текста.
   */
  const highlightText = (text: string, indices?: any) => {
    if (!indices || indices.length === 0) return text
    let result = ''
    let lastIdx = 0
    const sorted = [...indices].sort((a: any, b: any) => a[0] - b[0])
    
    sorted.forEach((range: any) => {
      const [start, end] = range
      if (end - start + 1 < 3) { 
        result += text.slice(lastIdx, end + 1)
        lastIdx = end + 1
        return 
      }
      
      result += text.slice(lastIdx, start)
      result += `<span class="bg-yellow-200 text-black rounded px-0.5">${text.slice(start, end + 1)}</span>`
      lastIdx = end + 1
    })
    
    result += text.slice(lastIdx)
    return result
  }

  return {
    // State
    searchQuery,
    allPeopleList,
    vehiclesList,
    processedResults,
    adultPeopleList,
    highlights,
    sortField,
    sortOrder,
    
    // Methods
    loadAllData,
    clearSearch,
    setSort,
    highlightText,
    getFullFamily
  }
}