// app/utils/gateFlow.ts
// [№20-ВОРОТА-ИДЕАЛ] Единая логика движения машин и людей в зоне ворот.
//
// Заказчик (репорт №20):
//   1) выезжающая машина не должна сначала проезжать вверх (на глубокую
//      посадку CAR_EXIT_PULL_PAST), а затем возвращаться на точку ожидания
//      закрытия ворот; ждать «вверху» она может только если в это время
//      стоит или подъезжает к воротам другая машина;
//   2) въехавшая машина может сразу уехать налево, если в это время другая
//      машина хочет выехать (чтобы не создавать пробку);
//   3) люди должны заходить только в проём калитки — как будто по краям
//      калитки есть забор;
//   4) машины должны быть «как люди» по z-индексу (см. useSimulatorSpawn).
//
// Здесь только чистые предикаты/вычисления геометрии — состояние меняет
// useSimulatorPhysics. Все окна — конвенции оси ворот, сложившиеся в
// №9/№12/№19 (±70 по оси, ±60 по линии).

import { STOP_STANDOFF_ENTER } from './simulatorTraffic'

// Коридор оси ворот: чужой корпус/цель в ±70 px от оси считается стоящей
// «на воротах» (конвенция exitCarBlocksCorridor/carYieldLevel).
export const GATE_AXIS_WINDOW = 70
// Окно линии ожидания: корпус/цель в ±60 px по Y от линии ожидания
// въезжающих считается «на моей полосе».
export const LANE_WINDOW = 60
// Отступ проёма калитки: человек считается «в проёме», когда его центр
// дальше 6 px от каждого края калитки (не цепляет стойки).
export const APERTURE_INSET = 6
// Допуск перекрытия линии забора: корпус считается «на заборе», только
// когда он НАКРЫВАЕТ линию (straddle) больше чем на 0.5px. Легальные
// состояния (визуальный низ РОВНО на линии: спавн входа, полоса выхода)
// не триггерят — иначе клэмп спорит с шагом физики (скачок в метрике
// «шаг > velocity*dt») и с посадкой на стоп-линию.
export const FENCE_TOL = 0.5

// [№24-РУЧКА] УСТАРЕЛО: приоткрытие полотна при разблокировке убрано по
// правке заказчика — замок теперь показывает только ручка (поворот на 90°
// против часовой + красный -> зелёный, см. generateWicketSVG и main.css).
// Константа оставлена для совместимости старых тестов/сцен, будет удалена.
export const WICKET_AJAR_SCALE = 0.86
// [№21-КАЛИТКА-В-ЖИЗНИ] если после разблокировки её никто не открыл,
// калитка захлопывается сама через 15 с (репорт №21: «например через
// 15 секунд»).
export const WICKET_AJAR_TIMEOUT_S = 15

// Y-центр машины, стоящей на ЛИНИИ ОЖИДАНИЯ ВЪЕЗЖАЮЩИХ (бампер в 6 px над
// линией дороги F — та же формула, что stop въезда: roadY - STANDOFF).
export const exitWaitCenterY = (
  gate: { x: number; y: number; width: number; height: number },
  carHeight: number,
): number => gate.y + gate.height - carHeight / 2 - STOP_STANDOFF_ENTER

export interface GateAgentView {
  id: string | number
  type: string
  direction: 'enter' | 'exit'
  state: string
  element: { x: number; y: number; width: number; height: number }
  target?: { x?: number; y?: number }
}

// [№20-1] Занята ли полоса у ворот для ВЫЕЗЖАЮЩЕЙ машины: встречная
// (въезжающая) машина стоит на линии ожидания или ПОДЪЕЗЖАЕТ к ней — её
// корпус ИЛИ ЦЕЛЬ (стоп-точка) в коридоре оси ворот. Пока занята —
// выезжающая ждёт «вверху» (на глубокой посадке), освобождая полосу.
export const exitLaneBusy = (
  agents: GateAgentView[],
  me: GateAgentView,
  gate: { x: number; y: number; width: number; height: number },
): boolean => {
  const gcx = gate.x + gate.width / 2
  const lineY = gate.y + gate.height - 20 - STOP_STANDOFF_ENTER // окна не зависят от высоты корпуса
  for (const o of agents) {
    if (o.id === me.id || o.type !== 'car' || o.direction === me.direction || o.state === 'done') continue
    const ocx = o.element.x + o.element.width / 2
    const ocy = o.element.y + o.element.height / 2
    // корпус в коридоре линии...
    if (Math.abs(ocx - gcx) < GATE_AXIS_WINDOW && Math.abs(ocy - lineY) < LANE_WINDOW) return true
    // ...или ЦЕЛЬ на линии (въезжающая на подходе легально претендует
    // на стоп-точку и вернётся на неё)
    const t = o.target
    if (t && Number.isFinite(t.x) && Number.isFinite(t.y) &&
        Math.abs((t.x ?? 0) - gcx) < GATE_AXIS_WINDOW && Math.abs((t.y ?? 0) - lineY) < LANE_WINDOW) return true
  }
  return false
}

// [№20-2] Хочет ли ВЫЕЗЖАЮЩАЯ машина выехать «прямо сейчас»: стоит у створа
// с базовой стороны (to_gate/waiting_before), идёт к нему, или уже проходит
// (crossing) в коридоре оси. Въезжающая на посадке обязана освободить ось —
// уезд налево без ожидания закрытия ворот.
export const exitPendingFor = (
  agents: GateAgentView[],
  me: GateAgentView,
  gate: { x: number; y: number; width: number; height: number },
): boolean => {
  const gcx = gate.x + gate.width / 2
  const gBottom = gate.y + gate.height
  for (const o of agents) {
    if (o.id === me.id || o.type !== 'car' || o.direction !== 'exit' || o.state === 'done') continue
    const ocx = o.element.x + o.element.width / 2
    if (Math.abs(ocx - gcx) > GATE_AXIS_WINDOW) continue
    if (o.state === 'crossing') return true
    if (o.state === 'to_gate' || o.state === 'waiting_before') {
      const ocy = o.element.y + o.element.height / 2
      if (ocy > gBottom - 10) return true
    }
  }
  return false
}

// [№20-УЕЗД] Свободна ли дорога на стороне уезда выезжающей: встречная
// въезжающая машина на полосе дороги между мной и краем — уезжаем в
// другую сторону (реальная машина не выезжает под встречный поток).
export const roadSideBusyForDeparture = (
  agents: GateAgentView[],
  me: GateAgentView,
  gate: { x: number; y: number; width: number; height: number },
  sceneWidth: number,
  side: 'left' | 'right',
): boolean => {
  const lineY = gate.y + gate.height - 20 - STOP_STANDOFF_ENTER
  const myCx = me.element.x + me.element.width / 2
  for (const o of agents) {
    if (o.id === me.id || o.type !== 'car' || o.direction !== 'enter' || o.state === 'done') continue
    if (o.state !== 'to_gate' && o.state !== 'waiting_before' && o.state !== 'moving_away') continue
    const ocx = o.element.x + o.element.width / 2
    const ocy = o.element.y + o.element.height / 2
    if (Math.abs(ocy - lineY) >= 40) continue
    if (side === 'right' ? (ocx > myCx + 10 && ocx < sceneWidth + 80) : (ocx < myCx - 10 && ocx > -80)) return true
  }
  return false
}

// [№20-3б] Ограничитель БОКОВЫХ толчков: дрейф «держись правее», шаг
// уступания и сепарация не должны выносить корпус человека НА линию
// забора (straddle) в зоне калитки — иначе толчок вниз и мягкий клэмп
// вверх борются за пиксели, и человек дёргается туда-сюда (реверсы).
// Проём не исключение: сквозь дверь человека переносит только его ХОД
// (к цели), не толчки. Возвращает безопасный Y для кадра.
export const limitPersonPushY = (
  el: { x: number; y: number; width: number; height: number; settings?: Record<string, unknown> },
  gate: { x: number; y: number; width: number; height: number },
  nextY: number,
): number => {
  const f = gate.y + gate.height
  const cx = el.x + el.width / 2
  const gcx = gate.x + gate.width / 2
  const zone = Math.max(gate.width, 40) / 2 + 45
  if (Math.abs(cx - gcx) > zone) return nextY
  const footPad = (el.settings as any)?.footPad ?? 2
  const bottomNow = el.y + el.height - footPad
  const bottomNext = nextY + el.height - footPad
  const straddleNext = nextY < f - FENCE_TOL && bottomNext > f + FENCE_TOL
  if (!straddleNext) return nextY
  // над линией — не пускаем ниже кромки (визуальный низ на линии + допуск)
  if (bottomNow <= f + FENCE_TOL) return f + FENCE_TOL - el.height + footPad
  // под линией — не пускаем выше кромки (верх на линии - допуск)
  if (el.y >= f - FENCE_TOL) return f - FENCE_TOL
  // уже перекрыт прошлыми кадрами — вернёт мягкий клэмп
  return nextY
}

// [№23-ДУГА] Короткий отход человека от линии забора перед заходом в
// проём: если ведущая кромка уже прижата к линии (уступание у самого
// забора), сначала отходим на чистый корпус, потом скользим к оси —
// кромка на линию не давит (репорт №23).
export const WICKET_ARC_PULLBACK = 10

// [№23-ДУГА] Плавная дуга прохода смещённого (уступанием) человека в створ
// калитки. Квадратичная Безье из текущей точки в точку (axisX, clearY):
// контрольная точка — на оси проёма на высоте старта, поэтому боковая
// часть дуги не прижимается к забору, а вертикальный проход начинается
// на чистом корпусе. clearY — за APERTURE_INSET (6px) до касания линии
// забора ведущей кромкой (нижней при ходе вниз, верхней при ходе вверх).
// Человек у самой линии забора сначала коротко отходит от неё
// (WICKET_ARC_PULLBACK), затем скользит вдоль линии и заходит в проём —
// створ не задевается ни при каком смещении (репорт №23, п.3/п.4).
// Возвращает очередь точек-целей (кладётся в crossArcByAgentId): скорость
// между точками не обнуляется, сквозная exitPoint замыкает очередь в
// вызывающем коде. Человек на оси (смещение <= 2px) дуги не получает —
// фильтруется вызывающим кодом.
export const buildWicketArcPoints = (
  startX: number,
  startY: number,
  axisX: number,
  exitY: number,
  fenceY: number,
  radius: number,
): { x: number; y: number }[] => {
  if (![startX, startY, axisX, exitY, fenceY, radius].every(Number.isFinite)) return []
  // Направление прохода: вниз (въезд, exitY ниже старта) или вверх (выезд)
  const dir: 1 | -1 = exitY >= startY ? 1 : -1
  // Граница чистого корпуса: ведущая кромка (низ при ходе вниз, верх при
  // ходе вверх) останавливается за 6px до линии забора
  const clearY = dir > 0
    ? fenceY - radius - APERTURE_INSET
    : fenceY + radius + APERTURE_INSET
  // Кромка уже за границей (человек у самой линии забора): короткий отход
  // прочь от линии, скольжение вдоль неё на чистом корпусе, заход в проём
  const pastBoundary = dir > 0 ? startY > clearY : startY < clearY
  const fromY = pastBoundary ? clearY - dir * WICKET_ARC_PULLBACK : startY
  // Квадратичная Безье: P0 = (startX, fromY), P1 = (ось, fromY) —
  // контрольная на оси на высоте старта, P2 = (ось, clearY)
  const p0x = startX
  const p0y = fromY
  const p2x = axisX
  const p2y = clearY
  const len = Math.hypot(p2x - p0x, p2y - p0y)
  const n = Math.min(16, Math.max(6, Math.round(len / 10)))
  const pts: { x: number; y: number }[] = []
  if (pastBoundary) pts.push({ x: startX, y: fromY })
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    pts.push({
      x: mt * mt * p0x + 2 * t * mt * axisX + t * t * p2x,
      y: mt * mt * p0y + 2 * t * mt * fromY + t * t * p2y,
    })
  }
  return pts
}

// [№20-3] Забор по краям калитки: корпус человека не пересекает линию
// забора F вне проёма калитки. Толкания/уступания у калитки больше не
// выносят человека за забор — он скользит вдоль линии, пока не придёт на
// ось проёма, и только тогда проходит. Во время crossing (легальный проход
// по оси) клэмп не применяется — путь прохода и так вертикален в проёме.
//
// Коррекция МЯГКАЯ (скорость ограничена, «толчок», а не телепорт):
//  • сторона возврата — сторона ЦЕЛИ человека (он принадлежит там, куда
//    идёт; вышедший из проёма с дрейфом возвращается на свою полосу, а не
//    заталкивается через забор назад);
//  • темп = PERSON_SEP_SPEED + 2px/с за каждый px глубины, кап 9px/тик —
//    в пределах допуска «толчков сепарации» соука и незаметен глазу.
export const clampPersonToFence = (
  el: { x: number; y: number; width: number; height: number; settings?: Record<string, unknown> },
  gate: { x: number; y: number; width: number; height: number },
  targetY?: number,
  dt: number = 0.1,
): void => {
  const f = gate.y + gate.height
  const cx = el.x + el.width / 2
  // Клэмп действует в ЗОНЕ калитки (полширины + запас на корпус и толчок):
  // уходящий по дороге человек за пределами зоны идёт к своей цели без
  // борьбы с клэмпом — иначе точка посадки и клэмп спорят за пиксели.
  const gcx = gate.x + gate.width / 2
  const zone = Math.max(gate.width, 40) / 2 + 45
  if (Math.abs(cx - gcx) > zone) return
  if (cx >= gate.x + APERTURE_INSET && cx <= gate.x + gate.width - APERTURE_INSET) return
  // «На заборе» = корпус НАКРЫВАЕТ линию (верх выше линии, визуальный низ
  // ниже линии с учётом подошвенной поправки SVG). Лёгкое касание (низ
  // ровно на линии — спавн входа, полоса выхода) легально.
  const footPad = (el.settings as any)?.footPad ?? 2
  const visualBottom = el.y + el.height - footPad
  const straddles = el.y < f - FENCE_TOL && visualBottom > f + FENCE_TOL
  if (!straddles) return
  const cy = el.y + el.height / 2
  const toAbove = (targetY !== undefined && Number.isFinite(targetY)) ? (targetY as number) < f : cy < f
  const wantY = toAbove ? f - footPad - el.height : f
  const dy = wantY - el.y
  if (Math.abs(dy) < 0.5) return
  const depth = Math.min(Math.abs(dy), el.height)
  const cap = Math.min(9, (34 + 2 * depth) * dt)
  el.y += Math.sign(dy) * Math.min(Math.abs(dy), cap)
}
