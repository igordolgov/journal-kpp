// app/utils/widgetSettings.ts
// Назначение: сохранение настроек поповера симулятора (SimulatorWidget)
// в localStorage. Раньше значения жили только в ref и обнулялись при каждом
// монтировании виджета (док-панель рендерится через v-if): после закрытия
// и повторного открытия симулятора, а также после перезапуска приложения,
// «Макс. агентов» и интервалы возвращались к дефолтам.
// Функции принимают storage параметром — юнит-тесты подставляют заглушку.

export interface SimulatorWidgetSettings {
  maxAgents: number | null
  personIntervalMin: number | null
  personIntervalMax: number | null
  carIntervalMin: number | null
  carIntervalMax: number | null
  maxGroupSize: number | null
  maxNonFamily: number | null
  // [№15-ЗВУК] громкость/тишина симулятора (кнопка mute в хедере + слайдер в поповере)
  volume: number | null // 0..1, null = дефолт 0.6
  muted: boolean
}

export const WIDGET_SETTINGS_KEY = 'jkpp-sim-widget-settings-v1'

export const defaultWidgetSettings = (): SimulatorWidgetSettings => ({
  maxAgents: null,
  personIntervalMin: null,
  personIntervalMax: null,
  carIntervalMin: null,
  carIntervalMax: null,
  maxGroupSize: null,
  maxNonFamily: null,
  volume: null,
  muted: false,
})

// [№15] только числовые ключи: keyof-универсал после добавления volume/muted
// делает тип записи clean[key] пересечением всех типов значений (never)
const WIDGET_KEYS: (
  'maxAgents' | 'personIntervalMin' | 'personIntervalMax' |
  'carIntervalMin' | 'carIntervalMax' | 'maxGroupSize' | 'maxNonFamily'
)[] = [
  'maxAgents', 'personIntervalMin', 'personIntervalMax',
  'carIntervalMin', 'carIntervalMax', 'maxGroupSize', 'maxNonFamily',
]

// Пустая строка (очищенный input) и мусор превращаются в null —
// «значение не задано пользователем», виджет берёт значение из сцены/глобальных настроек
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

// [№15-ЗВУК] громкость 0 ДОПУСТИМА (mute), диапазон 0..1
const toVolumeOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null
}

export const loadWidgetSettings = (storage: Storage | null): SimulatorWidgetSettings => {
  const out = defaultWidgetSettings()
  if (!storage) return out
  try {
    const raw = storage.getItem(WIDGET_SETTINGS_KEY)
    if (!raw) return out
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>
      for (const key of WIDGET_KEYS) {
        out[key] = toNumOrNull(rec[key])
      }
      out.volume = toVolumeOrNull(rec.volume)
      out.muted = rec.muted === true
    }
  } catch (e) {
    console.warn('[widget-settings] не удалось прочитать, использую дефолты', e)
  }
  return out
}

export const saveWidgetSettings = (storage: Storage | null, s: SimulatorWidgetSettings): void => {
  if (!storage) return
  try {
    const clean = defaultWidgetSettings()
    for (const key of WIDGET_KEYS) clean[key] = toNumOrNull(s[key])
    clean.volume = toVolumeOrNull(s.volume)
    clean.muted = s.muted === true
    storage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(clean))
  } catch (e) {
    console.warn('[widget-settings] не удалось сохранить', e)
  }
}
