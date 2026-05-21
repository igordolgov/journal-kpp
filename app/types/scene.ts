// types/scene.ts
export interface SceneConfig {
  id: string
  name: string
  settings: SceneSettings
  elements: SceneElement[]
  scripts: Script[]
  variables: Variable[]
  trafficConfig: any
  lifeConfig: any
}

export interface SceneSettings {
  width: number
  height: number
  bgColor: string
}

export interface SceneElement {
  id: string
  name: string
  type: string // 'actor' | 'gate' | 'zone'
  x: number
  y: number
  rotation?: number
  zoneType?: string
}

export interface Script {
  id: string
  name: string
  trigger: string
  tracks: ScriptTrack[]
}

export interface ScriptTrack {
  id: string
  name: string
  sequence: LogicBlock[]
}

export interface Control {
  id: string
  type: string
  x: number
  y: number
  settings?: Record<string, any>
}

export interface Panel {
  id: string
  title?: string
  x?: number
  y?: number
  width?: number
  height?: number
  controls: Control[]
}

export interface LogicBlock {
  id: string
  kind: string // 'action' | 'actor' | 'target' | 'param'
  type: string
  label: string
  meta?: any
  // ВАЖНО: Это поле нужно, чтобы редактор не ругался
  valueConfig?: {
    mode: 'exact' | 'random'
    exact: any
    min?: number
    max?: number
    appearance?: string
    easingStart?: string
    easingEnd?: string
  }
}

export interface Variable {
  key: string
  value: string
}

export type BlockKind = 'action' | 'actor' | 'target' | 'param'