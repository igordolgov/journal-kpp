// app/composables/usePersonGenerator.ts
// Назначение: генератор случайной внешности персонажей (IPersonAppearance).
// [ИСПРАВЛЕНО]: индексация палитр даёт string | undefined (noUncheckedIndexedAccess)
// — введён хелпер pick(); clothingStyle добавлен в интерфейс (использовался в
// логике юбки/платья, но не был объявлен); includes защищён fallback'ом.
import { reactive } from 'vue'
import { nanoid } from 'nanoid'

export interface IPersonAppearance {
  id: string
  name?: string
  gender: 'male' | 'female'
  ageGroup: 'child' | 'adult' | 'elder'
  skinTone: string
  hairColor: string
  hairStyleId: string
  hasRecedingHairline: boolean
  facialHair: string
  headwear: string
  headwearColor: string
  topColor: string
  bottomColor: string
  // [ДОБАВЛЕНО] стиль одежды влияет на цвет низа (юбка/платье -> тон кожи)
  clothingStyle?: string
  accessories: string[]
  animation: {
    speed: number
    swingAmplitude: number
    bounceAmplitude: number
    armSwing: number
  }
}

type PersonOverrides = Partial<IPersonAppearance>

const PALETTES = {
  eyes: ['#4A5D23', '#3E2723', '#1E88E5', '#000000', '#5D4037', '#81C784'],
  skin: ['#fcd34d', '#fbbf24', '#d4a574', '#a67c52', '#8b5a2b', '#4a3728'],
  hair: ['#292524', '#78350f', '#b45309', '#fbbf24', '#dc2626', '#d1d5db', '#9ca3af'],
  clothes: {
    tops: ['#3b82f6', '#22c55e', '#ef4444', '#ffffff', '#1f2937', '#6b7280', '#f97316', '#8b5cf6'],
    bottoms: ['#1e3a8a', '#374151', '#4b5563', '#78350f', '#111827']
  },
  shoes: ['#1f2937', '#000000', '#78350f', '#7c2d12', '#f5f5f4', '#d1d5db'],
  hats: ['#1f2937', '#dc2626', '#3b82f6', '#78350f', '#6b7280']
}

// [ДОБАВЛЕНО] безопасный выбор из палитры: обращение по индексу даёт
// string | undefined — fallback страхует от пустого справочника
const pick = (arr: readonly string[], fallback: string): string =>
  arr[Math.floor(Math.random() * arr.length)] ?? fallback

export const usePersonGenerator = () => {

  const createRandomPerson = (overrides: PersonOverrides = {}): IPersonAppearance => {
    // 1. Базовые характеристики
    const gender = overrides.gender || (Math.random() > 0.5 ? 'male' : 'female')

    // Распределение возрастов: 20% дети, 60% взрослые, 20% пожилые
    let ageGroup = overrides.ageGroup || 'adult'
    if (!overrides.ageGroup) {
      const ageRoll = Math.random()
      if (ageRoll < 0.2) ageGroup = 'child'
      else if (ageRoll > 0.8) ageGroup = 'elder'
    }

    // 2. Цвета
    const skinTone = overrides.skinTone || pick(PALETTES.skin, '#fcd34d')
    const hairColor = overrides.hairColor || pick(PALETTES.hair, '#292524')

    // 3. Логика причесок по правилам
    let hairStyleId = 'short'
    let hasRecedingHairline = false

    if (gender === 'male') {
      if (ageGroup === 'child') {
        hairStyleId = pick(['short', 'bald', 'mohawk'], 'short')
      } else if (ageGroup === 'elder') {
        hairStyleId = Math.random() > 0.3 ? 'short' : 'bald'
        if (hairStyleId === 'short') hasRecedingHairline = Math.random() > 0.2
      } else {
        // Взрослый мужчина
        hairStyleId = Math.random() > 0.15 ? 'short' : 'bald'
        // [НАСТРОЙКА] 40% шанс залысин у взрослого мужчины с короткой стрижкой
        if (hairStyleId === 'short' && Math.random() > 0.6) {
          hasRecedingHairline = true;
        }
      }
    } else {
      // Женщины
      if (ageGroup === 'child') {
        hairStyleId = pick(['short', 'long', 'ponytail', 'bun', 'mohawk'], 'short')
      } else {
        hairStyleId = pick(['short', 'long', 'ponytail', 'bun'], 'short')
      }
    }

    // 4. Растительность на лице
    let facialHair = 'none'
    if (gender === 'male' && ageGroup !== 'child' && Math.random() < 0.4) {
      facialHair = pick(['mustache', 'beard', 'goatee'], 'none')
    }

    // 5. Головной убор
    let headwear = 'none'
    if (Math.random() < 0.25) {
      headwear = pick(['cap', 'hat', 'beanie'], 'none')
    }

    // 6. Формирование объекта
    return reactive({
      id: nanoid(6),
      name: '',
      gender,
      ageGroup,
      skinTone,
      hairColor,
      hairStyleId,
      hasRecedingHairline,
      facialHair,
      headwear,
      headwearColor: pick(PALETTES.hats, '#1f2937'),
      topColor: pick(PALETTES.clothes.tops, '#3b82f6'),
      bottomColor: overrides.bottomColor
        || (['skirt', 'dress'].includes(overrides.clothingStyle || '') ? skinTone : pick(PALETTES.clothes.bottoms, '#1e3a8a')),
      accessories: Math.random() > 0.8 ? ['glasses'] : [],
      animation: {
        speed: 1,
        swingAmplitude: 5,
        bounceAmplitude: 3,
        armSwing: 10
      },
      ...overrides
    })
  }

  return {
    createRandomPerson,
    PALETTES
  }
}