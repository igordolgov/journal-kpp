// app/composables/usePersonGenerator.ts
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
    const skinTone = overrides.skinTone || PALETTES.skin[Math.floor(Math.random() * PALETTES.skin.length)]
    const hairColor = overrides.hairColor || PALETTES.hair[Math.floor(Math.random() * PALETTES.hair.length)]

    // 3. Логика причесок по правилам
    let hairStyleId = 'short'
    let hasRecedingHairline = false

    if (gender === 'male') {
      if (ageGroup === 'child') {
        hairStyleId = ['short', 'bald', 'mohawk'][Math.floor(Math.random() * 3)]
      } else if (ageGroup === 'elder') {
        hairStyleId = Math.random() > 0.3 ? 'short' : 'bald'
        if (hairStyleId === 'short') hasRecedingHairline = Math.random() > 0.2 
      } else {
        // Взрослый мужчина
        hairStyleId = Math.random() > 0.15 ? 'short' : 'bald'
        // 40% шанс, что у взрослого мужчины с короткой стрижкой будут залысины
        if (hairStyleId === 'short' && Math.random() > 0.6) {
          hasRecedingHairline = true;
        }
      }
    } else {
      // Женщины
      if (ageGroup === 'child') {
        hairStyleId = ['short', 'long', 'ponytail', 'bun', 'mohawk'][Math.floor(Math.random() * 5)]
      } else {
        hairStyleId = ['short', 'long', 'ponytail', 'bun'][Math.floor(Math.random() * 4)]
      }
    }

    // 4. Растительность на лице
    let facialHair = 'none'
    if (gender === 'male' && ageGroup !== 'child' && Math.random() < 0.4) {
      facialHair = ['mustache', 'beard', 'goatee'][Math.floor(Math.random() * 3)]
    }

    // 5. Головной убор
    let headwear = 'none'
    if (Math.random() < 0.25) {
      headwear = ['cap', 'hat', 'beanie'][Math.floor(Math.random() * 3)]
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
      headwearColor: PALETTES.hats[Math.floor(Math.random() * PALETTES.hats.length)],
      topColor: PALETTES.clothes.tops[Math.floor(Math.random() * PALETTES.clothes.tops.length)],
      bottomColor: overrides.bottomColor || (['skirt', 'dress'].includes(overrides.clothingStyle) ? skinTone : PALETTES.clothes.bottoms[Math.floor(Math.random() * PALETTES.clothes.bottoms.length)]),
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