// app/types/scene.ts
import type { TrafficConfig, Direction, TravelMode } from './simulator'

// Реэкспорт локально импортированного (без `from`) — не создаёт второй провайдер
// export type { SceneElement }

export interface SceneConfig {
  id: string
  name: string
  settings: SceneSettings
  elements: SceneElement[]
  scripts: Script[]
  variables: Variable[]
  trafficConfig: any
  lifeConfig: any
  // Пульты управления сцены. ⚠️ Сцены, сохранённые ДО введения panels, не
  // содержат это поле — normalizeScene() в useEditorLogic проставляет дефолты.
  panels: Panel[]
  // Метки времени — проставляются в useSceneBuilder при сохранении
  createdAt?: number
  updatedAt?: number
}

export interface SceneSettings {
  width: number
  height: number
  bgColor: string
  // Цвет рамки холста — пишется в defaultScene (useEditorLogic)
  borderColor?: string
  // Отображение сетки на холсте (EditorCanvas)
  showGrid?: boolean
  // Настройки трафика/симулятора сцены, перекрывающие глобальные из useConfig.
  // Record<string, any> — simOpts (ACCEL, REACTION_TIME и т.п.) шире TrafficConfig.
  traffic?: Partial<TrafficConfig> & Record<string, any>
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
  // Поля, которые пишет редактор и читают инспектор/PanelUI
  zIndex?: number
  bgColor?: string
  borderColor?: string
  /** Режим docks панели ('none' | 'top' | ... — управляет PanelUI) */
  dock?: string
}

export interface LogicBlock {
  id: string
  kind: string // 'action' | 'logic' | 'actor' | 'target' | 'param'
  type: string
  label: string
  meta?: any
  // [РАСШИРЕНО v5] elementId — ссылка на элемент сцены в блоках actor/target
  // (используется useScenarioRunner и ScenarioEditor)
  valueConfig?: {
    mode: 'exact' | 'random'
    exact: any
    min?: number
    max?: number
    appearance?: string
    easingStart?: string
    easingEnd?: string
    speed?: number      // блок move
    delay?: number      // блок wait
    effect?: string     // блок despawn ('fade')
    operator?: string   // блок check_distance
    value?: number      // блок check_distance
    elementId?: string  // блоки actor/target — id элемента сцены
  }
}

export interface Variable {
  key: string
  value: string
}

// 'logic' — реальные логические блоки сценария (wait_until, check_distance)
export type BlockKind = 'action' | 'logic' | 'actor' | 'target' | 'param'