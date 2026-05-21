// app/utils/simulatorConstants.ts
// Константы для симулятора (используются как fallback, если не переданы через simOpts)

// Размеры и отступы (не настраиваются через UI, т.к. зависят от геометрии сцены)
export const PERSON_STOP_OFFSET = 78
export const CAR_STOP_OFFSET = 58
export const PERSON_VERTICAL_OFFSET = 17
export const EXIT_HORIZONTAL_DISTANCE = 2000
export const EXIT_VERTICAL_DISTANCE = 2000
export const DESPAWN_MARGIN = 200

// Ручные координаты (для отладки, можно менять в коде)
export const USE_MANUAL_COORDS = true
export const MANUAL_Y_PERSON = 170
export const MANUAL_X_PERSON = 795
export const MANUAL_Y_CAR = 180
export const MANUAL_X_CAR = 635
export const MANUAL_PERSON_GATE_ID = 'el_ge71x68vo'
export const MANUAL_CAR_GATE_ID = 'el_qcm3kodjy'

// Список категорий ворот (для определения)
export const GATES_LIST = ['gate', 'barrier']

// Значения по умолчанию для размеров (используются, если не переданы в simOpts)
export const PERSON_WIDTH = 40
export const PERSON_HEIGHT = 55
export const CAR_WIDTH = 80
export const CAR_HEIGHT = 40

// Палитра цветов для машин (только если цвет не задан в БД)
export const CAR_COLORS = [
  'forestgreen', 'brown', 'blueviolet', 'darkkhaki',
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f8fafc', '#1e293b'
]

// Константы анимации (смещение спрайта по умолчанию)
export const SPRITE_ORIENTATION_OFFSET = 0

// Параметры физики по умолчанию (fallback, если не переданы в simOpts)
export const ACCEL = 100
export const DECEL = 100
export const REACTION_TIME = 1.5
export const MIN_BUFFER = 15
export const MAX_LOOKAHEAD = 220
export const DEADLOCK_TIME = 5
export const REVERSE_TIME = 1.5
export const REVERSE_SPEED = 20
export const ARRIVE_THRESHOLD = 1

// Экспорт TRAFFIC_CONFIG для обратной совместимости (используется в useSimulatorScripts.ts)
export const TRAFFIC_CONFIG = {
  ACCEL,
  DECEL,
  REACTION_TIME,
  MIN_BUFFER,
  MAX_LOOKAHEAD,
  DEADLOCK_TIME,
  REVERSE_TIME,
  REVERSE_SPEED,
  ARRIVE_THRESHOLD
}