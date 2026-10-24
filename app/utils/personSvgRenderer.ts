// utils/personSvgRenderer.ts
// Назначение: генерация SVG персонажа СТРОКОЙ для симулятора (v-html в
// SimulatorWidget). Геометрия, поза ходьбы и головной декор — из
// utils/avatarGeometry.ts, тот же источник, что и у конструктора
// (PersonAvatar.vue): персонаж в симуляторе выглядит и двигается ровно
// как в конструкторе.
// [РЕФАКТОРИНГ 2026-10] — подгонка частей тела (шея, локти/кисти, ботинки,
// плечи на краю торса, капюшон, пиджак) + анимация из walkPose.
// [РЕФИТ ГОЛОВЫ 2026-10] — причёски/лицо/уборы берутся из computeHeadDecor:
// координаты вычисляются из эллипса головы, дубликаты путей удалены. Раньше
// причёска масштабировалась группой <g transform="scale(faceWidth)"> вокруг
// (0,0) и уезжала вбок при faceWidth != 1, а височные пряди висели в воздухе.
// ВАЖНО: имена классов anim-arm-l/r, anim-leg-l/r, body-bounce НЕ менять —
// на них завязана пауза (.is-paused) в SimulatorWidget.vue.

import {
  computeAvatarGeometry,
  computeHeadDecor,
  walkPose,
  walkCycleDurationS,
  darkenColor,
  TAU,
  type AvatarLook,
} from './avatarGeometry'

export interface PersonAppearance {
  gender?: 'male' | 'female'
  ageGroup?: 'child' | 'adult' | 'elder'
  skinTone?: string
  eyeColor?: string
  hairColor?: string
  hairStyleId?: string
  hasRecedingHairline?: boolean
  facialHair?: 'none' | 'stubble' | 'mustache' | 'beard' | 'goatee'
  headwear?: 'none' | 'cap' | 'hat' | 'beanie'
  headwearColor?: string
  glasses?: 'none' | 'glasses' | 'round' | 'sunglasses'
  clothingStyle?: 'standard' | 'hoodie' | 'skirt' | 'dress' | 'suit'
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

const fmt = (v: number) => v.toFixed(2)

// --- Генерация @keyframes из walkPose (8 сегментов на цикл = плавный синус) ---
const buildKeyframes = (look: AvatarLook) => {
  const duration = walkCycleDurationS(look)
  let legL = ''
  let legR = ''
  let armL = ''
  let armR = ''
  let body = ''
  const STEPS = 8
  for (let k = 0; k <= STEPS; k++) {
    const pct = Math.round((k / STEPS) * 100)
    const pose = walkPose((k / STEPS) * TAU, look)
    // Левая (задняя) нога / правая (передняя) нога
    legL += `${pct}% { transform: rotate(${fmt(pose.backLeg.angle)}deg) translateY(${fmt(-pose.backLeg.lift)}px); }\n`
    legR += `${pct}% { transform: rotate(${fmt(pose.frontLeg.angle)}deg) translateY(${fmt(-pose.frontLeg.lift)}px); }\n`
    armL += `${pct}% { transform: rotate(${fmt(pose.backArm.angle)}deg); }\n`
    armR += `${pct}% { transform: rotate(${fmt(pose.frontArm.angle)}deg); }\n`
    body += `${pct}% { transform: translateY(${fmt(pose.bounceY)}px); }\n`
  }
  return { duration, legL, legR, armL, armR, body }
}

export function renderPersonSvg(
  appearance: PersonAppearance,
  options: {
    view: 'front' | 'back'
    isMoving?: boolean
    width?: number
    height?: number
  }
): string {
  const { view, isMoving = false } = options

  // Нормализация параметров (защита от старых записей БД)
  const isFemale = appearance.gender === 'female'
  const skin = appearance.skinTone || '#FDBCB4'
  const topColor = appearance.topColor || (isFemale ? '#ec489a' : '#3b82f6')
  const bottomColor = appearance.bottomColor || '#1e293b'
  const skirtColor = appearance.skirtColor || '#64748b'
  const look: AvatarLook = { ...appearance, skinTone: skin, topColor, bottomColor }

  // --- ЕДИНАЯ геометрия и головной декор (совпадают с конструктором) ---
  const geo = computeAvatarGeometry(look)
  const decor = computeHeadDecor(look, view, geo.head)

  // --- CSS-анимация ---
  // [П1][№12][№26-ФИКС-ФАЗА] var(--walk-hold) задаёт ФАЗУ-ЗАДЕРЖКУ цикла
  // ходьбы (секунды, ПОЛОЖИТЕЛЬНЫЙ delay): физика наращивает её на
  // dt*(1 - v/cruise), пока человек идёт медленнее крейсерской, —
  // рендеримая скорость ног = v/cruise (замедлился — ноги реже, при
  // остановке замирают). Вне симулятора переменная не задана — фаза 0.
  const animStyle = isMoving ? (() => {
    const kf = buildKeyframes(look)
    return `
    <defs>
      <style>
        .anim-arm-l { animation: arm-l ${kf.duration}s linear infinite; animation-delay: calc(var(--walk-hold, 0) * 1s); transform-origin: ${geo.armBack.shoulderX}px ${geo.armBack.shoulderY}px; }
        .anim-arm-r { animation: arm-r ${kf.duration}s linear infinite; animation-delay: calc(var(--walk-hold, 0) * 1s); transform-origin: ${geo.armFront.shoulderX}px ${geo.armFront.shoulderY}px; }
        .anim-leg-l { animation: leg-l ${kf.duration}s linear infinite; animation-delay: calc(var(--walk-hold, 0) * 1s); transform-origin: ${geo.legBack.hipX}px ${geo.legBack.hipY}px; }
        .anim-leg-r { animation: leg-r ${kf.duration}s linear infinite; animation-delay: calc(var(--walk-hold, 0) * 1s); transform-origin: ${geo.legFront.hipX}px ${geo.legFront.hipY}px; }
        .body-bounce { animation: body-bounce ${kf.duration}s linear infinite; animation-delay: calc(var(--walk-hold, 0) * 1s); }
        @keyframes leg-l { ${kf.legL} }
        @keyframes leg-r { ${kf.legR} }
        @keyframes arm-l { ${kf.armL} }
        @keyframes arm-r { ${kf.armR} }
        @keyframes body-bounce { ${kf.body} }
      </style>
    </defs>
  `
  })() : ''

  const part = (cls: string, inner: string) =>
    isMoving ? `<g class="${cls}">${inner}</g>` : `<g>${inner}</g>`

  let svg = `<svg viewBox="0 0 50 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">${animStyle}`

  if (isMoving) {
    svg += `<g class="body-bounce">`
  }

  // === 0. Капюшон: задник (за всем телом) ===
  if (look.clothingStyle === 'hoodie') {
    svg += `<path d="${geo.hood.backD}" fill="${geo.hood.color}"/>`
  }

  // === 1. Задняя рука (позади тела): рука-кривая + рукав + кисть ===
  svg += part('anim-arm-l',
    `<path d="${geo.armBack.pathD}" stroke="${geo.armBack.skinColor}" stroke-width="${geo.armBack.stroke}" fill="none" stroke-linecap="round"/>` +
    (geo.armBack.sleeveD
      ? `<path d="${geo.armBack.sleeveD}" stroke="${geo.armBack.sleeveColor}" stroke-width="${geo.armBack.stroke + 0.7}" fill="none" stroke-linecap="round"/>`
      : '') +
    `<circle cx="${geo.armBack.handCx}" cy="${geo.armBack.handCy}" r="${geo.armBack.handR}" fill="${geo.armBack.skinColor}"/>`)

  // === 2. Ноги (до торса: бёдра прикрыты) ===
  svg += part('anim-leg-l',
    `<line x1="${geo.legBack.hipX}" y1="${geo.legBack.hipY}" x2="${geo.legBack.hipX}" y2="${geo.legBack.ankleY}" stroke="${geo.legBack.color}" stroke-width="${geo.legBack.stroke}" stroke-linecap="round"/>` +
    `<path d="${geo.legBack.shoeD}" fill="${geo.legBack.shoeColor}"/>`)
  svg += part('anim-leg-r',
    `<line x1="${geo.legFront.hipX}" y1="${geo.legFront.hipY}" x2="${geo.legFront.hipX}" y2="${geo.legFront.ankleY}" stroke="${geo.legFront.color}" stroke-width="${geo.legFront.stroke}" stroke-linecap="round"/>` +
    `<path d="${geo.legFront.shoeD}" fill="${geo.legFront.shoeColor}"/>`)

  // === 3. Шея (соединяет голову и торс) ===
  svg += `<rect x="${geo.neck.x}" y="${geo.neck.y}" width="${geo.neck.w}" height="${geo.neck.h}" fill="${skin}"/>`

  // === Туловище ===
  if (!isFemale) {
    svg += `<rect x="${geo.torso.l}" y="32" width="${geo.torso.w * 2}" height="34" rx="4" fill="${topColor}"/>`
  } else {
    svg += `<path d="${geo.femaleTorsoPath}" fill="${topColor}"/>`
  }

  // === Одежда ===
  if (look.clothingStyle === 'skirt') {
    svg += `<path d="${geo.skirtPathD}" fill="${skirtColor}"/>`
  }
  if (look.clothingStyle === 'dress') {
    svg += `<path d="${geo.dressPathD}" fill="${topColor}"/>`
  }
  if (look.clothingStyle === 'suit') {
    if (view === 'back') {
      svg += `<path d="${geo.suit.backD}" fill="${geo.suit.color}"/>`
      svg += `<line x1="25" y1="38" x2="25" y2="66" stroke="black" stroke-width="1" opacity="0.3"/>`
    } else {
      svg += `<path d="${geo.suit.jacketFrontD}" fill="${geo.suit.color}"/>`
      svg += `<path d="${geo.suit.shirtD}" fill="#f8fafc"/>`
      svg += `<path d="${geo.suit.tieKnotD}" fill="${bottomColor}"/>`
      svg += `<path d="${geo.suit.tieBladeD}" fill="${bottomColor}"/>`
      svg += `<path d="${geo.suit.lapelLD}" stroke="black" stroke-width="0.8" fill="none" opacity="0.35"/>`
      svg += `<path d="${geo.suit.lapelRD}" stroke="black" stroke-width="0.8" fill="none" opacity="0.35"/>`
    }
  }

  // === 4. Передняя рука ===
  svg += part('anim-arm-r',
    `<path d="${geo.armFront.pathD}" stroke="${geo.armFront.skinColor}" stroke-width="${geo.armFront.stroke}" fill="none" stroke-linecap="round"/>` +
    (geo.armFront.sleeveD
      ? `<path d="${geo.armFront.sleeveD}" stroke="${geo.armFront.sleeveColor}" stroke-width="${geo.armFront.stroke + 0.7}" fill="none" stroke-linecap="round"/>`
      : '') +
    `<circle cx="${geo.armFront.handCx}" cy="${geo.armFront.handCy}" r="${geo.armFront.handR}" fill="${geo.armFront.skinColor}"/>`)

  // === 5. Уши + голова (уши рисуются до эллипса: видны половинки) ===
  svg += decor.ears
  svg += `<ellipse cx="${geo.head.cx}" cy="${geo.head.cy}" rx="${geo.head.rx}" ry="${geo.head.ry}" fill="${skin}"/>`

  // === 6. Волосы (координаты уже содержат faceWidth — без масштабных групп) ===
  svg += decor.hair

  // === 7. Лицо: глаза/брови/нос/рот, очки, растительность (только front) ===
  if (view === 'front') {
    svg += decor.face
    svg += decor.glasses
    svg += decor.facialHair
  }

  // === 8. Капюшон: ободок поверх волос ===
  if (look.clothingStyle === 'hoodie') {
    svg += `<path d="${geo.hood.rimD}" fill="${geo.hood.color}"/>`
  }

  // === 9. Головной убор (купол вычислен по эллипсу головы) ===
  svg += decor.hat

  if (isMoving) {
    svg += `</g>`
  }
  svg += `</svg>`

  return svg
}
