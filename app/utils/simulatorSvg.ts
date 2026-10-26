// app/utils/simulatorSvg.ts
// Назначение: генерация SVG для машин и людей.

import { renderPersonSvg, type PersonAppearance } from './personSvgRenderer'

import { CAR_COLORS } from './simulatorConstants'

export const getCarSvg = (color: string): string => `
  <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,40 Q5,40 5,35 L5,50 Q5,55 10,55 L110,55 Q115,55 115,50 L115,35 Q115,40 110,40 Z" fill="#374151"/>
    <rect x="10" y="20" width="100" height="30" rx="5" fill="${color}"/>
    <path d="M25,20 Q30,5 50,5 L70,5 Q90,5 95,20 Z" fill="#87CEEB" stroke="${color}" stroke-width="2"/>
    <circle cx="30" cy="50" r="8" fill="#1f2937"/>
    <circle cx="30" cy="50" r="4" fill="#9ca3af"/>
    <circle cx="90" cy="50" r="8" fill="#1f2937"/>
    <circle cx="90" cy="50" r="4" fill="#9ca3af"/>
    <rect x="70" y="12" width="6" height="4" rx="1" fill="#fbbf24"/>
  </svg>
`

// [№31-ГРУЗОВИКИ] грузовой автомобиль: цветной будка-кузов + тёмная кабина.
// viewBox 120x65 (пропорция 1.85) — элемент 96x52 (TRUCK_*_SCALE от легковой).
export const getTruckSvg = (color: string): string => `
  <svg viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="46" width="112" height="7" rx="2" fill="#4b5563"/>
    <rect x="6" y="5" width="72" height="41" rx="3" fill="${color}" stroke="#111827" stroke-width="1.5"/>
    <rect x="6" y="5" width="72" height="9" rx="3" fill="#ffffff" opacity="0.18"/>
    <rect x="26" y="9" width="2" height="33" fill="#ffffff" opacity="0.12"/>
    <rect x="46" y="9" width="2" height="33" fill="#ffffff" opacity="0.12"/>
    <rect x="66" y="9" width="2" height="33" fill="#ffffff" opacity="0.12"/>
    <path d="M78,46 L78,24 Q78,15 86,15 L100,15 Q108,15 110,23 L114,37 L114,46 Z" fill="#374151" stroke="#111827" stroke-width="1.5"/>
    <path d="M82,26 Q82,20 88,20 L98,20 Q104,20 106,26 L108,32 L82,32 Z" fill="#87CEEB"/>
    <rect x="110" y="27" width="4" height="3" rx="1" fill="#fbbf24"/>
    <circle cx="20" cy="53" r="7" fill="#1f2937"/><circle cx="20" cy="53" r="3" fill="#9ca3af"/>
    <circle cx="42" cy="53" r="7" fill="#1f2937"/><circle cx="42" cy="53" r="3" fill="#9ca3af"/>
    <circle cx="94" cy="53" r="7" fill="#1f2937"/><circle cx="94" cy="53" r="3" fill="#9ca3af"/>
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