// app/types/index.ts
// Назначение: Глобальные типы данных приложения.
// Nuxt автоматически импортирует типы отсюда во все компоненты и композаблы.

// --- Человек / Житель ---
export interface IPerson {
  id: string | number
  fio?: string
  type?: string
  location?: string
  allowed_guardians?: (string | number)[]
  category?: string
  exit_category?: 'small' | 'adult' | string
  gender?: 'male' | 'female'
  main_family_id?: string | number | null
  relation?: string
  [key: string]: any // Для совместимости с остальными полями из БД
}

// --- Транспортное средство ---
export interface IVehicle {
  id: number | string
  owner_id: number | string
  plate: string
  model?: string
  type?: string
  [key: string]: any
}

// --- Запись журнала ---
export interface IJournalEntry {
  id?: string | number
  person_id: string | number
  timestamp_out?: string | Date | null
  timestamp_in?: string | Date | null
  destination?: string
  [key: string]: any
}

// --- Семейные связи ---
export interface IFamilyMember extends IPerson {
  relation: string // Вычисленное отношение к целевому человеку
}

// --- Настройки ---
export interface IConfig {
  ui: IUiConfig
  labels: ILabelConfig
  categories: ICategory[]
  relations: IRelation[]
  destinations: string[]
  journalColumns: IColumnConfig[]
  actionButtons: IActionButtonConfig[]
}

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