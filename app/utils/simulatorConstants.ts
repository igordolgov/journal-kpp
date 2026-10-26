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

// ---------------------------------------------------------------------------
// [№31-ЦВЕТ] Цвета машин: у записей БД цвет хранится РУССКИМ СЛОВОМ
// (сидер: 'Черный'/'Белый'/...), а SVG-генератор вставляет значение в fill —
// невалидный CSS-цвет рендерился чёрным («все машины чёрные»). Теперь цвет
// записи приводится к CSS-цвету справочником; hex/css-имена проходят как есть.
// ---------------------------------------------------------------------------
export const VEHICLE_COLOR_NAMES: Record<string, string> = {
  'Черный': '#1f2937',
  'Чёрный': '#1f2937',
  'Белый': '#e2e8f0',
  'Серебро': '#94a3b8',
  'Серебристый': '#94a3b8',
  'Синий': '#2563eb',
  'Голубой': '#38bdf8',
  'Красный': '#dc2626',
  'Зелёный': '#16a34a',
  'Зеленый': '#16a34a',
  'Жёлтый': '#eab308',
  'Желтый': '#eab308',
  'Оранжевый': '#ea580c',
  'Фиолетовый': '#7c3aed',
  'Серый': '#9ca3af',
  'Коричневый': '#854d0e',
  'Бежевый': '#d6c7a1',
}

// Палитра для диалога редактирования машины и стабильного подбора «по номеру»
export const VEHICLE_PALETTE = [
  '#1f2937', '#e2e8f0', '#94a3b8', '#2563eb', '#dc2626',
  '#16a34a', '#eab308', '#ea580c', '#7c3aed', '#854d0e',
]

// Русское название/имя CSS/hex -> CSS-цвет; неизвестное значение -> null
// (назначается стабильный цвет по госномеру — машина не перекрашивается
// между поездками, как в жизни)
export const resolveVehicleColor = (color: unknown): string | null => {
  const c = String(color ?? '').trim()
  if (!c) return null
  const named = VEHICLE_COLOR_NAMES[c]
  if (named) return named
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c
  if (/^[a-z]+$/i.test(c)) return c
  return null
}

// Детерминированный цвет по госномеру (fallback для записей без цвета)
export const stableVehicleColor = (plate: unknown): string => {
  const p = String(plate ?? '')
  let h = 0
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0
  return VEHICLE_PALETTE[h % VEHICLE_PALETTE.length] ?? '#1f2937'
}

// [№31-ГРУЗОВИКИ] грузовые автомобили крупнее легковых (тип 'Грузовой' в БД)
export const TRUCK_WIDTH_SCALE = 1.2   // 80 -> 96px
export const TRUCK_HEIGHT_SCALE = 1.3  // 40 -> 52px

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