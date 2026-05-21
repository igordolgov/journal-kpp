// app\composables\useConfig.ts
// Назначение: Управление глобальной конфигурацией приложения.

import { useState, computed } from '#imports'
import { useDatabase } from './useDatabase'

// --- Интерфейсы ---

export interface IUiConfig {
  tableDensity: 'compact' | 'comfortable' | 'normal'
  tableFontSize: number
}

export interface ILabelConfig {
  [key: string]: string
}

export interface ICategory {
  id: string
  name: string
}

export interface IRelation {
  id: string
  name: string
  gender: 'male' | 'female' | 'neutral'
}

export interface IColumnConfig {
  key: string
  visible: boolean
  order: number
}

export interface IActionButtonConfig {
  key: string
  label: string
  visible: boolean
  order: number
}

// Настройки симулятора
export interface ISimulatorConfig {
  ACCEL: number
  DECEL: number
  ARRIVE_THRESHOLD: number
  REACTION_TIME: number
  MIN_BUFFER: number
  MAX_LOOKAHEAD: number
  YIELD_SPEED_THRESHOLD: number
  YIELD_TIME_THRESHOLD: number
  DEADLOCK_TIME: number
  REVERSE_TIME: number
  REVERSE_SPEED: number
  SPRITE_ORIENTATION_OFFSET: number
}

// НОВОЕ: Настройки генератора
export interface ISederConfig {
  familiesCount: number
  minKids: number
  maxKids: number
  
  // Глава семьи
  headIsMaleChance: number     // Вероятность что глава мужчина
  headIsSeniorChance: number   // Вероятность что глава пенсионер (Дед/Бабка)
  
  // Члены семьи (вероятности)
  spouseChance: number         // Супруг(а)
  siblingChance: number        // Братья/Сестры главы
  siblingSpouseChance: number  // Супруги братьев/сестер
  nephewChance: number         // Племянники (дети братьев/сестер)
  parentsChance: number        // Родители главы (если глава молод)
  
  // Транспорт
  vehicleChanceAdult: number
  vehicleChanceSenior: number
  vehicleRegionCode: string    // Код региона (например, "77")
}

export interface IConfig {
  ui: IUiConfig
  labels: ILabelConfig
  categories: ICategory[]
  relations: IRelation[]
  destinations: string[]
  journalColumns: IColumnConfig[]
  actionButtons: IActionButtonConfig[]
  simulator: ISimulatorConfig
  seeder: ISederConfig // НОВОЕ
}

// --- Конфиг по умолчанию ---

const defaultConfig: IConfig = {
  ui: {
    tableDensity: 'compact',
    tableFontSize: 13
  },
  labels: {
    fio: 'ФИО', phone: 'Телефон', location: 'Проживание',
    destination: 'Куда', vehicle: 'Транспорт',
    category: 'Категория', relation: 'Степень родства',
    status: 'Статус', date: 'Дата',
    time_out: 'Вышел', time_in: 'Вошел', plate: 'Гос. номер', model: 'Модель',
    type: 'Тип', owner: 'Владелец', family: 'Родственники', written_off: 'Списано'
  },
  
  categories: [
    { id: 'resident', name: 'Житель' },
    { id: 'guest', name: 'Гость' },
    { id: 'worker', name: 'Рабочий' },
    { id: 'service', name: 'Служебный' }
  ],

  relations: [
    { id: 'head', name: 'Глава', gender: 'male' },
    { id: 'wife', name: 'Супруга', gender: 'female' },
    { id: 'father', name: 'Отец', gender: 'male' },
    { id: 'mother', name: 'Мать', gender: 'female' },
    { id: 'son', name: 'Сын', gender: 'male' },
    { id: 'daughter', name: 'Дочь', gender: 'female' },
    { id: 'brother', name: 'Брат', gender: 'male' },
    { id: 'sister', name: 'Сестра', gender: 'female' },
    { id: 'grandfather', name: 'Дедушка', gender: 'male' },
    { id: 'grandmother', name: 'Бабушка', gender: 'female' },
    { id: 'guardian', name: 'Сопровождающий', gender: 'neutral' }
  ],

  destinations: ['Город', 'Магазин', 'Аптека', 'Школа', 'Больница'],
  
  journalColumns: [
    { key: 'time_out', visible: true, order: 2 },
    { key: 'vehicle', visible: true, order: 3 },
    { key: 'time_in', visible: true, order: 4 },
    { key: 'fio', visible: true, order: 5 },
    { key: 'destination', visible: true, order: 6 },
    { key: 'status', visible: true, order: 7 },
  ],
  
  actionButtons: [
    { key: 'exit', label: '🚶 Вышел', visible: true, order: 0 },
    { key: 'enter', label: '🏠 Вошел', visible: true, order: 1 },
  ],

  simulator: {
    enabled: true,
    maxAgents: 20,
    spawnIntervalMin: 10,
    spawnIntervalMax: 30,
    carSpawnIntervalMin: 5,
    carSpawnIntervalMax: 15,
    personSpeed: 40,
    personWidth: 40,
    personHeight: 55,
    locationWeightInside: 2.0,
    carSpeed: 100,
    carWidth: 80,
    carHeight: 40,
    gateCloseDelay: 10,
    wicketCloseDelay: 0,
    autoOpenGates: false,
    autoOpenWicket: false,
    ACCEL: 100,
    DECEL: 100,
    ARRIVE_THRESHOLD: 10,
    REACTION_TIME: 0.8,
    MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 200,
    YIELD_SPEED_THRESHOLD: 5,
    YIELD_TIME_THRESHOLD: 0.5,
    DEADLOCK_TIME: 5,
    REVERSE_TIME: 1.5,
    REVERSE_SPEED: 20,
    SPRITE_ORIENTATION_OFFSET: 0
  },

  // НОВОЕ: Дефолтные настройки генератора
  seeder: {
    familiesCount: 10,
    minKids: 1,
    maxKids: 3,
    
    headIsMaleChance: 0.7,      // 70% глав - мужчины
    headIsSeniorChance: 0.3,    // 30% глав - старики
    
    spouseChance: 0.8,          // 80% в браке
    siblingChance: 0.4,         // 40% есть братья/сестры
    siblingSpouseChance: 0.5,   // 50% братья/сестры в браке
    nephewChance: 0.5,          // 50% у братьев/сестер есть дети
    parentsChance: 0.2,         // 20% живут родители (если глава не старик)
    
    vehicleChanceAdult: 0.7,
    vehicleChanceSenior: 0.3,
    vehicleRegionCode: '77'
  }
}

export const useConfig = () => {
  const { getAllItems, updateItem, initSettings } = useDatabase()

  const config = useState<IConfig>('kpp-config', () => JSON.parse(JSON.stringify(defaultConfig)))

  const mergeArrays = <T extends { id: string }>(saved: T[], defaults: T[]): T[] => {
    const savedMap = new Map(saved.map(item => [item.id, item]))
    defaults.forEach(defItem => {
      if (!savedMap.has(defItem.id)) {
        saved.push(defItem)
      }
    })
    return saved
  }

  const loadConfig = async () => {
    await initSettings()
    const settings = await getAllItems('settings')
    const savedConfig = settings.find((s: any) => s.id === 'app_config')
    
    if (savedConfig && savedConfig.values) {
      const values = savedConfig.values

      if (values.ui) Object.assign(config.value.ui, values.ui)
      if (values.labels) Object.assign(config.value.labels, values.labels)

      if (Array.isArray(values.categories)) {
        config.value.categories = mergeArrays(values.categories, defaultConfig.categories)
      } else {
        config.value.categories = [...defaultConfig.categories]
      }

      if (Array.isArray(values.relations)) {
        config.value.relations = mergeArrays(values.relations, defaultConfig.relations)
      } else {
        config.value.relations = [...defaultConfig.relations]
      }

      if (Array.isArray(values.destinations) && values.destinations.length > 0) {
        config.value.destinations = values.destinations
      } else {
        config.value.destinations = [...defaultConfig.destinations]
      }

      if (values.journalColumns) {
        const savedCols = values.journalColumns.filter((c: IColumnConfig) => c.key !== 'date')
        config.value.journalColumns = mergeArrays(savedCols, defaultConfig.journalColumns)
      }

      if (values.actionButtons) {
        config.value.actionButtons = mergeArrays(values.actionButtons, defaultConfig.actionButtons)
      }

      if (values.simulator) {
        Object.assign(config.value.simulator, values.simulator)
      }

      // НОВОЕ: Загрузка настроек генератора
      if (values.seeder) {
        Object.assign(config.value.seeder, values.seeder)
      }
      
    } else {
      config.value = JSON.parse(JSON.stringify(defaultConfig))
    }
  }

  const saveConfig = async () => {
    const payload = { 
      id: 'app_config', 
      name: 'Конфигурация', 
      values: JSON.parse(JSON.stringify(config.value)) 
    }
    await updateItem('settings', payload)
  }

  const addDestination = async (newDest: string) => {
    if (!newDest || typeof newDest !== 'string') return
    const trimmed = newDest.trim()
    if (!trimmed) return
    if (!config.value.destinations) config.value.destinations = []

    const exists = config.value.destinations.some(
      (d: string) => d.toLowerCase() === trimmed.toLowerCase()
    )
    
    if (!exists) {
      config.value.destinations.push(trimmed)
      await saveConfig()
    }
  }

  const removeDestination = async (destToRemove: string) => {
    if (!config.value.destinations) return
    const index = config.value.destinations.findIndex((d: string) => d === destToRemove)
    if (index > -1) {
      config.value.destinations.splice(index, 1)
      await saveConfig()
    }
  }

  const getLabel = (key: string): string => config.value.labels[key] || key
  
  const getVisibleColumns = () => 
    [...config.value.journalColumns]
      .filter(c => c.visible)
      .sort((a, b) => a.order - b.order)

  const getVisibleButtons = () => 
    [...config.value.actionButtons]
      .filter(b => b.visible)
      .sort((a, b) => a.order - b.order)

  const getTableClasses = computed(() => {
    const density = config.value.ui?.tableDensity || 'compact'
    const map: Record<string, string> = {
      comfortable: 'density-comfortable leading-relaxed',
      normal: 'density-normal',
      compact: 'density-compact leading-tight'
    }
    return map[density] || map.compact
  })

  const getTableFontStyle = computed(() => {
    const size = config.value.ui?.tableFontSize || 13
    return { fontSize: `${size}px` }
  })

  const moveItem = (listKey: 'journalColumns' | 'actionButtons', index: number, direction: 'up' | 'down') => {
    const arr = config.value[listKey]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= arr.length) return
    
    const temp = arr[index].order
    arr[index].order = arr[newIndex].order
    arr[newIndex].order = temp
    
    config.value[listKey] = arr.sort((a,b) => a.order - b.order)
  }

  return { 
    config, 
    loadConfig, 
    saveConfig, 
    getLabel, 
    getVisibleColumns, 
    getVisibleButtons, 
    moveItem,
    getTableClasses, 
    getTableFontStyle, 
    addDestination,
    removeDestination
  }
}