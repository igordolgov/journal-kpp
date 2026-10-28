// app/utils/simulatorSvg.ts
// Назначение: генерация SVG для машин и людей.

import { renderPersonSvg, type PersonAppearance } from './personSvgRenderer'

import { CAR_COLORS } from './simulatorConstants'

// [№42-ПРОПОРЦИИ] Канон линий высот ЛЕГКОВОЙ (viewBox 120x60) — одинаковые
// отметки на всех трёх ракурсах, чтобы машина не «прыгала» при смене вида:
//   крыша y≈19 | стекло 21..33 | пояс/капот y31..33 | низ кузова y47.5
//   бампер y46..52 | колёса cy51 r7 (низ = грунт y58)
// Силуэт длинно-низкий (H/L ≈ 0.4) — пропорции реального седана.
export const getCarSvg = (color: string): string => `
  <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="43" width="100" height="5" rx="2.5" fill="#374151"/>
    <path d="M14,46 L14,37 Q14,33.5 18,32.5 L28,30.5 Q33,19.5 48,18.5 L70,18.5 Q84,19.5 90,30.5 L101,32.5 Q106,33.5 106,37.5 L106,46 Q106,47.5 104,47.5 L16,47.5 Q14,47.5 14,46 Z" fill="${color}"/>
    <path d="M32,30 Q36.5,21.5 48,20.5 L69,20.5 Q81,21.5 86.5,30 Z" fill="#87CEEB"/>
    <rect x="49" y="20.5" width="4.5" height="9.5" fill="${color}"/>
    <rect x="65" y="20.5" width="4.5" height="9.5" fill="${color}"/>
    <line x1="53.5" y1="31" x2="53.5" y2="44" stroke="rgba(0,0,0,0.22)" stroke-width="1.3"/>
    <line x1="69.5" y1="31" x2="69.5" y2="44" stroke="rgba(0,0,0,0.22)" stroke-width="1.3"/>
    <rect x="55" y="32.5" width="5" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
    <rect x="71" y="32.5" width="5" height="2" rx="1" fill="rgba(255,255,255,0.45)"/>
    <rect x="101" y="34" width="5" height="3.6" rx="1" fill="#fbbf24"/>
    <rect x="14" y="34" width="5" height="3.6" rx="1" fill="#ef4444"/>
    <circle cx="30" cy="51" r="7" fill="#1f2937"/><circle cx="30" cy="51" r="3" fill="#9ca3af"/>
    <circle cx="86" cy="51" r="7" fill="#1f2937"/><circle cx="86" cy="51" r="3" fill="#9ca3af"/>
  </svg>
`

// [№31-ГРУЗОВИКИ] грузовой автомобиль: цветной будка-кузов + тёмная кабина.
// viewBox 120x65 (пропорция 1.85) — элемент 96x52 (TRUCK_*_SCALE от легковой).
// [№42-ПРОПОРЦИИ] канон линий ГРУЗОВИКА (единый для трёх ракурсов):
//   кузов y12..44 | крыша кабины y24 | рама y46..52 | колёса r8 cy52
//   (низ = грунт y60). Кабина ниже кузова — как в жизни.
export const getTruckSvg = (color: string): string => `
  <svg viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="46" width="112" height="6" rx="2" fill="#4b5563"/>
    <rect x="6" y="12" width="70" height="32" rx="3" fill="${color}" stroke="#111827" stroke-width="1.5"/>
    <rect x="6" y="12" width="70" height="7" rx="3" fill="#ffffff" opacity="0.18"/>
    <rect x="26" y="14" width="2" height="28" fill="#ffffff" opacity="0.12"/>
    <rect x="46" y="14" width="2" height="28" fill="#ffffff" opacity="0.12"/>
    <rect x="66" y="14" width="2" height="28" fill="#ffffff" opacity="0.12"/>
    <path d="M78,46 L78,29 Q78,24 83,24 L96,24 Q103,24 105.5,29 L109,37.5 Q110,40 110,42.5 L110,46 Z" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <path d="M82,28.5 Q83,26.5 87,26.5 L96,26.5 Q101,26.5 103,31 L104.5,35 L82,35 Z" fill="#87CEEB"/>
    <line x1="97" y1="36.5" x2="97" y2="44" stroke="rgba(255,255,255,0.25)" stroke-width="1.2"/>
    <rect x="99" y="38" width="4.5" height="2" rx="1" fill="rgba(255,255,255,0.4)"/>
    <rect x="105" y="40.5" width="5" height="3" rx="1" fill="#fbbf24"/>
    <rect x="84" y="21.5" width="3.5" height="2.5" rx="0.8" fill="#fbbf24"/>
    <rect x="90" y="21.5" width="3.5" height="2.5" rx="0.8" fill="#fbbf24"/>
    <rect x="96" y="21.5" width="3.5" height="2.5" rx="0.8" fill="#fbbf24"/>
    <circle cx="20" cy="52" r="8" fill="#1f2937"/><circle cx="20" cy="52" r="3.5" fill="#9ca3af"/>
    <circle cx="40" cy="52" r="8" fill="#1f2937"/><circle cx="40" cy="52" r="3.5" fill="#9ca3af"/>
    <circle cx="96" cy="52" r="8" fill="#1f2937"/><circle cx="96" cy="52" r="3.5" fill="#9ca3af"/>
  </svg>
`

// [№41-РАКУРСЫ] Вид спереди (машина едет НА зрителя — выезд из базы вверх
// экрана). [№42-ПРОПОРЦИИ] отметки высот = канон профиля (крыша y19, грунт
// y58); ширина кузова 48 — след реальной ширины авто; добавлены зеркала
// и решётка радиатора.
export const getCarSvgFront = (color: string): string => `
  <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="39" y="50" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="71" y="50" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="36" y="33" width="48" height="15" rx="4" fill="${color}"/>
    <rect x="40" y="19" width="40" height="7" rx="2.5" fill="${color}"/>
    <rect x="39" y="25" width="42" height="8" rx="2" fill="#87CEEB" stroke="${color}" stroke-width="1"/>
    <rect x="31" y="27" width="5" height="3.5" rx="1" fill="${color}"/>
    <rect x="84" y="27" width="5" height="3.5" rx="1" fill="${color}"/>
    <rect x="50" y="37" width="20" height="5" rx="1.5" fill="rgba(0,0,0,0.28)"/>
    <rect x="39" y="37" width="9" height="5" rx="1.5" fill="#fbbf24"/>
    <rect x="72" y="37" width="9" height="5" rx="1.5" fill="#fbbf24"/>
    <rect x="34" y="46" width="52" height="6" rx="2" fill="#374151"/>
    <rect x="51" y="46.5" width="18" height="5" rx="1" fill="#e5e7eb"/>
  </svg>
`

// [№41-РАКУРСЫ] Вид сзади (машина уходит ОТ зрителя — въезд за территорию
// вниз экрана). [№42-ПРОПОРЦИИ] геометрия корпуса идентична виду спереди,
// отличия только в деталях: тонированное заднее стекло, красные стоп-сигналы.
export const getCarSvgRear = (color: string): string => `
  <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="39" y="50" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="71" y="50" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="36" y="33" width="48" height="15" rx="4" fill="${color}"/>
    <rect x="40" y="19" width="40" height="7" rx="2.5" fill="${color}"/>
    <rect x="39" y="25" width="42" height="8" rx="2" fill="#87CEEB" opacity="0.75"/>
    <rect x="39" y="36" width="9" height="5" rx="1.5" fill="#ef4444"/>
    <rect x="72" y="36" width="9" height="5" rx="1.5" fill="#ef4444"/>
    <rect x="34" y="46" width="52" height="6" rx="2" fill="#374151"/>
    <rect x="51" y="46.5" width="18" height="5" rx="1" fill="#e5e7eb"/>
  </svg>
`

// [№41-РАКУРСЫ] Грузовик спереди. [№42-ПРОПОРЦИИ] торец кузова ШИРЕ кабины
// (x30..90 против x40..80) — кабина не занимает всю ширину; за ней видны
// затемнённые боковины кузова и рама. Отметки высот = канон профиля.
export const getTruckSvgFront = (color: string): string => `
  <svg viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
    <rect x="43" y="52" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="67" y="52" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="30" y="12" width="60" height="32" rx="2" fill="${color}" stroke="#111827" stroke-width="1.5"/>
    <rect x="30" y="12" width="60" height="6" rx="2" fill="#ffffff" opacity="0.18"/>
    <rect x="30" y="24" width="10" height="20" fill="rgba(0,0,0,0.18)"/>
    <rect x="80" y="24" width="10" height="20" fill="rgba(0,0,0,0.18)"/>
    <rect x="32" y="44" width="56" height="4.5" fill="#4b5563"/>
    <rect x="40" y="24" width="40" height="26" rx="2" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <rect x="42" y="28" width="36" height="9" rx="2" fill="#87CEEB"/>
    <rect x="46" y="21.5" width="4" height="2.5" rx="0.8" fill="#fbbf24"/>
    <rect x="58" y="21.5" width="4" height="2.5" rx="0.8" fill="#fbbf24"/>
    <rect x="70" y="21.5" width="4" height="2.5" rx="0.8" fill="#fbbf24"/>
    <rect x="43" y="41" width="7" height="4.5" rx="1.2" fill="#fbbf24"/>
    <rect x="70" y="41" width="7" height="4.5" rx="1.2" fill="#fbbf24"/>
    <rect x="52" y="41" width="16" height="4.5" rx="1.2" fill="rgba(0,0,0,0.3)"/>
    <rect x="38" y="47" width="44" height="6" rx="2" fill="#1f2937"/>
    <rect x="53" y="47.5" width="14" height="4.5" rx="1" fill="#e5e7eb"/>
  </svg>
`

// [№41-РАКУРСЫ] Грузовик сзади: полный торец кузова со швом грузовых дверей,
// красные габариты, рама, бампер с номером. [№42-ПРОПОРЦИИ] кузов y12..44,
// грунт y60 — те же линии, что у профиля и фаса.
export const getTruckSvgRear = (color: string): string => `
  <svg viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
    <rect x="35" y="52" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="75" y="52" width="10" height="8" rx="2" fill="#1f2937"/>
    <rect x="30" y="12" width="60" height="32" rx="2" fill="${color}" stroke="#111827" stroke-width="1.5"/>
    <rect x="30" y="12" width="60" height="6" rx="2" fill="#ffffff" opacity="0.18"/>
    <rect x="59" y="12" width="2" height="32" fill="#ffffff" opacity="0.3"/>
    <rect x="31" y="24" width="58" height="1.6" fill="#ffffff" opacity="0.14"/>
    <rect x="31" y="34" width="58" height="1.6" fill="#ffffff" opacity="0.14"/>
    <rect x="32" y="44" width="56" height="4.5" fill="#4b5563"/>
    <rect x="33" y="38" width="8" height="5" rx="1.2" fill="#ef4444"/>
    <rect x="79" y="38" width="8" height="5" rx="1.2" fill="#ef4444"/>
    <rect x="28" y="48" width="64" height="6" rx="2" fill="#4b5563"/>
    <rect x="53" y="48.5" width="14" height="4.5" rx="1" fill="#e5e7eb"/>
  </svg>
`

export const getRandomCarColor = (): string => {
  // [ИСПРАВЛЕНО] noUncheckedIndexedAccess: fallback на случай пустого справочника
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] ?? '#808080'
}

export const generateRealPersonSvg = (
  person: any,
  view: 'front' | 'back' = 'front',
  isMoving: boolean = true
): string => {
  const appearance: PersonAppearance = {
    gender: person.gender,
    ageGroup: person.ageGroup,
    skinTone: person.skinTone,
    eyeColor: person.eyeColor,
    hairColor: person.hairColor,
    hairStyleId: person.hairStyleId,
    hasRecedingHairline: person.hasRecedingHairline,
    facialHair: person.facialHair,
    headwear: person.headwear,
    headwearColor: person.headwearColor,
    glasses: person.glasses,
    clothingStyle: person.clothingStyle,
    topColor: person.topColor,
    bottomColor: person.bottomColor,
    skirtColor: person.skirtColor,
    shoeColor: person.shoeColor,
    bodyWidth: person.bodyWidth,
    faceWidth: person.faceWidth,
    animation: person.animation || { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 15 }
  }
  return renderPersonSvg(appearance, { view, isMoving, width: 80, height: 110 })
}
