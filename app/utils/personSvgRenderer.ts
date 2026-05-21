// utils/personSvgRenderer.ts
// Генерация SVG персонажа на основе параметров внешности (аналог PersonAvatar)

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

export function renderPersonSvg(
  appearance: PersonAppearance,
  options: {
    view: 'front' | 'back'
    isMoving?: boolean
    width?: number
    height?: number
  }
): string {
  const { view, isMoving = false, width = 80, height = 110 } = options

  // Нормализация параметров
  const gender = appearance.gender || 'male'
  const ageGroup = appearance.ageGroup || 'adult'
  const isChild = ageGroup === 'child'
  const isFemale = gender === 'female'
  const skin = appearance.skinTone || '#FDBCB4'
  const eyeColor = appearance.eyeColor || '#1e293b'
  const hair = appearance.hairColor || '#4a2c17'
  
  // Защита: мужчины не могут иметь женские причёски
  let rawHairStyle = appearance.hairStyleId || (isFemale ? 'long' : 'short')
  if (!isFemale && ['long', 'ponytail', 'bun', 'braid'].includes(rawHairStyle)) {
    rawHairStyle = 'short'
  }
  // Женщины не могут иметь ирокез (кроме детей)
  if (isFemale && rawHairStyle === 'mohawk' && !isChild) {
    rawHairStyle = 'short'
  }
  const hairStyle = rawHairStyle

  const receding = appearance.hasRecedingHairline ?? (gender === 'male' && ageGroup === 'elder')
  const facialHair = appearance.facialHair || 'none'
  const headwear = appearance.headwear || 'none'
  const hatColor = appearance.headwearColor || '#1e293b'
  const glasses = appearance.glasses || 'none'
  const clothingStyle = appearance.clothingStyle || 'standard'
  const topColor = appearance.topColor || (isFemale ? '#ec489a' : '#3b82f6')
  const bottomColor = appearance.bottomColor || '#1e293b'
  const skirtColor = appearance.skirtColor || '#64748b'
  const shoeColor = appearance.shoeColor || '#1f2937'
  const bodyWidth = appearance.bodyWidth || 1.0
  const faceWidth = appearance.faceWidth || 1.0
  const animSpeed = appearance.animation?.speed ?? 1
  const swingAmplitude = appearance.animation?.swingAmplitude ?? 3
  const armSwing = appearance.animation?.armSwing ?? 15
  const bounceAmplitude = appearance.animation?.bounceAmplitude ?? 3

  // Вспомогательные функции
  const darken = (hex: string, amount: number) => {
    hex = hex.replace('#', '')
    let r = Math.max(0, parseInt(hex.slice(0, 2), 16) - amount)
    let g = Math.max(0, parseInt(hex.slice(2, 4), 16) - amount)
    let b = Math.max(0, parseInt(hex.slice(4, 6), 16) - amount)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Геометрия (логическая сетка 50x100)
  const headRx = 11 * faceWidth
  const torsoW = 12 * bodyWidth
  const torsoL = 25 - torsoW
  const torsoR = 25 + torsoW
  const hipL = 25 - torsoW * 1.1
  const hipR = 25 + torsoW * 1.1
  const wL = 25 - torsoW * 0.65
  const wR = 25 + torsoW * 0.65
  const legBase = isFemale ? 4 : 7
  const legSpread = legBase + (bodyWidth - 1) * 3
  const frontLegX = 25 + legSpread
  const backLegX = 25 - legSpread
  const armBase = isFemale ? 9 : 10
  const armSpread = armBase + (bodyWidth - 1) * 2
  const frontArmX = 25 + armSpread
  const backArmX = 25 - armSpread

  // Формирование пути женского торса
  const femaleTorsoPath = (() => {
    const sW = torsoW * 0.85
    const sL = 25 - sW
    const sR = 25 + sW
    const bottomL = hipL + 4
    const bottomR = hipR - 4
    return `M${sL} 32 C${sL} 40 ${wL} 45 ${wL} 50 L${bottomL} 66 L${bottomR} 66 L${wR} 50 C${wR} 45 ${sR} 40 ${sR} 32 Z`
  })()

  // Цвета для одежды
  const legStroke = (isFemale && (clothingStyle === 'skirt' || clothingStyle === 'dress')) ? 5 : (isFemale ? 6 : 7)
  const legStrokeColor = (clothingStyle === 'skirt' || clothingStyle === 'dress') ? skin : bottomColor
  const suitColor = darken(topColor, 40)

  // CSS-анимация
  const animStyle = isMoving ? `
    <defs>
      <style>
        .anim-arm-l { animation: swing-l ${1.5 / animSpeed}s ease-in-out infinite; transform-origin: ${backArmX}px 38px; }
        .anim-arm-r { animation: swing-r ${1.5 / animSpeed}s ease-in-out infinite; transform-origin: ${frontArmX}px 38px; }
        .anim-leg-l { animation: swing-r ${1.5 / animSpeed}s ease-in-out infinite; transform-origin: ${backLegX}px 64px; }
        .anim-leg-r { animation: swing-l ${1.5 / animSpeed}s ease-in-out infinite; transform-origin: ${frontLegX}px 64px; }
        @keyframes swing-l { 0%,100% { transform: rotate(-${armSwing}deg); } 50% { transform: rotate(${armSwing}deg); } }
        @keyframes swing-r { 0%,100% { transform: rotate(${armSwing}deg); } 50% { transform: rotate(-${armSwing}deg); } }
        .body-bounce { animation: bounce ${1 / animSpeed}s ease-in-out infinite; }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-${bounceAmplitude}px); } }
      </style>
    </defs>
  ` : ''

  let svg = `<svg viewBox="0 0 50 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">${animStyle}`

  if (isMoving) {
    svg += `<g class="body-bounce">`
  }

  // === Задняя рука ===
  svg += `<g class="anim-arm-l"><line x1="${backArmX}" y1="38" x2="${backArmX - 5}" y2="56" stroke="${skin}" stroke-width="5" stroke-linecap="round"/></g>`

  // === Ноги ===
  svg += `<g class="anim-leg-l"><line x1="${backLegX}" y1="64" x2="${backLegX}" y2="92" stroke="${legStrokeColor}" stroke-width="${legStroke}" stroke-linecap="round"/><ellipse cx="${backLegX}" cy="95" rx="4" ry="2" fill="${shoeColor}"/></g>`
  svg += `<g class="anim-leg-r"><line x1="${frontLegX}" y1="64" x2="${frontLegX}" y2="92" stroke="${legStrokeColor}" stroke-width="${legStroke}" stroke-linecap="round"/><ellipse cx="${frontLegX}" cy="95" rx="4" ry="2" fill="${shoeColor}"/></g>`

  // === Туловище ===
  if (!isFemale) {
    svg += `<rect x="${torsoL}" y="32" width="${torsoW * 2}" height="34" rx="4" fill="${topColor}"/>`
  } else {
    svg += `<path d="${femaleTorsoPath}" fill="${topColor}"/>`
  }

  // === Одежда ===
  if (clothingStyle === 'hoodie') {
    svg += `<path d="M18 28 Q25 12 32 28 L30 38 L20 38 Z" fill="${darken(topColor, 20)}"/>`
  }
  if (clothingStyle === 'skirt') {
    svg += `<path d="M${wL} 50 L${hipL - 2} 78 L${hipR + 2} 78 L${wR} 50 Z" fill="${skirtColor}"/>`
  }
  if (clothingStyle === 'dress') {
    svg += `<path d="M${wL - 1} 48 L${hipL - 3} 84 L${hipR + 3} 84 L${wR + 1} 48 Z" fill="${topColor}"/>`
  }
  if (clothingStyle === 'suit') {
    if (view === 'back') {
      svg += `<path d="M${torsoL} 32 L25 38 ${torsoR} 32 ${torsoR} 66 ${torsoL} 66 Z" fill="${suitColor}"/>`
      svg += `<line x1="25" y1="38" x2="25" y2="66" stroke="black" stroke-width="1" opacity="0.3"/>`
    } else {
      svg += `<path d="M${torsoL} 32 ${torsoL + 10} 52 ${torsoL} 52 Z" fill="${suitColor}"/>`
      svg += `<path d="M${torsoR} 32 ${torsoR - 10} 52 ${torsoR} 52 Z" fill="${suitColor}"/>`
      svg += `<path d="M24 36 L25 56 L26 36 Z" fill="${bottomColor}"/>`
    }
  }

  // === Передняя рука ===
  svg += `<g class="anim-arm-r"><line x1="${frontArmX}" y1="38" x2="${frontArmX + 5}" y2="56" stroke="${skin}" stroke-width="5" stroke-linecap="round"/></g>`

  // === Голова ===
  svg += `<ellipse cx="25" cy="18" rx="${headRx}" ry="13" fill="${skin}"/>`

  // === Волосы ===
  const hairTransform = `scale(${faceWidth}, 1)`
  if (view === 'back') {
    if (receding) {
      svg += `<g transform="${hairTransform}"><path d="M14 12 Q11 20 14 24 L36 24 Q39 20 36 12 Z" fill="${hair}"/></g>`
    } else if (hairStyle === 'long') {
      svg += `<g transform="${hairTransform}"><path d="M12 24 Q14 4 25 5 Q35 4 38 24" fill="${hair}"/><path d="M14 18 Q12 28 15 45" stroke="${hair}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M36 18 Q38 28 35 45" stroke="${hair}" stroke-width="6" fill="none" stroke-linecap="round"/></g>`
    } else if (hairStyle === 'braid') {
      svg += `<g transform="${hairTransform}"><path d="M14 18 Q15 4 25 5 Q35 4 36 18" fill="${hair}"/><path d="M24 18 L24 55 L26 55 L26 18" fill="${hair}"/></g>`
    } else if (hairStyle === 'ponytail') {
      svg += `<g transform="${hairTransform}"><path d="M14 18 Q15 4 25 5 Q35 4 36 18" fill="${hair}"/><path d="M31 14 Q41 20 39 44 L36 42 Q37 20 29 16 Z" fill="${hair}"/></g>`
    } else if (hairStyle === 'bun') {
      svg += `<g transform="${hairTransform}"><path d="M14 18 Q15 4 25 5 Q35 4 36 18" fill="${hair}"/><circle cx="25" cy="7" r="6" fill="${hair}"/></g>`
    } else {
      svg += `<g transform="${hairTransform}"><path d="M14 24 Q12 4 25 5 Q38 4 36 24" fill="${hair}"/></g>`
    }
  } else { // front
    if (receding) {
      svg += `<g transform="${hairTransform}"><path d="M12 16 Q13 10 16 12 L16 16 Z" fill="${hair}"/><path d="M38 16 Q37 10 34 12 L34 16 Z" fill="${hair}"/></g>`
    } else if (hairStyle !== 'bald' && headwear === 'none') {
      if (hairStyle === 'mohawk') {
        svg += `<path d="M22 10 L23 0 L25 8 L27 -2 L29 10" fill="${hair}"/>`
      } else if (hairStyle === 'short') {
        svg += `<g transform="${hairTransform}"><path d="M14 11 Q15 4 25 5 Q35 4 36 11" fill="${hair}"/></g>`
      } else if (hairStyle === 'curly') {
        svg += `<g transform="${hairTransform}"><path d="M13 12 Q19 4 25 5 Q31 4 37 12" fill="${hair}"/></g>`
      } else if (hairStyle === 'long') {
        svg += `<g transform="${hairTransform}"><path d="M14 11 Q15 4 25 5 Q35 4 36 11" fill="${hair}"/><path d="M14 11 Q12 18 15 38" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M36 11 Q38 18 35 38" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`
      } else if (hairStyle === 'braid') {
        svg += `<g transform="${hairTransform}"><path d="M14 11 Q15 4 25 5 Q35 4 36 11" fill="${hair}"/><path d="M34 11 Q38 22 36 44" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`
      } else if (hairStyle === 'ponytail') {
        svg += `<g transform="${hairTransform}"><path d="M14 11 Q15 4 25 5 Q35 4 36 11" fill="${hair}"/></g>`
      } else if (hairStyle === 'bun') {
        svg += `<g transform="${hairTransform}"><path d="M14 11 Q15 4 25 5 Q35 4 36 11" fill="${hair}"/><circle cx="25" cy="7" r="6" fill="${hair}"/></g>`
      }
    } else if (hairStyle !== 'bald' && headwear !== 'none') {
      // Под головным убором показываем только чёлку и боковые пряди
      svg += `<g transform="${hairTransform}"><path d="M15 11 Q16 8 25 9 Q34 8 35 11" fill="${hair}"/></g>`
      if (hairStyle === 'long') {
        svg += `<path d="M15 11 Q13 18 16 38" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        svg += `<path d="M35 11 Q37 18 34 38" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      } else if (hairStyle === 'braid') {
        svg += `<path d="M34 11 Q38 22 36 44" stroke="${hair}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      }
    }
  }

  // === Лицо (только спереди) ===
  if (view === 'front') {
    svg += `<circle cx="21" cy="15" r="1.2" fill="${eyeColor}"/>`
    svg += `<circle cx="29" cy="15" r="1.2" fill="${eyeColor}"/>`

    // Очки
    if (glasses === 'glasses') {
      svg += `<rect x="17.5" y="12" width="7" height="6" rx="1.5" stroke="#222" stroke-width="0.8" fill="none"/>`
      svg += `<rect x="25.5" y="12" width="7" height="6" rx="1.15" stroke="#222" stroke-width="0.8" fill="none"/>`
      svg += `<path d="M24.5 15 L25.5 15" stroke="#222" stroke-width="0.8"/>`
      svg += `<path d="M17.5 14.5 L14 13.5" stroke="#222" stroke-width="0.8"/>`
      svg += `<path d="M32.5 14.5 L36 13.5" stroke="#222" stroke-width="0.8"/>`
    } else if (glasses === 'round') {
      svg += `<circle cx="21" cy="15" r="3.5" stroke="#222" stroke-width="0.8" fill="none"/>`
      svg += `<circle cx="29" cy="15" r="3.5" stroke="#222" stroke-width="0.8" fill="none"/>`
      svg += `<path d="M17 15 L14 14" stroke="#222" stroke-width="0.8"/>`
      svg += `<path d="M33 15 L36 14" stroke="#222" stroke-width="0.8"/>`
    } else if (glasses === 'sunglasses') {
      svg += `<rect x="17.5" y="11.5" width="7" height="7" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)"/>`
      svg += `<rect x="25.5" y="11.5" width="7" height="7" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)"/>`
      svg += `<path d="M24.5 15 L25.5 15" stroke="#111" stroke-width="1.2"/>`
      svg += `<path d="M17.5 14.5 L14 13.5" stroke="#111" stroke-width="1"/>`
      svg += `<path d="M32.5 14.5 L36 13.5" stroke="#111" stroke-width="1"/>`
    }

    // Рот
    if (isFemale) {
      svg += `<path d="M22 20 Q25 23 28 20" stroke="#1e293b" stroke-width="1" fill="none" stroke-linecap="round"/>`
    } else {
      svg += `<line x1="22" y1="21" x2="28" y2="21" stroke="#1e293b" stroke-width="1" stroke-linecap="round"/>`
    }

    // Ресницы у женщин
    if (isFemale) {
      svg += `<line x1="19" y1="13.5" x2="20.5" y2="12.5" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round"/>`
      svg += `<line x1="31" y1="13.5" x2="29.5" y2="12.5" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round"/>`
    }

    // Растительность на лице
    if (facialHair === 'mustache') {
      svg += `<rect x="20" y="20" width="10" height="3" rx="1.5" fill="${hair}"/>`
    } else if (facialHair === 'goatee') {
      svg += `<path d="M22 23 Q25 28 28 23" fill="${hair}"/>`
    } else if (facialHair === 'beard') {
      svg += `<path d="M18 23 Q25 34 32 23" fill="${hair}"/>`
    } else if (facialHair === 'stubble') {
      svg += `<path d="M21 20 Q25 24 29 20" fill="${hair}"/>`
    }
  }

  // === Головной убор ===
  if (headwear !== 'none') {
    if (view === 'back') {
      if (headwear === 'cap') {
        svg += `<path d="M14 10 Q25 -2 36 10" fill="${hatColor}"/>`
        svg += `<rect x="10" y="10" width="30" height="3" rx="1.5" fill="${hatColor}"/>`
      } else if (headwear === 'hat') {
        svg += `<rect x="17" y="-4" width="16" height="13" rx="3" fill="${hatColor}"/>`
        svg += `<rect x="8" y="8" width="34" height="3" rx="1.5" fill="${hatColor}"/>`
      } else if (headwear === 'beanie') {
        svg += `<path d="M15 12 Q16 -1 25 1 Q34 -1 35 12" fill="${hatColor}"/>`
        svg += `<rect x="14" y="8" width="22" height="5" rx="2" fill="${hatColor}"/>`
      }
    } else {
      if (headwear === 'cap') {
        svg += `<path d="M14 10 Q25 -2 36 10" fill="${hatColor}"/>`
        svg += `<rect x="10" y="10" width="30" height="3" rx="1.5" fill="${hatColor}"/>`
      } else if (headwear === 'hat') {
        svg += `<rect x="17" y="-4" width="16" height="13" rx="3" fill="${hatColor}"/>`
        svg += `<rect x="8" y="8" width="34" height="3" rx="1.5" fill="${hatColor}"/>`
      } else if (headwear === 'beanie') {
        svg += `<path d="M15 12 Q16 -1 25 1 Q34 -1 35 12" fill="${hatColor}"/>`
        svg += `<rect x="14" y="8" width="22" height="5" rx="2" fill="${hatColor}"/>`
      }
    }
  }

  if (isMoving) {
    svg += `</g>`
  }
  svg += `</svg>`

  return svg
}