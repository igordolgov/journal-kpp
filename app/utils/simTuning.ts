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

// [№21-РАНДОМ] первый сценарий появления агентов больше не фиксированный:
// стартовые задержки потоков (пешие въезд/выезд, авто въезд/выезд) — случайные
// окна, привязанные к НАСТРОЕННОМУ интервалу, поэтому каждый запуск
// симулятора начинается с разной последовательности (репорт №21: «появляются
// каждый раз по одному и тому же сценарию»).
export const randomFirstDelay = (
  intervalMin: number,
  fracMin: number,
  fracMax: number,
  lo: number,
  hi: number,
): number => {
  const base = Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : lo
  const frac = fracMin + Math.random() * Math.max(0, fracMax - fracMin)
  return Math.min(hi, Math.max(lo, base * frac))
}

// [№21-РАНДОМ] выбор человека с «охлаждением»: недавно появлявшиеся
// (recentIds) уходят в конец предпочтений — одни и те же лица не идут
// подряд, даже когда база маленькая. Чистая функция (rng подставляется
// в тестах). Возвращает элемент И дописывает его в recentIds (FIFO, cap).
export const pickRecentAware = <T>(
  pool: T[],
  recentIds: unknown[],
  rng: () => number = Math.random,
  cap: number = 8,
): { item: T; fresh: boolean } | null => {
  if (!pool.length) return null
  const recentSet = new Set(recentIds)
  const fresh = pool.filter(p => !recentSet.has(p))
  const usePool = fresh.length > 0 ? fresh : pool
  const idx = Math.floor(rng() * usePool.length)
  const item: T = (idx >= 0 && idx < usePool.length ? usePool[idx] : usePool[0]) as T
  recentIds.push(item)
  while (recentIds.length > cap) recentIds.shift()
  return { item, fresh: fresh.length > 0 }
}

// [П1][№12] Темп шага = скорости ходьбы. Возвращает прирост ФАЗЫ цикла
// за кадр: фаза растёт пропорционально пройденному пути
// (dt * v / cruise), поэтому ноги перебирают тем реже, чем медленнее
// идёт агент (уступание, дотягивание), и НИКОГДА не быстрее
// естественного темпа CSS-анимации. На крейсерской прирост равен dt —
// совпадает с естественным воспроизведением, в DOM не пишем;
// стоящий агент (v=0) фазу не двигает. История: прежняя версия
// копила «паузу» dt*(1 - v/cruise) — фаза убегала вперёд (до 2x при
// остановке): «ускорение ног при торможении», баг-репорт №12.
export const walkHoldStep = (dt: number, velocity: number, cruise: number): number =>
  dt * Math.max(0, Math.min(1, velocity / Math.max(1, cruise)))
