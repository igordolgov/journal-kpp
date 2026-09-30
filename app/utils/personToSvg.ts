// app/utils/personToSvg.ts
// Назначение: генерация упрощённого SVG-портрета человека (превью/экспорт).
// [ИСПРАВЛЕНО v2] Ошибка v1: аннотация Record<string, string> стояла на
// ПЕРЕМЕННОЙ (результат индексации), а не на справочнике — объектный литерал
// не получал контекстный тип, ключи 'none'/'stubble' не существовали.
// Теперь: справочник — отдельная константа с аннотацией, лукап — отдельно.
// [ДОБАВЛЕНО] ключи 'none' и 'stubble' — поля PersonAppearance являются
// union-типами и включают эти значения (stubble использует сидер аватаров).
import type { PersonAppearance } from './personSvgRenderer'

export const personToSvg = (appearance: PersonAppearance): string => {
  // Безопасные значения по умолчанию
  const skin = appearance.skinTone || '#fcd34d'
  const hair = appearance.hairColor || '#292524'
  const top = appearance.topColor || '#3b82f6'
  const bottom = appearance.bottomColor || '#1e3a8a'

  // --- Справочники SVG-фрагментов (аннотация на САМОМ объекте) ---
  const hairPathMap: Record<string, string> = {
    short: `<path d="M25 35 Q50 15 75 35 Q75 25 50 20 Q25 25 25 35" fill="${hair}"/>`,
    long: `<path d="M25 30 Q50 0 75 30 L75 60 Q60 65 50 60 Q40 65 25 60 Z" fill="${hair}"/>`,
    curly: `<path d="M25 35 Q20 25 30 20 Q40 10 50 15 Q60 10 70 20 Q80 25 75 35 Q70 30 50 25 Q30 30 25 35" fill="${hair}"/>`,
    bald: ``
  }

  const facialHairMap: Record<string, string> = {
    none: ``,
    mustache: `<path d="M40 55 Q45 52 50 55 Q55 52 60 55 Q60 58 50 60 Q40 58 40 55" fill="${hair}" fill-opacity="0.9"/>`,
    beard: `<path d="M30 55 Q35 75 50 78 Q65 75 70 55 Q70 65 50 68 Q30 65 30 55" fill="${hair}" fill-opacity="0.9"/>`,
    goatee: `<path d="M45 58 L50 75 L55 58 Q50 60 45 58" fill="${hair}" fill-opacity="0.9"/>`,
    // [ДОБАВЛЕНО] щетина — лёгкий полупрозрачный контур
    stubble: `<path d="M38 52 Q50 60 62 52 Q50 66 38 52" fill="${hair}" fill-opacity="0.35"/>`
  }

  const hatMap: Record<string, string> = {
    none: ``,
    cap: `<path d="M25 35 Q25 15 50 15 Q75 15 75 35 L75 40 L25 40 Z" fill="${appearance.headwearColor || '#333'}"/>`,
    hat: `<ellipse cx="50" cy="35" rx="35" ry="8" fill="${appearance.headwearColor || '#333'}"/><path d="M25 35 Q25 10 50 10 Q75 10 75 35" fill="${appearance.headwearColor || '#333'}"/>`,
    beanie: `<path d="M25 40 Q25 10 50 10 Q75 10 75 40 Q75 45 70 45 L30 45 Q25 45 25 40" fill="${appearance.headwearColor || '#333'}"/><circle cx="50" cy="10" r="5" fill="#fff"/>`
  }

  // --- Лукапы ---
  // noUncheckedIndexedAccess: обращение по string-ключу даёт string | undefined —
  // '|| ""' возвращает пустой фрагмент для неизвестных стилей (braid, mohawk и т.д.
  // в этом упрощённом портрете не рисуются — полный рендер делает personSvgRenderer)
  const hairPath = hairPathMap[appearance.hairStyleId || 'short'] || ''
  const facialHairPath = facialHairMap[appearance.facialHair || 'none'] || ''
  const hatGroup = hatMap[appearance.headwear || 'none'] || ''

  return `
    <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
      <!-- Тень -->
      <ellipse cx="50" cy="190" rx="20" ry="5" fill="rgba(0,0,0,0.15)"/>

      <!-- Ноги -->
      <rect x="35" y="140" width="12" height="50" fill="${bottom}" rx="2"/>
      <rect x="53" y="140" width="12" height="50" fill="${bottom}" rx="2"/>
      <!-- Обувь -->
      <rect x="33" y="185" width="16" height="8" fill="#1f2937" rx="2"/>
      <rect x="51" y="185" width="16" height="8" fill="#1f2937" rx="2"/>

      <!-- Туловище -->
      <rect x="25" y="70" width="50" height="75" fill="${top}" rx="5"/>

      <!-- Руки -->
      <rect x="10" y="75" width="15" height="45" fill="${top}" rx="5"/>
      <circle cx="17" cy="120" r="7" fill="${skin}"/>
      <rect x="75" y="75" width="15" height="45" fill="${top}" rx="5"/>
      <circle cx="83" cy="120" r="7" fill="${skin}"/>

      <!-- Голова -->
      <rect x="40" y="60" width="20" height="15" fill="${skin}"/>
      <circle cx="50" cy="45" r="25" fill="${skin}"/>
      <circle cx="25" cy="45" r="5" fill="${skin}"/>
      <circle cx="75" cy="45" r="5" fill="${skin}"/>

      <!-- Волосы -->
      ${hairPath}

      <!-- Лицо -->
      <path d="M35 38 Q40 35 45 38" stroke="#333" stroke-width="2" fill="none"/>
      <path d="M55 38 Q60 35 65 38" stroke="#333" stroke-width="2" fill="none"/>
      <circle cx="40" cy="45" r="2" fill="#333"/>
      <circle cx="60" cy="45" r="2" fill="#333"/>
      <path d="M45 58 Q50 62 55 58" stroke="#d97706" stroke-width="2" fill="none"/>

      <!-- Борода -->
      ${facialHairPath}

      <!-- Головной убор -->
      ${hatGroup}
    </svg>
  `
}