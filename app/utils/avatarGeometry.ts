// app/utils/avatarGeometry.ts
// Назначение: ЕДИНАЯ геометрия и математика ходьбы персонажа (логическая сетка 50x100).
// Потребители: PersonAvatar.vue (конструктор/редактор, rAF-анимация)
// и personSvgRenderer.ts (симулятор, CSS-keyframes-анимация).
// Раньше оба рендерера дублировали числа руками и расходились: конструктор
// рисовал одного персонажа, симулятор — другого. Теперь обе стороны берут
// координаты отсюда, поэтому «подогнанность» частей тела гарантирована везде.
//
// Инварианты, проверяемые тестами (tests/avatar-geometry.test.ts):
//  1. Плечевой сустав сидит на краю торса при любом bodyWidth (рука не висит в воздухе).
//  2. Бедренный сустав внутри силуэта бёдер (верх ноги прикрыт торсом).
//  3. Ботинок перекрывает торец ноги (нет зазора «нога кончается, обувь отдельно»).
//  4. Шея соединяет голову и торс (перекрытие с обеими сторонами).
//  5. walkPose: ноги/руки в противофазе, стопа отрывается только в фазе переноса.
//  6. Ни один сгенерированный путь не содержит NaN/undefined.

export const TAU = Math.PI * 2

// [НАСТРОЙКА] Длительность полного цикла ходьбы (2 шага) при animation.speed = 1.
// Раньше конструктор давал 1.57 с (4 рад/с), а симулятор — 1.5 с; сведено к 1.1 с
// (ближе к реальному темпу ~1.8 шага/с), обе стороны считают от одной константы.
export const WALK_BASE_CYCLE_S = 1.1

// Пересчёт слайдеров конструктора в градусы/пиксели
export const LEG_DEG_PER_UNIT = 2.2   // «Размах» 0..10  -> до ±22°
export const ARM_DEG_PER_UNIT = 0.9   // «Взмах рук» 0..25 -> до ±22.5°
export const FOOT_LIFT_PX_PER_UNIT = 0.9
export const BOUNCE_PX_PER_UNIT = 0.5 // «Подскок» 0..8   -> до 4 px

export interface AvatarLook {
  gender?: 'male' | 'female'
  ageGroup?: 'child' | 'adult' | 'elder'
  skinTone?: string
  eyeColor?: string
  hairColor?: string
  hairStyleId?: string
  hasRecedingHairline?: boolean
  facialHair?: string
  headwear?: string
  headwearColor?: string
  glasses?: string
  clothingStyle?: string
  topColor?: string
  bottomColor?: string
  skirtColor?: string
  shoeColor?: string
  bodyWidth?: number
  faceWidth?: number
  animation?: {
    speed?: number
    swingAmplitude?: number
    bounceAmplitude?: number
    armSwing?: number
  }
}

// Направление наружу от центра: правая сторона = +1, левая = -1
type Side = 1 | -1

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Снап к нулю: sin/cos дают мусор вида 2.7e-15, который иначе попадает
// в SVG-строки (translateY(0.000000000000003px)) и ломает точные сравнения
const snap = (v: number): number => (Math.abs(v) < 1e-9 ? 0 : v)

// Затемнение HEX-цвета (капюшон/пиджак/рукава)
export const darkenColor = (hex: string, amount: number): string => {
  const clean = (hex || '#000000').replace('#', '')
  const r = Math.max(0, parseInt(clean.substring(0, 2), 16) - amount)
  const g = Math.max(0, parseInt(clean.substring(2, 4), 16) - amount)
  const b = Math.max(0, parseInt(clean.substring(4, 6), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export interface ArmGeom {
  shoulderX: number
  shoulderY: number
  stroke: number
  pathD: string        // вся рука (кожа): плечо -> локоть -> кисть, плавная кривая
  sleeveD: string      // рукав поверх руки (цвет одежды); '' если рукава нет
  handCx: number
  handCy: number
  handR: number
  skinColor: string
  sleeveColor: string
}

export interface LegGeom {
  hipX: number
  hipY: number
  ankleY: number
  stroke: number
  color: string
  shoeD: string
  shoeColor: string
}

export interface AvatarGeometry {
  isFemale: boolean
  clothingStyle: string
  skin: string
  head: { cx: number; cy: number; rx: number; ry: number }
  neck: { x: number; y: number; w: number; h: number }
  torso: { top: number; bottom: number; l: number; r: number; w: number }
  femaleTorsoPath: string
  armBack: ArmGeom
  armFront: ArmGeom
  legBack: LegGeom
  legFront: LegGeom
  hipL: number
  hipR: number
  wL: number
  wR: number
  skirtPathD: string
  dressPathD: string
  suit: {
    color: string
    backD: string
    jacketFrontD: string
    shirtD: string
    tieKnotD: string
    tieBladeD: string
    lapelLD: string
    lapelRD: string
  }
  hood: { backD: string; rimD: string; color: string }
}

// --- Геометрия статичной фигуры (без фазы ходьбы) ---
export const computeAvatarGeometry = (look: AvatarLook): AvatarGeometry => {
  const isFemale = look.gender === 'female'
  const clothingStyle = look.clothingStyle || 'standard'
  const skin = look.skinTone || '#fbbf24'
  const topColor = look.topColor || '#3b82f6'
  const bottomColor = look.bottomColor || '#1e293b'
  const shoeColor = look.shoeColor || '#1f2937'
  const bodyWidth = clamp(look.bodyWidth || 1, 0.8, 1.2)
  const faceWidth = clamp(look.faceWidth || 1, 0.8, 1.2)

  // --- Торс ---
  const torsoW = 12 * bodyWidth
  const torso = { top: 32, bottom: 66, l: 25 - torsoW, r: 25 + torsoW, w: torsoW }

  // --- Голова и шея ---
  // Голова чуть меньше прежней (11x13 -> 10.5x12.5): пропорция к торсу 24
  // ближе к естественной (раньше голова была почти шириной с плечи).
  const head = { cx: 25, cy: 17.5, rx: 10.5 * faceWidth, ry: 12.5 }
  // Шея-прямоугольник: верх прячется под подбородком (низ головы ~30),
  // низ перекрывается торсом (32) — стык без щели при любом наклоне.
  const neck = { x: 25 - 2.2, y: 26.5, w: 4.4, h: 7.5 }

  // --- Руки ---
  // [ФИКС ПОДГОНКИ] Раньше плечо висело на фиксированном отступе (25±10),
  // и при bodyWidth < 1 рука отрывалась от сузившегося торса.
  // Теперь плечевой сустав привязан к краю торса: внешний край кисти-штриха
  // совпадает с краем торса (torsoW - stroke/2), рука «обнимает» корпус.
  // [ФИКС-ПРОПОРЦИИ] рука удлинена (кисть 55.5 -> 60.5): раньше кисть
  // заканчивалась ВЫШЕ линии бёдер (63.5) — руки выглядели короткими.
  // Теперь запястье на линии бёдер, кончики пальцев у середины бедра —
  // естественная пропорция (локоть ~талия, кисть ~бедро).
  const armStroke = 4.6
  const armHalfSpan = Math.max(5.2, torsoW - armStroke / 2)
  const shoulderY = 38
  const elbowY = 49.5
  const handY = 60.5

  const makeArm = (side: Side): ArmGeom => {
    const shoulderX = 25 + side * armHalfSpan
    // Лёгкий естественный изгиб руки наружу (кривая через локоть)
    const pathD =
      `M${shoulderX} ${shoulderY} ` +
      `Q${shoulderX + side * 2.4} ${(shoulderY + elbowY) / 2} ` +
      `${shoulderX + side * 1.8} ${elbowY} ` +
      `T${shoulderX + side * 1.2} ${handY}`
    // Рукав: длинный у костюма/худи, короткий у остального (футболка/платье)
    const suitColor = darkenColor(topColor, 40)
    const longSleeve = clothingStyle === 'suit' || clothingStyle === 'hoodie'
    const sleeveColor = clothingStyle === 'suit' ? suitColor : topColor
    const sleeveD = longSleeve
      ? `M${shoulderX} ${shoulderY} Q${shoulderX + side * 2.4} ${(shoulderY + elbowY) / 2} ${shoulderX + side * 1.8} ${elbowY + 1}`
      : `M${shoulderX} ${shoulderY} L${shoulderX + side * 1.3} 44`
    return {
      shoulderX,
      shoulderY,
      stroke: armStroke,
      pathD,
      sleeveD,
      handCx: shoulderX + side * 1.2,
      handCy: handY + 0.7,
      handR: 2.1,
      skinColor: skin,
      sleeveColor,
    }
  }

  // --- Ноги ---
  const hipL = 25 - torsoW * 1.1
  const hipR = 25 + torsoW * 1.1
  const wL = 25 - torsoW * 0.65
  const wR = 25 + torsoW * 0.65
  const legSpread = (isFemale ? 4 : 7) + (bodyWidth - 1) * 3
  const legStroke = isFemale
    ? (clothingStyle === 'skirt' || clothingStyle === 'dress' ? 5 : 6)
    : 7
  const legColor =
    clothingStyle === 'skirt' || clothingStyle === 'dress' ? skin : bottomColor

  // [ФИКС ПОДГОНКИ] Ботинок — не узкий эллипс, а силуэт туфли с носком наружу.
  // Верхняя кромка (90.8) заходит под торец ноги (линия до 91, круглый cap
  // ниже) — стык без зазора; носок выступает наружу на side*4.9.
  const makeShoeD = (hipX: number, side: Side): string =>
    `M${hipX - 3.4} 90.8 ` +
    `L${hipX + 3.4} 90.8 ` +
    `L${hipX + side * 4.9} 94.8 ` +
    `Q${hipX + side * 5.1} 96.4 ${hipX + side * 3.3} 96.4 ` +
    `L${hipX - side * 3.6} 96.4 ` +
    `Q${hipX - side * 4.6} 96.4 ${hipX - side * 4.6} 95.2 ` +
    `L${hipX - side * 4.6} 92.2 ` +
    `Q${hipX - side * 4.6} 90.8 ${hipX - 3.4} 90.8 Z`

  const makeLeg = (side: Side): LegGeom => {
    const hipX = 25 + side * legSpread
    return {
      hipX,
      hipY: 63.5,
      ankleY: 91,
      stroke: legStroke,
      color: legColor,
      shoeD: makeShoeD(hipX, side),
      shoeColor,
    }
  }

  // --- Женский торс (талия) ---
  const sW = torsoW * 0.85
  const sL = 25 - sW
  const sR = 25 + sW
  const bottomL = hipL + 4
  const bottomR = hipR - 4
  const femaleTorsoPath =
    `M${sL} 32 C${sL} 40 ${wL} 45 ${wL} 50 L${bottomL} 66 L${bottomR} 66 ` +
    `L${wR} 50 C${wR} 45 ${sR} 40 ${sR} 32 Z`

  // --- Юбка / платье ---
  const skirtPathD = `M${wL} 50 L${hipL - 2} 78 L${hipR + 2} 78 L${wR} 50 Z`
  const dressPathD = `M${wL - 1} 48 L${hipL - 3} 84 L${hipR + 3} 84 L${wR + 1} 48 Z`

  // --- Пиджак ---
  // [ФИКС ПОДГОНКИ] Раньше «полочки» были двумя тёмными треугольниками у краёв
  // торса. Теперь спереди цельный пиджак + рубашка + галстук + лацканы.
  const suitColor = darkenColor(topColor, 40)
  const suit = {
    color: suitColor,
    backD: `M${torso.l} 32 L25 38 ${torso.r} 32 ${torso.r} 66 ${torso.l} 66 Z`,
    jacketFrontD: `M${torso.l} 32 L${torso.r} 32 L${torso.r} 66 L${torso.l} 66 Z`,
    shirtD: 'M21.5 32 L25 46.5 L28.5 32 Z',
    tieKnotD: 'M23.9 32.4 L26.1 32.4 L25 34.4 Z',
    tieBladeD: 'M23.9 34 L26.1 34 L25.2 46.5 L24.8 46.5 Z',
    lapelLD: `M${torso.l + 1.5} 32 L25 41.5`,
    lapelRD: `M${torso.r - 1.5} 32 L25 41.5`,
  }

  // --- Капюшон ---
  // [ФИКС ПОДГОНКИ] Раньше капюшон рисовался ДО головы и был почти невидим
  // (голова перекрывала его целиком). Теперь он из двух частей: задник за
  // головой (виден по бокам и над макушкой) + ободок поверх волос.
  const hood = {
    color: darkenColor(topColor, 16),
    backD: `M13 27 Q11 6 25 4.5 Q39 6 37 27 L34.5 30.5 L15.5 30.5 Z`,
    rimD: `M14.2 13.5 Q15 4.6 25 4.2 Q35 4.6 35.8 13.5 ` +
          `Q32.5 7 25 6.6 Q17.5 7 14.2 13.5 Z`,
  }

  return {
    isFemale,
    clothingStyle,
    skin,
    head,
    neck,
    torso,
    femaleTorsoPath,
    armBack: makeArm(-1),
    armFront: makeArm(1),
    legBack: makeLeg(-1),
    legFront: makeLeg(1),
    hipL,
    hipR,
    wL,
    wR,
    skirtPathD,
    dressPathD,
    suit,
    hood,
  }
}

// --- Математика ходьбы ---
// Фаза phase измеряется в радианах, полный цикл = TAU (2 шага).
// weight (0..1) — плавный старт/стоп: амплитуды умножаются на него, поэтому
// при остановке конечности НЕ дёргаются в ноль (раньше был transition 0.3s),
// а плавно затухают.
export interface WalkPose {
  frontLeg: { angle: number; lift: number }
  backLeg: { angle: number; lift: number }
  frontArm: { angle: number }
  backArm: { angle: number }
  swayX: number
  bounceY: number
}

export const walkPose = (phase: number, look: AvatarLook, weight = 1): WalkPose => {
  const a = look.animation || {}
  const swingDeg = (a.swingAmplitude ?? 5) * LEG_DEG_PER_UNIT
  const armDeg = (a.armSwing ?? 10) * ARM_DEG_PER_UNIT
  const liftPx = (a.swingAmplitude ?? 5) * FOOT_LIFT_PX_PER_UNIT
  const bouncePx = (a.bounceAmplitude ?? 3) * BOUNCE_PX_PER_UNIT

  const s = Math.sin(phase)
  const c = Math.cos(phase)
  return {
    // Ноги в противофазе; стопа отрывается ТОЛЬКО в фазе переноса
    // (движение из заднего положения в переднее): max(0, ±cos(phase)).
    // Раньше ноги просто качались маятником вокруг бедра — «циркуль».
    // snap(): sin/cos дают мусор вида 2.7e-15 — не тащим его в SVG-строки.
    frontLeg: { angle: snap(s * swingDeg * weight), lift: snap(Math.max(0, c) * liftPx * weight) },
    backLeg: { angle: snap(-s * swingDeg * weight), lift: snap(Math.max(0, -c) * liftPx * weight) },
    // Руки — в противофазе СВОЕЙ ноге (левая рука с правой ногой)
    frontArm: { angle: snap(-s * armDeg * weight) },
    backArm: { angle: snap(s * armDeg * weight) },
    // Лёгкое покачивание корпуса в такт шагам
    swayX: snap(s * 0.6 * weight),
    // [ФИКС ФИЗИКИ] Тело НИЖЕ всего в фазе двойной опоры (ноги в крайних
    // положениях, p = PI/2, 3PI/2) и выше при вертикали опорной ноги.
    // Раньше подскок был перевёрнут (-sin^2 — вверх в двойной опоре).
    bounceY: snap(s * s * bouncePx * weight),
  }
}

// Длительность цикла с учётом пользовательской скорости
export const walkCycleDurationS = (look: AvatarLook): number =>
  WALK_BASE_CYCLE_S / Math.max(0.1, look.animation?.speed ?? 1)

// --- Общий rAF-тикер ---
// Раньше КАЖДЫЙ аватар запускал собственный requestAnimationFrame-цикл
// (в конструкторе 7+ циклов, в редакторе — по одному на фигуру). Теперь
// один общий таймер на модуль, подписчики получают dt.
type WalkTick = (dt: number) => void

const subscribers = new Set<WalkTick>()
let rafId: number | null = null
let lastTime = 0

const loop = (t: number) => {
  // Clamp dt: после сворачивания окна/лага кадр может быть «длинным» —
  // фаза ходьбы не должна прыгать
  const dt = Math.min((t - lastTime) / 1000, 0.05)
  lastTime = t
  subscribers.forEach((fn) => fn(dt))
  rafId = requestAnimationFrame(loop)
}

export const subscribeWalkTick = (fn: WalkTick): (() => void) => {
  subscribers.add(fn)
  if (rafId === null) {
    lastTime = performance.now()
    rafId = requestAnimationFrame(loop)
  }
  return () => {
    subscribers.delete(fn)
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}

// ============================================================
// ГОЛОВНОЙ МОДУЛЬ: уши, причёски, лицо, очки, растительность, уборы.
// [ФИКС ПОСАДКИ] Раньше пути причёсок были захардкожены под старую (более
// крупную) голову и масштабировались группой <g transform="scale(faceWidth)">
// — в конструкторе вокруг центра головы, а в симуляторе вокруг (0,0), из-за
// чего волосы уезжали вбок при faceWidth != 1 и висели в воздухе у висков.
// Теперь каждый путь ВЫЧИСЛЯЕТСЯ из эллипса головы (rx уже содержит
// faceWidth): причёска «сидит» на черепе при любой ширине лица, масштабные
// группы не нужны вовсе. Потребители — оба рендерера (PersonAvatar.vue и
// personSvgRenderer.ts); дубликаты путей удалены.
// ============================================================

export type AvatarHead = AvatarGeometry['head']

export interface HeadDecor {
  ears: string       // уши (рисуются ДО эллипса головы)
  hair: string       // причёска для текущего вида (+ чёлка из-под убора)
  face: string       // глаза/брови/нос/рот/ресницы (только front)
  glasses: string    // очки (только front)
  facialHair: string // усы/борода/щетина (только front)
  hat: string        // головной убор для текущего вида
}

// Форматирование числа в SVG-строке: 2 знака, без «-0»
export const fmtN = (v: number): string => {
  const r = Math.round(v * 100) / 100
  return String(Object.is(r, -0) ? 0 : r)
}

// Полуширина эллипса головы на высоте y; off — запас «толщины волос»
export const headHalfWidth = (h: AvatarHead, y: number, off = 0): number => {
  const ry = h.ry + off
  const dy = (y - h.cy) / ry
  return (h.rx + off) * Math.sqrt(Math.max(0, 1 - dy * dy))
}

// X-координата края головы на высоте y (side: -1 слева, +1 справа)
export const headEdgeX = (h: AvatarHead, y: number, side: Side, off = 0): number =>
  h.cx + side * headHalfWidth(h, y, off)

// Точка на эллипсе по углу a (градусы, y-down: -90/270 — макушка, 180 — слева)
export const headPoint = (h: AvatarHead, aDeg: number, off = 0): [number, number] => {
  const a = (aDeg * Math.PI) / 180
  return [h.cx + (h.rx + off) * Math.cos(a), h.cy + (h.ry + off) * Math.sin(a)]
}

const asinDeg = (s: number): number => Math.asin(Math.max(-1, Math.min(1, s))) * (180 / Math.PI)

export const computeHeadDecor = (
  look: AvatarLook,
  view: 'front' | 'back',
  head?: AvatarHead,
): HeadDecor => {
  const h = head ?? computeAvatarGeometry(look).head
  const { cx, cy, rx, ry } = h
  const topY = cy - ry
  const hairColor = look.hairColor || '#4a2c17'
  const hairDark = darkenColor(hairColor, 30)
  const skin = look.skinTone || '#fbbf24'
  const eyeColor = look.eyeColor || '#1e293b'
  const capOff = 0.55       // толщина волос над черепом
  const tY = cy - ry * 0.45 // уровень височных прядей

  // --- нормализация стилей (раньше дублировалась в обоих рендерерах) ---
  const isFemale = look.gender === 'female'
  const isChild = look.ageGroup === 'child'
  let style = look.hairStyleId || (isFemale ? 'long' : 'short')
  if (!isFemale && ['long', 'ponytail', 'bun', 'braid'].includes(style)) style = 'short'
  if (isFemale && style === 'mohawk' && !isChild) style = 'short'
  // залысины: явный флаг или пожилой мужчина; у лысины висков нет
  const receding = !!(look.hasRecedingHairline || (!isFemale && look.ageGroup === 'elder'))
  const headwear = look.headwear || 'none'
  const hasHat = headwear !== 'none'

  // --- уши: половинки по бокам головы (видны и спереди, и сзади) ---
  const earY = cy - ry * 0.10
  const ears =
    `<circle cx="${fmtN(cx - rx + 0.35)}" cy="${fmtN(earY)}" r="1.5" fill="${skin}"/>` +
    `<circle cx="${fmtN(cx + rx - 0.35)}" cy="${fmtN(earY)}" r="1.5" fill="${skin}"/>`

  // --- полилиния по дуге эллипса (точная посадка на череп) ---
  const arcPts = (aFrom: number, aTo: number, off: number, steps: number): string => {
    let d = ''
    for (let i = 1; i <= steps; i++) {
      const [px, py] = headPoint(h, aFrom + ((aTo - aFrom) * i) / steps, off)
      d += ` L${fmtN(px)} ${fmtN(py)}`
    }
    return d
  }
  const arcStart = (a: number, off: number): string => {
    const [sx, sy] = headPoint(h, a, off)
    return `M${fmtN(sx)} ${fmtN(sy)}`
  }

  // --- углы висков (общие для каска и прядей, чтобы старт совпадал точно) ---
  const aUpT = asinDeg((tY - cy) / (ry + capOff))
  const aCapL = 180 - aUpT // ~205.5°
  const aCapR = 360 + aUpT // ~334.5°

  // --- каск волос спереди: дуга по черепу от виска до виска ---
  const capD = (): string => {
    const [sx, sy] = headPoint(h, aCapL, capOff)
    return `M${fmtN(sx)} ${fmtN(sy)}` + arcPts(aCapL, aCapR, capOff, 8) +
      ` Q${fmtN(cx)} ${fmtN(tY + 3.2)} ${fmtN(sx)} ${fmtN(sy)} Z`
  }
  const cap = `<path d="${capD()}" fill="${hairColor}"/>`

  // --- длинные пряди у лица (стартуют от висков, падают на плечи) ---
  const longStrand = (aSide: number): string => {
    const side: Side = aSide > 270 ? 1 : -1
    const [sx, sy] = headPoint(h, aSide, capOff)
    const d = `M${fmtN(sx)} ${fmtN(sy)} Q${fmtN(cx + side * (rx + 2.1))} ${fmtN(cy + 4.5)} ${fmtN(cx + side * rx * 0.38)} ${fmtN(cy + ry * 2.05)}`
    return `<path d="${d}" stroke="${hairColor}" stroke-width="3.6" stroke-linecap="round" fill="none"/>`
  }

  // --- коса сбоку (front) ---
  const braidStrand = (): string => {
    const [sx, sy] = headPoint(h, aCapR, capOff)
    const d = `M${fmtN(sx)} ${fmtN(sy)} Q${fmtN(cx + rx + 2.6)} ${fmtN(cy + ry * 0.30)} ${fmtN(cx + rx * 0.55)} ${fmtN(cy + ry * 2.3)}`
    return `<path d="${d}" stroke="${hairColor}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`
  }

  // --- кудри: «бусы» по верхнему контуру (раньше не отличались от short) ---
  const beads = (): string => {
    let out = ''
    const angs = [-155, -125, -90, -55, -25]
    const radii = [2.0, 2.35, 2.5, 2.35, 2.0]
    angs.forEach((a, i) => {
      const [px, py] = headPoint(h, a, 0.4)
      out += `<circle cx="${fmtN(px)}" cy="${fmtN(py)}" r="${radii[i]}" fill="${hairColor}"/>`
    })
    return out
  }

  // --- пучок: сидит НА макушке, а не беретом на лбу ---
  const bunCircle = (): string =>
    `<circle cx="${fmtN(cx)}" cy="${fmtN(topY - 2.3)}" r="3.4" fill="${hairColor}"/>`

  // --- ирокез: гребень с основанием на черепе ---
  const mohawkD = (): string => {
    const [lx, ly] = headPoint(h, 250, 0)
    const [bx, by] = headPoint(h, 290, 0)
    return `M${fmtN(lx)} ${fmtN(ly)}` +
      ` L${fmtN(cx - 1.5)} ${fmtN(topY - 5.2)} L${fmtN(cx - 0.4)} ${fmtN(topY - 1.2)}` +
      ` L${fmtN(cx + 0.9)} ${fmtN(topY - 7.2)} L${fmtN(bx)} ${fmtN(by)}` +
      ` Q${fmtN(cx)} ${fmtN(topY + 0.9)} ${fmtN(lx)} ${fmtN(ly)} Z`
  }

  // --- залысины: полумесяцы, прижатые к краю головы на висках ---
  const tuft = (side: Side): string => {
    const y1 = cy - ry * 0.52, y2 = cy - ry * 0.10, ym = cy - ry * 0.31
    const d =
      `M${fmtN(headEdgeX(h, y1, side, 0.75))} ${fmtN(y1)}` +
      ` Q${fmtN(headEdgeX(h, ym, side, 1.0))} ${fmtN(ym)} ${fmtN(headEdgeX(h, y2, side, 0.75))} ${fmtN(y2)}` +
      ` L${fmtN(headEdgeX(h, y2, side, -0.35))} ${fmtN(y2)}` +
      ` Q${fmtN(headEdgeX(h, ym, side, -0.35))} ${fmtN(ym)} ${fmtN(headEdgeX(h, y1, side, -0.35))} ${fmtN(y1)} Z`
    return `<path d="${d}" fill="${hairColor}"/>`
  }

  // --- каск затылка (back): дуга по черепу через макушку ---
  const capBackD = (): string => {
    const off = 0.7
    const aNape = asinDeg((ry * 0.42) / (ry + off))
    const aL = 180 - aNape
    const aR = 360 + aNape
    const [sx, sy] = headPoint(h, aL, off)
    return `M${fmtN(sx)} ${fmtN(sy)}` + arcPts(aL, aR, off, 14) +
      ` Q${fmtN(cx)} ${fmtN(sy + 2.1)} ${fmtN(sx)} ${fmtN(sy)} Z`
  }
  const capBack = `<path d="${capBackD()}" fill="${hairColor}"/>`

  // --- полоса волос между двумя уровнями (лента на затылке / выглядывание
  //     волос из-под убора): внешний контур по черепу + внутренняя кромка ---
  const bandD = (yTop: number, yBot: number, off: number): string => {
    // Полоса волос на затылке между уровнями yTop (линия роста) и yBot (низ):
    // боковые кромки — по контуру черепа, верх/низ — мягкие дуги на уровнях.
    const aTopL = 180 - asinDeg((yTop - cy) / (ry + off))
    const aBotL = 180 - asinDeg((yBot - cy) / (ry + off))
    const aTopR = 360 + asinDeg((yTop - cy) / (ry + off))
    const aBotR = 360 + asinDeg((yBot - cy) / (ry + off))
    const [lx, ly] = headPoint(h, aTopL, off)
    const [rbx, rby] = headPoint(h, aBotR, off)
    return arcStart(aTopL, off) +
      arcPts(aTopL, aBotL, off, 4) +
      ` Q${fmtN(cx)} ${fmtN(yBot + 1.8)} ${fmtN(rbx)} ${fmtN(rby)}` +
      arcPts(aBotR, aTopR, off, 4) +
      ` Q${fmtN(cx)} ${fmtN(yTop + 1.2)} ${fmtN(lx)} ${fmtN(ly)} Z`
  }

  // --- пряди на спину (back) ---
  const backStrand = (side: Side): string => {
    const [sx, sy] = headPoint(h, side === 1 ? 25 : 155, 0.7)
    const d = `M${fmtN(sx)} ${fmtN(sy)} Q${fmtN(cx + side * (rx + 2.8))} ${fmtN(cy + 5.5)} ${fmtN(cx + side * rx * 0.5)} ${fmtN(cy + ry * 2.3)}`
    return `<path d="${d}" stroke="${hairColor}" stroke-width="5.2" stroke-linecap="round" fill="none"/>`
  }

  // --- коса по центру спины с насечками плетения ---
  const braidBack = (): string => {
    const yEnd = cy + ry * 2.75
    let out = `<path d="M${fmtN(cx - 1.7)} ${fmtN(cy - ry * 0.35)} L${fmtN(cx + 1.7)} ${fmtN(cy - ry * 0.35)} L${fmtN(cx + 1.2)} ${fmtN(yEnd)} Q${fmtN(cx)} ${fmtN(yEnd + 1.7)} ${fmtN(cx - 1.2)} ${fmtN(yEnd)} Z" fill="${hairColor}"/>`
    for (let k = 0; k < 3; k++) {
      const y = cy + ry * (0.55 + k * 0.5)
      out += `<path d="M${fmtN(cx - 1.05)} ${fmtN(y)} L${fmtN(cx + 1.05)} ${fmtN(y + 1.2)}" stroke="${hairDark}" stroke-width="0.6" fill="none" opacity="0.6"/>`
    }
    return out
  }

  // --- хвост (back): свисает вправо, якорь на черепе ---
  const ponytailBack = (): string => {
    const [x0, y0] = headPoint(h, -35, 0.6)
    const d =
      `M${fmtN(x0)} ${fmtN(y0)}` +
      ` Q${fmtN(cx + rx + 5.2)} ${fmtN(cy + 1)} ${fmtN(cx + rx + 3.6)} ${fmtN(cy + ry * 0.95)}` +
      ` Q${fmtN(cx + rx + 2.6)} ${fmtN(cy + ry * 1.8)} ${fmtN(cx + rx * 0.55)} ${fmtN(cy + ry * 1.95)}` +
      ` Q${fmtN(cx + rx * 1.0)} ${fmtN(cy + ry * 0.5)} ${fmtN(x0)} ${fmtN(y0)} Z`
    return `<path d="${d}" fill="${hairColor}"/>`
  }

  // --- метрики уборов (общие для чёлки и самих уборов) ---
  const brimYCap = cy - ry * 0.58
  const brimYHat = cy - ry * 0.55
  const botBeanie = cy - ry * 0.30
  const brimBottom = headwear === 'beanie'
    ? botBeanie + 0.2
    : (headwear === 'cap' ? brimYCap + 2.35 : brimYHat + 2.45)

  // --- купол убора: дуга по черепу от кромки до кромки (не плавает) ---
  const domeD = (yBase: number, off: number): string => {
    const aUp = asinDeg((yBase - cy) / (ry + off))
    const aL = 180 - aUp
    const aR = 360 + aUp
    const [sx, sy] = headPoint(h, aL, off)
    return `M${fmtN(sx)} ${fmtN(sy)}` + arcPts(aL, aR, off, 8) +
      ` Q${fmtN(cx)} ${fmtN(yBase + 1.15)} ${fmtN(sx)} ${fmtN(sy)} Z`
  }

  const hatColor = look.headwearColor || '#1e293b'
  const hatShade = darkenColor(hatColor, 24)

  const hatRects = (kind: 'hat' | 'beanie'): string => {
    if (kind === 'hat') {
      const crownW = rx * 1.6
      const crownTop = topY - 4.4
      return `<rect x="${fmtN(cx - crownW / 2)}" y="${fmtN(crownTop)}" width="${fmtN(crownW)}" height="${fmtN(brimYHat - crownTop + 1.3)}" rx="2.6" fill="${hatColor}"/>` +
        `<rect x="${fmtN(cx - crownW / 2 - 4.3)}" y="${fmtN(brimYHat - 0.45)}" width="${fmtN(crownW + 8.6)}" height="2.9" rx="1.4" fill="${hatColor}"/>`
    }
    const hwN = headHalfWidth(h, botBeanie, 0.6)
    return `<rect x="${fmtN(cx - hwN - 0.4)}" y="${fmtN(botBeanie - 3.2)}" width="${fmtN(2 * (hwN + 0.4))}" height="3.4" rx="1.7" fill="${hatColor}"/>`
  }

  const hatFront = (): string => {
    if (headwear === 'cap') {
      const hwB = headHalfWidth(h, brimYCap, 0.55)
      return `<path d="${domeD(brimYCap, 0.55)}" fill="${hatColor}"/>` +
        `<rect x="${fmtN(cx - hwB - 2.5)}" y="${fmtN(brimYCap - 0.35)}" width="${fmtN(2 * (hwB + 2.5))}" height="2.7" rx="1.3" fill="${hatColor}"/>` +
        `<ellipse cx="${fmtN(cx)}" cy="${fmtN(brimYCap + 0.95)}" rx="${fmtN(hwB * 0.62)}" ry="1.6" fill="${hatShade}"/>`
    }
    if (headwear === 'hat') return hatRects('hat')
    return `<path d="${domeD(botBeanie - 2.8, 0.55)}" fill="${hatColor}"/>` + hatRects('beanie')
  }

  const hatBack = (): string => {
    if (headwear === 'cap') {
      const hwB = headHalfWidth(h, brimYCap, 0.55)
      return `<path d="${domeD(brimYCap, 0.55)}" fill="${hatColor}"/>` +
        `<rect x="${fmtN(cx - hwB - 2.5)}" y="${fmtN(brimYCap - 0.35)}" width="${fmtN(2 * (hwB + 2.5))}" height="2.7" rx="1.3" fill="${hatColor}"/>`
    }
    if (headwear === 'hat') return hatRects('hat')
    return `<path d="${domeD(botBeanie - 2.8, 0.55)}" fill="${hatColor}"/>` + hatRects('beanie')
  }

  // --- чёлка из-под убора (рисуется ДО убора: кромка прячется под ним) ---
  const bangsD = (): string => {
    const y0 = brimBottom - 1.2
    const y1 = brimBottom + 1.6
    const w = headHalfWidth(h, y1, 0.3) * 0.90
    return `M${fmtN(cx - w)} ${fmtN(y0)} L${fmtN(cx + w)} ${fmtN(y0)} Q${fmtN(cx)} ${fmtN(y1 + 1.4)} ${fmtN(cx - w)} ${fmtN(y0)} Z`
  }

  // ============ СБОРКА ВОЛОС ============
  let hair = ''
  if (style !== 'bald') {
    if (view === 'front') {
      if (hasHat) {
        // под убором видны только чёлка и длинные пряди/коса
        if (style !== 'mohawk') {
          hair += `<path d="${bangsD()}" fill="${hairColor}"/>`
          if (style === 'long') hair += longStrand(aCapL) + longStrand(aCapR)
          if (style === 'braid') hair += braidStrand()
        }
      } else if (receding && style === 'short') {
        hair += tuft(-1) + tuft(1)
      } else {
        switch (style) {
          case 'short': hair += cap; break
          case 'curly': hair += cap + beads(); break
          case 'long': hair += cap + longStrand(aCapL) + longStrand(aCapR); break
          case 'braid': hair += cap + braidStrand(); break
          case 'ponytail': hair += cap; break
          case 'bun': hair += cap + bunCircle(); break
          case 'mohawk': hair += `<path d="${mohawkD()}" fill="${hairColor}"/>`; break
        }
      }
    } else {
      if (hasHat) {
        // сзади из-под убора выглядывают затылок и длинные пряди
        if (style === 'long') hair += backStrand(-1) + backStrand(1)
        if (style === 'braid') hair += braidBack()
        if (style === 'ponytail') hair += ponytailBack()
        if (style === 'short' || style === 'curly') {
          hair += `<path d="${bandD(brimBottom + 0.3, cy + ry * 0.42 + 0.8, 0.7)}" fill="${hairColor}"/>`
        }
      } else if (receding && style === 'short') {
        hair += `<path d="${bandD(cy - ry * 0.22, cy + ry * 0.40, 0.9)}" fill="${hairColor}"/>`
      } else {
        switch (style) {
          case 'short': hair += capBack; break
          case 'curly': hair += capBack + beads(); break
          case 'long': hair += capBack + backStrand(-1) + backStrand(1); break
          case 'braid': hair += capBack + braidBack(); break
          case 'ponytail': hair += capBack + ponytailBack(); break
          case 'bun': hair += capBack + bunCircle(); break
          case 'mohawk': hair += `<path d="${mohawkD()}" fill="${hairColor}"/>`; break
        }
      }
    }
  }

  // ============ ЛИЦО (только front) ============
  let face = ''
  let glassesSvg = ''
  let facialHairSvg = ''
  if (view === 'front') {
    const eyeY = cy - ry * 0.16
    const eyeDX = rx * 0.40
    const eyeR = Math.max(1.0, Math.min(1.45, rx * 0.115))
    face += `<circle cx="${fmtN(cx - eyeDX)}" cy="${fmtN(eyeY)}" r="${fmtN(eyeR)}" fill="${eyeColor}"/>`
    face += `<circle cx="${fmtN(cx + eyeDX)}" cy="${fmtN(eyeY)}" r="${fmtN(eyeR)}" fill="${eyeColor}"/>`
    // брови
    const browColor = darkenColor(hairColor, 15)
    for (const side of [-1, 1] as Side[]) {
      face += `<path d="M${fmtN(cx + side * (eyeDX - 1.6))} ${fmtN(eyeY - 2.4)} Q${fmtN(cx + side * eyeDX)} ${fmtN(eyeY - 3.1)} ${fmtN(cx + side * (eyeDX + 1.6))} ${fmtN(eyeY - 2.5)}" stroke="${browColor}" stroke-width="0.75" stroke-linecap="round" fill="none"/>`
    }
    // ресницы (женские)
    if (isFemale) {
      for (const side of [-1, 1] as Side[]) {
        face += `<path d="M${fmtN(cx + side * (eyeDX + 1.0))} ${fmtN(eyeY - 0.9)} L${fmtN(cx + side * (eyeDX + 2.0))} ${fmtN(eyeY - 1.8)}" stroke="${eyeColor}" stroke-width="0.7" stroke-linecap="round"/>`
      }
    }
    // нос — тонкая полупрозрачная линия
    face += `<path d="M${fmtN(cx - 0.55)} ${fmtN(eyeY + 2.3)} Q${fmtN(cx - 1.35)} ${fmtN(eyeY + 4.5)} ${fmtN(cx + 0.25)} ${fmtN(eyeY + 4.8)}" stroke="${darkenColor(skin, 60)}" stroke-width="0.7" stroke-linecap="round" fill="none" opacity="0.6"/>`
    // рот
    const my = cy + ry * 0.24
    if (isFemale) {
      face += `<path d="M${fmtN(cx - 2.7)} ${fmtN(my)} Q${fmtN(cx)} ${fmtN(my + 2.6)} ${fmtN(cx + 2.7)} ${fmtN(my)}" stroke="#a84a52" stroke-width="1.0" stroke-linecap="round" fill="none"/>`
    } else {
      face += `<line x1="${fmtN(cx - 2.7)}" y1="${fmtN(my + 1.1)}" x2="${fmtN(cx + 2.7)}" y2="${fmtN(my + 1.1)}" stroke="#1e293b" stroke-width="1.0" stroke-linecap="round"/>`
    }

    // --- очки: линзы по глазам, дужки до края головы ---
    const gl = look.glasses || 'none'
    if (gl !== 'none') {
      const lensW = eyeDX * 1.72
      const lensH = 5.4
      const ly = eyeY - lensH * 0.52
      const lx1 = cx - eyeDX - lensW / 2
      const lx2 = cx + eyeDX - lensW / 2
      const templeLX = headEdgeX(h, eyeY, -1, 0.1)
      const templeRX = headEdgeX(h, eyeY, 1, 0.1)
      const bridge = `M${fmtN(lx1 + lensW)} ${fmtN(eyeY - 0.2)} L${fmtN(lx2)} ${fmtN(eyeY - 0.2)}`
      if (gl === 'glasses') {
        glassesSvg =
          `<rect x="${fmtN(lx1)}" y="${fmtN(ly)}" width="${fmtN(lensW)}" height="${fmtN(lensH)}" rx="1.5" stroke="#222" stroke-width="0.8" fill="none"/>` +
          `<rect x="${fmtN(lx2)}" y="${fmtN(ly)}" width="${fmtN(lensW)}" height="${fmtN(lensH)}" rx="1.5" stroke="#222" stroke-width="0.8" fill="none"/>` +
          `<path d="${bridge}" stroke="#222" stroke-width="0.8"/>` +
          `<path d="M${fmtN(lx1)} ${fmtN(eyeY - 0.5)} L${fmtN(templeLX)} ${fmtN(eyeY - 1.0)}" stroke="#222" stroke-width="0.8"/>` +
          `<path d="M${fmtN(lx2 + lensW)} ${fmtN(eyeY - 0.5)} L${fmtN(templeRX)} ${fmtN(eyeY - 1.0)}" stroke="#222" stroke-width="0.8"/>`
      } else if (gl === 'round') {
        glassesSvg =
          `<circle cx="${fmtN(cx - eyeDX)}" cy="${fmtN(eyeY)}" r="${fmtN(lensW / 2)}" stroke="#222" stroke-width="0.8" fill="none"/>` +
          `<circle cx="${fmtN(cx + eyeDX)}" cy="${fmtN(eyeY)}" r="${fmtN(lensW / 2)}" stroke="#222" stroke-width="0.8" fill="none"/>` +
          `<path d="${bridge}" stroke="#222" stroke-width="0.8"/>` +
          `<path d="M${fmtN(lx1)} ${fmtN(eyeY - 0.5)} L${fmtN(templeLX)} ${fmtN(eyeY - 1.0)}" stroke="#222" stroke-width="0.8"/>` +
          `<path d="M${fmtN(lx2 + lensW)} ${fmtN(eyeY - 0.5)} L${fmtN(templeRX)} ${fmtN(eyeY - 1.0)}" stroke="#222" stroke-width="0.8"/>`
      } else { // sunglasses
        glassesSvg =
          `<rect x="${fmtN(lx1)}" y="${fmtN(ly)}" width="${fmtN(lensW)}" height="${fmtN(lensH)}" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)"/>` +
          `<rect x="${fmtN(lx2)}" y="${fmtN(ly)}" width="${fmtN(lensW)}" height="${fmtN(lensH)}" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)"/>` +
          `<path d="${bridge}" stroke="#111" stroke-width="1.2"/>` +
          `<path d="M${fmtN(lx1)} ${fmtN(eyeY - 0.5)} L${fmtN(templeLX)} ${fmtN(eyeY - 1.0)}" stroke="#111" stroke-width="1"/>` +
          `<path d="M${fmtN(lx2 + lensW)} ${fmtN(eyeY - 0.5)} L${fmtN(templeRX)} ${fmtN(eyeY - 1.0)}" stroke="#111" stroke-width="1"/>`
      }
    }

    // --- растительность на лице (якоря по подбородку, а не в воздухе) ---
    const fh = look.facialHair || 'none'
    if (fh === 'mustache') {
      facialHairSvg = `<rect x="${fmtN(cx - 4.4)}" y="${fmtN(eyeY + 4.2)}" width="8.8" height="2.6" rx="1.3" fill="${hairColor}"/>`
    } else if (fh === 'goatee') {
      facialHairSvg = `<path d="M${fmtN(cx - 2.5)} ${fmtN(cy + ry * 0.30)} Q${fmtN(cx)} ${fmtN(cy + ry * 0.95)} ${fmtN(cx + 2.5)} ${fmtN(cy + ry * 0.30)}" fill="${hairColor}"/>`
    } else if (fh === 'beard') {
      facialHairSvg = `<path d="M${fmtN(cx - rx * 0.62)} ${fmtN(cy + ry * 0.32)} Q${fmtN(cx)} ${fmtN(cy + ry * 2.10)} ${fmtN(cx + rx * 0.62)} ${fmtN(cy + ry * 0.32)} Q${fmtN(cx)} ${fmtN(cy + ry * 1.05)} Z" fill="${hairColor}"/>`
    } else if (fh === 'stubble') {
      facialHairSvg = `<path d="M${fmtN(cx - 3.1)} ${fmtN(cy + ry * 0.30)} Q${fmtN(cx)} ${fmtN(cy + ry * 0.78)} ${fmtN(cx + 3.1)} ${fmtN(cy + ry * 0.30)} Z" fill="${hairColor}" opacity="0.65"/>`
    }
  }

  const hat = hasHat ? (view === 'front' ? hatFront() : hatBack()) : ''
  return { ears, hair, face, glasses: glassesSvg, facialHair: facialHairSvg, hat }
}
