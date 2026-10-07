// app/types/simulator.ts
// Типы для симулятора: элементы сцены, AI-агенты, конфигурация

export type Direction = 'enter' | 'exit'
export type TravelMode = 'walk' | 'car'
export type SubState = 'to_gate' | 'to_exit' | 'moving_away'

export type AgentState =
  | 'to_gate'
  | 'waiting'
  | 'waiting_before'
  | 'waiting_after'
  | 'crossing'
  | 'passing'
  | 'moving_away'
  | 'done'

export interface PersonInfo {
  id: number
  fio: string
  isChild: boolean
  canGoAlone: boolean
}

export interface SceneElement {
  id: string
  name?: string
  type?: string // 'actor' | 'gate' | 'element' | 'zone'
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zoneType?: string
  category?: string
  asset?: any
  settings?: any
  velocity?: number
  zIndex?: number
  personId?: number
  direction?: Direction
  travelMode?: TravelMode
  opacity?: number

  // --- Поля симулятора ---
  occupants?: PersonInfo[]                                       // экипаж машины
  zonePolygon?: { x: number; y: number }[]                       // полигон зоны
  territoryRect?: { x: number; y: number; width: number; height: number }
  belongsToGateId?: string                                       // привязка зоны к воротам
  groupId?: string
  groupIndex?: number
  groupLabel?: string
  isLeader?: boolean
}

export interface AiAgent {
  id: string
  element: SceneElement
  state: AgentState
  subState?: SubState
  target: { x: number; y: number; width: number; height: number }
  afterTarget: { x: number; y: number; width: number; height: number }
  speed: number
  type: 'car' | 'person'
  direction: Direction
  travelMode: TravelMode

  entryPoint?: { x: number; y: number; width?: number; height?: number }
  exitPoint?: { x: number; y: number; width?: number; height?: number }

  occupants?: PersonInfo[]
  groupId?: string
  groupIndex?: number
  groupLabel?: string
  isLeader?: boolean
  groupMembers?: AiAgent[]
  gateId?: string
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
  stepAudibleDistance?: number
  engineAudibleDistance?: number
}

export interface SimulatorConfig {
  elements?: SceneElement[]
  settings?: {
    width?: number
    height?: number
    traffic?: Partial<TrafficConfig>
  }
}
