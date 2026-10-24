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

// [№21-РАНДОМ] стартовая задержка ПЕРВОГО спавна потока: случайная доля
// (0.2..0.6) минимального интервала с глобальными границами [4, 45] с.
// При randomizeSpawnStart: false спавн использует прежние фиксированные
// 10/14/20/25 с (детерминизм старых сборок), см. useSimulatorSpawn.
export const initialSpawnDelay = (intervalMin: number): number => {
  const base = Number.isFinite(intervalMin) && intervalMin > 0 ? intervalMin : 0
  const frac = 0.2 + Math.random() * 0.4
  return Math.min(45, Math.max(4, base * frac))
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

// [П1][№12][№26-ФИКС-ФАЗА] Темп шага = скорости ходьбы. Возвращает прирост
// ФАЗЫ-ЗАДЕРЖКИ за кадр: animation-delay растёт на dt*(1 - v/cruise), поэтому
// рендеримая скорость цикла ног = 1 - (1 - v/cruise) = v/cruise — ноги
// перебирают пропорционально ходу (замедлился — ноги реже), на крейсерской
// прирост нулевой (естественное воспроизведение), при остановке замирают.
// История: версия №12 аккумулировала +dt*v/cruise при ОТРИЦАТЕЛЬНОМ
// множителе delay (*-1s) — рендеримая скорость была 1 + v/cruise (до 2x):
// ноги «семенили» вдвое быстрее ровно на тормозном подходе к точке останова
// (репорт №26 «дергаются и быстро перескакивают перед точками останова»),
// со скачком 1x -> 2x на границе крейсерской. Применяется ТОЛЬКО на ходу
// ниже крейсерской (v > 0.05 && v < cruise, см. useSimulatorPhysics);
// множитель в personSvgRenderer теперь ПОЛОЖИТЕЛЬНЫЙ (* 1s).
export const walkHoldStep = (dt: number, velocity: number, cruise: number): number => {
  const r = Math.max(0, Math.min(1, velocity / Math.max(1, cruise)))
  return dt * (1 - r)
}
