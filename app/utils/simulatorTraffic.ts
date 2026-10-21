// app/utils/simulatorTraffic.ts
// Назначение: ЕДИНАЯ геометрия траекторий агентов (спавн/остановка/проход/уход),
// выводимая ИЗ ПРЯМОУГОЛЬНИКА ВОРОТ, плюс валидация оффсетов, настроенных
// пользователем в редакторе сцен.
//
// [КАНОНИЧЕСКАЯ СХЕМА — «как раньше»] Забор ГОРИЗОНТАЛЬНЫЙ (полоса ворот на
// одной высоте Y), город СВЕРХУ, база СНИЗУ. Вдоль городской стороны забора
// идёт дорога: агенты приезжают/приходят СБОКУ (от правого края сцены) по
// линии дороги, останавливаются у ворот, проходят через них ПОПЕРЁК забора
// (короткий вертикальный участок) и уходят:
//   ВХОД:  спавн за ПРАВЫМ краем на линии дороги -> стоп у ворот (ноги/бампер
//          на нижней линии ворот) -> проход ВНИЗ сквозь ворота -> уход за
//          нижний край сцены (X = центр ворот).
//   ВЫХОД: спавн за НИЖНИМ краем (X = центр ворот) -> стоп под воротами ->
//          проход ВВЕРХ сквозь ворота -> уход ВБОК по дороге за правый край.
//
// [ПОЧЕМУ ТАК] Версия dc00af2 выводила из геометрии ворот ОСЬ ПОТОКА и гнала
// агентов сверху вниз/снизу вверх через ВСЮ сцену: машины ехали «на капоте»
// (поворот по вертикальному курсу), прибывающие спавнились сверху вместо
// сбоку, уходящие уезжали вверх вместо вбок, подход к линии ворот шёл выше
// линии. Пользователь подтвердил: правильная схема — прежняя, «сбоку по
// дороге». Теперь схема ФИКСИРОВАННАЯ (описана выше), а не выводимая из
// пропорций ворот.
//
// Линия дороги: визуальный низ агента (подошва ног / бампер) на НИЖНЕЙ линии
// ворот gate.y + gate.height — приходящие стоят НА линии забора, не выше и
// не ниже (проверено пользователем: «уровень ног не ниже нижней линии»,
// «не слишком высоко»).
//
// Оффсеты из gate.settings (spawn*/stop*/cross*/despawn* + X/Y) ПРИНИМАЮТСЯ
// только если точка лежит на правильной стороне для своей роли В ЭТОЙ СХЕМЕ:
// спавн входа — за боковым краем, стоп — у ворот, уход входа — за нижним
// краем, спавн выхода — за нижним краем, уход выхода — за боковым краем.
// Устаревшие точки (например, spawnExit сверху) молча заменяются геометрией.

import { PERSON_STOP_OFFSET, CAR_STOP_OFFSET } from './simulatorConstants'


export interface TrafficPoint {
  x: number
  y: number
}

// [БАГ-РЕПОРТ-4] сторона дороги для появления/уезда МАШИН: раньше все машины
// приезжали только справа и уезжали только направо. Теперь сторона выбирается
// случайно при спавне (люди остаются на канонической схеме «справа»).
export type RoadSide = 'right' | 'left'

export interface TrafficPoints {
  spawn: TrafficPoint   // ЦЕНТР агента в момент появления
  stop: TrafficPoint    // ЦЕНТР на остановке перед проходом (waiting_before)
  cross: TrafficPoint   // ЦЕНТР в конце прохода (за воротами)
  after: TrafficPoint   // ЦЕНТР точки ухода/деспавна (moving_away)
  vertical: boolean     // ОСЬ ПОДХОДА: true — колонна по Y (выход снизу),
                        // false — колонна по X (вход сбоку по дороге)
}

export interface GateRect {
  x: number
  y: number
  width: number
  height: number
  gateType?: string     // 'wicket' | 'sliding' | ... (или в settings.gateType)
  settings?: { gateType?: string } | Record<string, unknown>
}

// Поправка на «подошву»: в SVG человека обувь заканчивается на ~96.4% высоты
// (сетка 50x100, подошва 96.4). Чтобы ВИЗИУЛЬНЫЕ ноги стояли на линии земли F,
// верх спрайта ставится на F - h + FOOT_PAD_PERSON.
export const FOOT_PAD_PERSON = 2

// Глубина прохода: стоп/проход отстоят от линии дороги на величину офсета
// остановки (как в прежней схеме: cross = дорога + stopOffset).
export const crossingOffset = (isPerson: boolean): number =>
  isPerson ? PERSON_STOP_OFFSET : CAR_STOP_OFFSET


// [БАГ-РЕПОРТ-5-ВЫШЕ-ШЛАГБАУМА][БАГ-РЕПОРТ-6-НИЖЕ] выехавшая машина ждёт
// полного закрытия ворот НЕ в проёме (раньше центр ровно на линии дороги —
// «в шлагбауме»), а чуть дальше по ходу выезда — выше линии дороги.
// 60px пользователь забраковал («останавливается слишком высоко»).
// [СПЕЦ-Z7/E4] было 40: корпуса касались (полосa = высота корпуса над
// дорогой). Подъём остановки въезда на 6px (STOP_STANDOFF_ENTER) наложил бы
// въезжающую на полосу на 6px — полоса поднята до 46, инвариант E4
// «касание без пересечения» сохранён (зазор полусумм 40 + 6).
export const CAR_EXIT_PULL_PAST = 46

// [СПЕЦ-Z5/Z7] стоящий у прохода агент НЕ прижат к линии забора: визуальный
// низ спрайта (подошва/бампер) — на 6 px ВЫШЕ линии дороги F. По правке
// заказчика в спецификации: «в жизни не встают впритык к линии».
// Действует на остановку waiting_before ВЪЕЗДА (машина и человек).
export const STOP_STANDOFF_ENTER = 6
// [СПЕЦ-Z8] остановка ВЫЕЗДА: бампер (верх спрайта) на 10 px НИЖЕ линии F
// со стороны базы — не доезжая линии, зеркально «не впритык».
export const STOP_STANDOFF_EXIT = 10

interface RawPoint { x?: number; y?: number }

// Чтение настроенных оффсетов. Ключ редактора включает тип агента
// (stopEnterPersonY, spawnExitCarX...), а конвенция маркера редактора такова,
// что ЦЕНТР маркера = центр ворот + оффсет — возвращаем ЦЕНТР агента.
const readConfigured = (
  gate: GateRect,
  key: string,
  size: { width: number; height: number },
): RawPoint | undefined => {
  const kind = size.height > size.width ? 'Person' : 'Car'
  const sx = (gate as any).settings?.[`${key}${kind}X`]
  const sy = (gate as any).settings?.[`${key}${kind}Y`]
  const hasX = sx !== undefined && sx !== null && !isNaN(sx)
  const hasY = sy !== undefined && sy !== null && !isNaN(sy)
  if (!hasX && !hasY) return undefined
  const cx = gate.x + gate.width / 2
  const cy = gate.y + gate.height / 2
  return {
    x: hasX ? cx + Number(sx) : undefined,
    y: hasY ? cy + Number(sy) : undefined,
  }
}

export interface ValidateCtx {
  vertical: boolean
  gate: GateRect
  size: { width: number; height: number }
  scene: { width: number; height: number }
}

// Валидация точки «по роли» в канонической схеме. Точка — ЦЕНТР агента.
// Дорога: визуальный низ агента на нижней линии ворот (город сверху).
export const isValidPoint = (
  role: 'spawn' | 'stop' | 'cross' | 'after',
  direction: 'enter' | 'exit',
  p: TrafficPoint,
  ctx: ValidateCtx,
): boolean => {
  const { gate, size, scene } = ctx
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
  const isPerson = size.height > size.width
  const pad = isPerson ? FOOT_PAD_PERSON : 0
  const gateTop = gate.y
  const gateBottom = gate.y + gate.height
  const gateCx = gate.x + gate.width / 2
  // визуальный низ спрайта (подошва/бампер) из центра
  const spriteBottom = p.y + size.height / 2 - pad
  const spriteTop = p.y - size.height / 2
  const nearGateX = Math.abs(p.x - gateCx) <= Math.max(120, gate.width)
  const offSideX = p.x < -20 || p.x > scene.width + 20      // за боковым краем
  const offBottom = p.y > scene.height + 20                 // за нижним краем
  // полоса дороги: визуальный низ агента в ±20px от нижней линии ворот —
  // отсекает устаревшие точки «вертикальной схемы» (спавн сверху, стоп у верха)
  const onRoad = Math.abs(spriteBottom - gateBottom) <= 20

  if (direction === 'enter') {
    switch (role) {
      case 'spawn': return offSideX && onRoad
      case 'stop':  return nearGateX && onRoad
      case 'cross': return nearGateX && spriteBottom >= gateBottom - 10
      case 'after': return offBottom
      default: return false
    }
  }
  switch (role) {
    case 'spawn': return offBottom
    case 'stop':  return nearGateX && spriteTop >= gateTop - 20
    case 'cross': return nearGateX && spriteBottom <= gateBottom + 10
    case 'after': return offSideX
    default: return false
  }
}

// Геометрический вывод четырёх точек из прямоугольника ворот.
// ВСЕ точки — ЦЕНТР агента (физика центрирует элемент на цели, маркер
// редактора — тоже центровый). Линия дороги F = gate.y + gate.height:
// визуальный низ агента (подошва/бампер) на F.
//   enter: спавн за правым краем -> стоп у ворот -> проход вниз на стоп-офсет
//          -> уход за нижний край; колонна группы по X (подход сбоку).
//   exit:  спавн за нижним краем -> стоп под воротами (дорога + офсет) ->
//          проход вверх К линии дороги -> уход вбок за правый край;
//          колонна группы по Y (подход снизу).
export const deriveTrafficPoints = (
  gate: GateRect,
  size: { width: number; height: number },
  direction: 'enter' | 'exit',
  scene: { width: number; height: number },
  side: RoadSide = 'right',
): TrafficPoints => {
  const isPerson = size.height > size.width   // человек 40x55, машина 80x40
  const footPad = isPerson ? FOOT_PAD_PERSON : 0
  const off = crossingOffset(isPerson)
  const cx = gate.x + gate.width / 2
  const roadY = gate.y + gate.height - size.height / 2 + footPad  // центр на дороге
  // [БАГ-РЕПОРТ-4] боковой край по выбранной стороне: справа — за правым
  // краем сцены, слева — за левым. Для людей вызывающий код оставляет 'right'.
  const edgeX = side === 'right'
    ? scene.width + 60 + size.width / 2
    : -60 - size.width / 2

  if (direction === 'enter') {
    return {
      vertical: false,
      spawn: { x: edgeX, y: roadY },
      // [СПЕЦ-Z5/Z7] стоим на 6 px выше линии дороги (не впритык к забору)
      stop:  { x: cx, y: roadY - STOP_STANDOFF_ENTER },
      cross: { x: cx, y: roadY + off },
      after: { x: cx, y: scene.height + 80 + size.height / 2 },
    }
  }
  // [БАГ-РЕПОРТ-5] у машины и точка ожидания закрытия ворот, и линия уезда
  // подняты выше дороги (CAR_EXIT_PULL_PAST): ждёт ЗА шлагбаумом, уезжает
  // строго вбок по своей полосе, не пересекая дорогу. У человека без
  // изменений: ноги на линии дороги.
  const exitY = isPerson ? roadY : roadY - CAR_EXIT_PULL_PAST
  return {
    vertical: true,
    spawn: { x: cx, y: scene.height + 60 + size.height / 2 },
    // [БАГ-РЕПОРТ-8-СТОП] стоп выезжающей машины - ЗЕРКАЛЬНО въезжающей:
    // передний край (верх спрайта) у линии ворот. Раньше центр был
    // на roadY + off (58): бампер недоезжал 18px до линии - на фоне
    // въезжающих (бампер ВПРИТИРКУ) выезжающая "останавливается далеко".
    // roadY + высота корпуса = gBottom + h/2: верх спрайта на линии.
    // [СПЕЦ-Z8] по правке заказчика бампер НЕ впритык: на 10 px ниже линии F
    // со стороны базы (STOP_STANDOFF_EXIT).
    // У человека без изменений (thin-корпус не читается как "далеко").
    stop: isPerson
      ? { x: cx, y: roadY + off }
      : { x: cx, y: roadY + size.height + STOP_STANDOFF_EXIT },
    cross: { x: cx, y: exitY },
    after: { x: edgeX, y: exitY },
  }
}

// Ключи настроек редактора для каждой роли точки
const ROLE_PREFIX: Record<string, string> = {
  'spawn:enter': 'spawnEnter', 'stop:enter': 'stopEnter',
  'cross:enter': 'crossEnter', 'after:enter': 'despawnEnter',
  'spawn:exit': 'spawnExit', 'stop:exit': 'stopExit',
  'cross:exit': 'crossExit', 'after:exit': 'despawnExit',
}

// Итоговые точки: настроенные оффсеты (валидные по стороне) поверх геометрии.
export const trafficPointsFor = (
  gate: GateRect & { settings?: Record<string, unknown> },
  size: { width: number; height: number },
  direction: 'enter' | 'exit',
  scene: { width: number; height: number },
  side: RoadSide = 'right',
): TrafficPoints => {
  const derived = deriveTrafficPoints(gate, size, direction, scene, side)
  const ctx: ValidateCtx = { vertical: derived.vertical, gate, size, scene }

  const apply = (roleName: 'spawn' | 'stop' | 'cross' | 'after'): TrafficPoint => {
    const raw = readConfigured(gate, ROLE_PREFIX[`${roleName}:${direction}`] ?? 'spawnEnter', size)
    if (!raw) return derived[roleName]
    const merged: TrafficPoint = {
      x: raw.x !== undefined ? raw.x : derived[roleName].x,
      y: raw.y !== undefined ? raw.y : derived[roleName].y,
    }
    return isValidPoint(roleName, direction, merged, ctx) ? merged : derived[roleName]
  }

  return {
    vertical: derived.vertical,
    spawn: apply('spawn'),
    stop: apply('stop'),
    cross: apply('cross'),
    after: apply('after'),
  }
}
