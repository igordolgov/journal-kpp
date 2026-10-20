// tests/sim-tuning.test.ts
// [ФИКС-флуд-4] юнит-тесты чистой санитизации интервалов спавна:
// пол против агрессивных сцен/ввода, потолок, гарантия max >= min + 15с
// (иначе getNextInterval даёт перевёрнутый диапазон), мусор -> дефолты.

import { describe, it, expect } from 'vitest'
import { sanitizeSpawnInterval } from '~/utils/simTuning'

describe('санитизация интервалов спавна (sanitizeSpawnInterval)', () => {
  it('пустые значения -> дефолты', () => {
    expect(sanitizeSpawnInterval(undefined, undefined, 45, 150, 60, 120)).toEqual({ min: 60, max: 120 })
    expect(sanitizeSpawnInterval(null, null, 60, 180, 90, 180)).toEqual({ min: 90, max: 180 })
  })

  it('пол поднимает агрессивные значения', () => {
    expect(sanitizeSpawnInterval(5, 10, 45, 150, 60, 120)).toEqual({ min: 45, max: 60 })
    expect(sanitizeSpawnInterval(1, 30, 60, 180, 90, 180)).toEqual({ min: 60, max: 75 })
  })

  it('максимум держится минимум на 15с выше', () => {
    expect(sanitizeSpawnInterval(100, 100, 45, 150, 60, 120)).toEqual({ min: 100, max: 115 })
  })

  it('мусор -> дефолты', () => {
    expect(sanitizeSpawnInterval('abc', -3, 45, 150, 60, 120)).toEqual({ min: 60, max: 120 })
    expect(sanitizeSpawnInterval(0, 0, 45, 150, 60, 120)).toEqual({ min: 60, max: 120 })
  })

  it('потолок отсекает экстремумы', () => {
    expect(sanitizeSpawnInterval(999, 9999, 45, 150, 60, 120)).toEqual({ min: 150, max: 300 })
    expect(sanitizeSpawnInterval(200, 500, 60, 180, 90, 180)).toEqual({ min: 180, max: 330 })
  })
})
