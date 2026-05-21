// types/simulator.ts
export type Direction = 'enter' | 'exit'
export type TravelMode = 'walk' | 'car'
export type SubState = 'to_gate' | 'to_exit'
export type AgentState = 'to_gate' | 'waiting' | 'passing' | 'done'

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
  // --- новые поля для территории ---
  zonePolygon?: { x: number; y: number }[]   // полигон зоны (если элемент является зоной)
  belongsToGateId?: string                    // ID калитки/ворот, к которым относится зона
  territoryRect?: { x: number; y: number; width: number; height: number } // упрощённый прямоугольник территории
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
  entryPoint?: { x: number; y: number }
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