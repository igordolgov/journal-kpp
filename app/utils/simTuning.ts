// app/utils/simTuning.ts
// Назначение: санитизация интервалов спавна симулятора — чистая функция,
// покрыта юнит-тестами (tests/sim-tuning.test.ts). Пол не даёт старым
// сценам и ручному вводу душить ручной журнал, потолок отсекает
// бессмысленные значения, максимум держится минимум на 15с выше
// минимума (иначе getNextInterval(min, max) даёт перевёрнутый диапазон).

export interface SpawnInterval {
  min: number
  max: number
}

export const sanitizeSpawnInterval = (
  rawMin: unknown,
  rawMax: unknown,
  floor: number,
  capMin: number,
  fallbackMin: number,
  fallbackMax: number,
): SpawnInterval => {
  const nMin = Number(rawMin)
  const nMax = Number(rawMax)
  let min = Number.isFinite(nMin) && nMin > 0 ? nMin : fallbackMin
  let max = Number.isFinite(nMax) && nMax > 0 ? nMax : fallbackMax
  min = Math.min(capMin, Math.max(floor, min))
  max = Math.min(capMin + 150, Math.max(min + 15, max))
  return { min, max }
}

// [П7] Индивидуальный темп людей: каждый человек на спавне получает
// множитель скорости 0.85..1.15 (в жизни все ходят немного по-разному).
// У группы множитель ОДИН на всю колонну (берётся при создании группы),
// чтобы колонна не растягивалась. Машины множитель не получают.
export const PERSON_PACE_MIN = 0.85
export const PERSON_PACE_MAX = 1.15
export const randomPersonPace = (): number =>
  PERSON_PACE_MIN + Math.random() * (PERSON_PACE_MAX - PERSON_PACE_MIN)

// [П1] Темп шага = скорости ходьбы. Возвращает прирост «паузы анимации»
// за кадр: пока агент идёт медленнее крейсерской (уступание, дотягивание),
// пауза растёт и сдвигает фазу CSS-анимации ног назад — ноги перебирают
// реже, корпус не «скользит» на семенящих ногах. На крейсерской и выше
// прирост 0 — обычное воспроизведение, ничего не пишется в DOM.
export const walkHoldStep = (dt: number, velocity: number, cruise: number): number =>
  dt * (1 - Math.max(0, Math.min(1, velocity / Math.max(1, cruise))))
