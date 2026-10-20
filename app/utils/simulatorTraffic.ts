// app/utils/simulatorTraffic.ts
// Назначение: ЕДИНАЯ геометрия траекторий агентов (спавн/остановка/проход/уход),
// выводимая ИЗ ПРЯМОУГОЛЬНИКА ВОРОТ, плюс валидация оффсетов, настроенных
// пользователем в редакторе сцен.
//
// [ПОЧЕМУ ЭТО ПОЯВИЛОСЬ] Прежние фолбэки были написаны под старую «горизонтальную»
// схему (дорога слева-направо у линии забора): входящие спавнились у ПРАВОГО края
// и шли вдоль забора по линии y ≈ 180-187, выходящие после прохода уходили вбок
// вдоль ВЕРХА сцены. На вертикальной сцене пользователя (город сверху, база снизу,
// забор горизонтально) это выглядело так: «приходят слишком высоко», «выходящие
// появляются сверху», «застревают внизу». Теперь канонический поток — ВЕРТИКАЛЬНЫЙ:
//   город СВЕРХУ  ->  вход: спавн за верхним краем -> остановка над калиткой ->
//                    проход ВНИЗ -> уход за нижний край;
//   база СНИЗУ    ->  выход: спавн за нижним краем -> остановка под калиткой ->
//                    проход ВВЕРХ -> уход за верхний край.
// Ось прохода определяется по геометрии самих ворот:
//   - калитка (дверь): выше, чем шире  -> проход вдоль её ВЫСОТЫ (вертикальный);
//   - ворота/шлагбаум: шире, чем выше  -> забор горизонтален -> проход тоже
//     вертикальный (поперёк линии забора, вдоль высоты элемента);
//   - вертикальный забор (ворота выше, чем шире) -> горизонтальный поток
//     (город слева, база справа) — обратная совместимость со старыми сценами.
//
// Оффсеты из gate.settings (spawn*/stop*/cross*/despawn* + X/Y) ПРИНИМАЮТСЯ
// только если точка лежит на правильной стороне ворот для своей роли.
// Устаревшие/случайные точки (например, spawnExit сверху) молча заменяются
// геометрическими — именно они давали «спавн не с той стороны».


export interface TrafficPoint {
  x: number
  y: number
}

export interface TrafficPoints {
  spawn: TrafficPoint   // ЦЕНТР агента в момент появления
  stop: TrafficPoint    // ЦЕНТР на остановке перед проходом (waiting_before)
  cross: TrafficPoint   // ЦЕНТР в конце прохода (за воротами)
  after: TrafficPoint   // ЦЕНТР точки ухода/деспавна (moving_away)
  vertical: boolean     // true — поток идёт по вертикали (сверху вниз / снизу вверх)
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

// Вертикален ли поток через эти ворота (см. шапку файла)
export const isVerticalFlow = (gate: GateRect): boolean => {
  const w = gate.width || 1
  const h = gate.height || 1
  const type = gate.gateType ?? (gate.settings as any)?.gateType
  const isWicket = type === 'wicket' || w <= 60
  // калитка-дверь: выше, чем шире -> вертикальный проход;
  // ворота/шлагбаум: шире, чем выше -> горизонтальный забор -> проход вертикальный
  return isWicket ? h >= w : w >= h
}

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

// Валидация точки «по роли»: правильная сторона ворот + внятный X/Y.
// Точка — ЦЕНТР агента. Вертикальный поток: город сверху, база снизу.
export const isValidPoint = (
  role: 'spawn' | 'stop' | 'cross' | 'after',
  direction: 'enter' | 'exit',
  p: TrafficPoint,
  ctx: ValidateCtx,
): boolean => {
  const { gate, size, vertical } = ctx
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
  const gateTop = gate.y
  const gateBottom = gate.y + gate.height
  const gateLeft = gate.x
  const gateRight = gate.x + gate.width
  // края спрайта из центра
  const spriteBottom = p.y + size.height / 2
  const spriteTop = p.y - size.height / 2
  const spriteRight = p.x + size.width / 2
  const spriteLeft = p.x - size.width / 2
  const nearX = Math.abs(p.x - (gate.x + gate.width / 2)) <= Math.max(80, gate.width) + 60
  const nearY = Math.abs(p.y - (gate.y + gate.height / 2)) <= Math.max(80, gate.height) + 60
  const crossBandY = spriteBottom >= gateTop - 60 && spriteTop <= gateBottom + 120
  const crossBandX = spriteRight >= gateLeft - 60 && spriteLeft <= gateRight + 120

  if (vertical) {
    if (!nearX) return false
    switch (`${role}:${direction}`) {
      case 'spawn:enter': return spriteBottom <= gateTop + 6
      case 'stop:enter':  return spriteBottom <= gateBottom - 6
      case 'cross:enter': return crossBandY
      case 'after:enter': return spriteBottom >= gateBottom + 40
      case 'spawn:exit':  return spriteBottom >= gateBottom + 6
      case 'stop:exit':   return spriteBottom >= gateBottom + 6
      case 'cross:exit':  return crossBandY
      case 'after:exit':  return spriteTop <= gateTop - 6
      default: return false
    }
  }
  // горизонтальный поток: город слева, база справа
  if (!nearY) return false
  switch (`${role}:${direction}`) {
    case 'spawn:enter': return spriteRight <= gateLeft + 6
    case 'stop:enter':  return spriteRight <= gateLeft + 6
    case 'cross:enter': return crossBandX
    case 'after:enter': return spriteRight >= gateRight + 40
    case 'spawn:exit':  return spriteLeft >= gateRight - 6
    case 'stop:exit':   return spriteLeft >= gateRight - 6
    case 'cross:exit':  return crossBandX
    case 'after:exit':  return spriteLeft <= gateLeft - 6
    default: return false
  }
}

// Геометрический вывод четырёх точек из прямоугольника ворот.
// ВСЕ точки — ЦЕНТР агента (физика центрирует элемент на цели, маркер
// редактора — тоже центровый). vertical: вход сверху-вниз, выход
// снизу-вверх. horizontal: вход слева-направо, выход справа-налево.
// Земля человека = линия ног: визуальная подошва на линии F, т.е.
// центр.y = F - h/2 + pad (подошва на 2px выше низа спрайта).
export const deriveTrafficPoints = (
  gate: GateRect,
  size: { width: number; height: number },
  direction: 'enter' | 'exit',
  scene: { width: number; height: number },
): TrafficPoints => {
  const vertical = isVerticalFlow(gate)
  const isPerson = size.height > size.width   // человек 40x55, машина 80x40
  const footPad = isPerson ? FOOT_PAD_PERSON : 0
  const cx = gate.x + gate.width / 2
  const cy = gate.y + gate.height / 2
  const gateTop = gate.y
  const gateBottom = gate.y + gate.height
  const gateLeft = gate.x
  const gateRight = gate.x + gate.width

  // центр по линии ног F: visualFeet = centerY + h/2 - pad = F
  const yAtFeet = (feet: number): number => feet - size.height / 2 + footPad

  if (vertical) {
    if (direction === 'enter') {
      return {
        vertical,
        spawn: { x: cx, y: -(size.height / 2 + 60) },
        stop: { x: cx, y: yAtFeet(gateTop - 10) },
        cross: { x: cx, y: yAtFeet(gateBottom + 26) },
        after: { x: cx, y: scene.height + 80 + size.height / 2 },
      }
    }
    return {
      vertical,
      spawn: { x: cx, y: scene.height + 60 + size.height / 2 },
      stop: { x: cx, y: yAtFeet(gateBottom + 30) },
      cross: { x: cx, y: yAtFeet(gateTop - 26) },
      after: { x: cx, y: -(size.height / 2 + 80) },
    }
  }

  // горизонтальный поток
  const yCenter = cy
  if (direction === 'enter') {
    return {
      vertical,
      spawn: { x: -(size.width / 2 + 60), y: yCenter },
      stop: { x: gateLeft - 10 - size.width / 2, y: yCenter },
      cross: { x: gateRight + 26 + size.width / 2, y: yCenter },
      after: { x: scene.width + 80 + size.width / 2, y: yCenter },
    }
  }
  return {
    vertical,
    spawn: { x: scene.width + 60 + size.width / 2, y: yCenter },
    stop: { x: gateRight + 16 + size.width / 2, y: yCenter },
    cross: { x: gateLeft - 10 - size.width / 2, y: yCenter },
    after: { x: -(size.width / 2 + 80), y: yCenter },
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
): TrafficPoints => {
  const derived = deriveTrafficPoints(gate, size, direction, scene)
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
