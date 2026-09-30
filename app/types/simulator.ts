// app/types/simulator.ts
// Назначение: доменные типы симулятора КПП — элементы сцены, ИИ-агенты,
// скриптовые команды, конфигурация трафика.

export type Direction = 'enter' | 'exit'
export type TravelMode = 'walk' | 'car'

// [ТЕХДОЛГ] SubState не используется актуальной физикой — legacy, кандидат
// на удаление после прогона npx knip.
export type SubState = 'to_gate' | 'to_exit'

// Реальный набор состояний из useSimulatorPhysics.
// 'waiting'/'passing' — legacy-значения; убрать, когда typecheck подтвердит,
// что они нигде не присваиваются.
export type AgentState =
  | 'to_gate'
  | 'waiting_before'
  | 'waiting_after'
  | 'crossing'
  | 'moving_away'
  | 'waiting'   // legacy
  | 'passing'   // legacy
  | 'done'

// [ДОБАВЛЕНО v3] Сведённая информация о человеке в машине (водитель/пассажиры).
// Используется useSimulatorSpawn (createPersonInfo) и журналом событий.
export interface PersonInfo {
  id: number
  fio?: string
  // Индексная подпись: createPersonInfo копирует произвольные поля записи БД
  [key: string]: any
}

export interface SceneElement {
  id: string | number
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  category?: string
  type?: string // 'actor' | 'gate' | 'element' | 'zone'
  asset?: any
  settings?: any
  velocity?: number
  zIndex?: number
  name?: string
  personId?: number
  direction?: Direction
  travelMode?: TravelMode
  // --- поля территории ---
  zonePolygon?: { x: number; y: number }[]   // полигон зоны (если элемент — зона)
  belongsToGateId?: string                    // ID калитки/ворот, к которым относится зона
  territoryRect?: { x: number; y: number; width: number; height: number } // упрощённый прямоугольник территории
  // --- [ДОБАВЛЕНО v3] групповое поведение (пишется в useSimulatorSpawn) ---
  groupId?: string
  isLeader?: boolean
  groupIndex?: number
  /** Подпись группы над лидером (имена членов семьи) */
  groupLabel?: string
  /** Люди в машине (водитель + пассажиры) */
  occupants?: PersonInfo[]
}

export interface AiAgent {
  id: string
  element: SceneElement
  state: AgentState
  subState?: SubState
  target: { x: number; y: number; width: number; height: number }
  afterTarget: { x: number; y: number; width: number; height: number }
  // [ИЗМЕНЕНО v3] форма приведена к target/afterTarget — spawn кладёт сюда
  // объект с width/height, прежний тип {x,y} давал excess property
  exitPoint?: { x: number; y: number; width: number; height: number }
  speed: number
  type: 'car' | 'person'
  direction: Direction
  travelMode: TravelMode
  entryPoint?: { x: number; y: number }
  // --- групповое поведение ---
  groupId?: string
  /** Агент — лидер группы (идёт первым, показывает метку переговорника) */
  isLeader?: boolean
  /** Порядковый номер в группе */
  groupIndex?: number
  /** Участники группы (используются в useSimulatorPhysics) */
  groupMembers?: AiAgent[]
  // --- [ДОБАВЛЕНО v3] ---
  /** ID ворот, к которым привязан агент */
  gateId?: string
  /** Люди в машине (водитель + пассажиры) */
  occupants?: PersonInfo[]
}

export interface ScriptCommand {
  id: string
  actor?: SceneElement | null
  target?: SceneElement | { x: number; y: number; width: number; height: number } | null
  speed?: number
  done?: boolean
  type?: 'move' | 'wait'
  isReversing?: boolean
  reverseTimer?: number
  stuckTime?: number
}

export interface TrafficConfig {
  enabled: boolean
  intervalMin: number
  intervalMax: number
  personSpeed: number
  carSpeed: number
  carGateId: string
  personGateId: string
  gateCloseDelay?: number
  wicketCloseDelay?: number
  maxAgents?: number
  stepAudibleDistance?: number
  engineAudibleDistance?: number
}

export interface SimulatorConfig {
  elements?: any[]
  settings?: {
    width?: number
    height?: number
    traffic?: Partial<TrafficConfig>
  }
}