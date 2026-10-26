// tests/no33-children-ui.test.ts
// [№33] дети среди агентов + запрет выделения кнопок/подписей:
//  1) CHILD_AVATAR_SCALE — спрайт ребёнка 72% взрослого роста (дети были
//     в БД, но ageGroup не влиял на размер — «я не вижу детей среди агентов»);
//  2) сидер пишет корректный ageGroup (isChildPerson в спавне сработает);
//  3) main.css: кнопки, подписи (label) и окно симулятора без выделения.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { CHILD_AVATAR_SCALE } from '~/utils/simulatorConstants'
import { ageGroupForAge } from '~/utils/familyMath'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')

describe('[№33-ДЕТИ] детский масштаб и данные БД', () => {
  it('CHILD_AVATAR_SCALE — ребёнок заметно меньше взрослого', () => {
    expect(CHILD_AVATAR_SCALE).toBeGreaterThan(0.6)
    expect(CHILD_AVATAR_SCALE).toBeLessThan(0.85)
    expect(CHILD_AVATAR_SCALE).toBe(0.72)
  })

  it('сидер выводит ageGroup из возраста: дети 3..17 — child', () => {
    expect(ageGroupForAge(3)).toBe('child')
    expect(ageGroupForAge(10)).toBe('child')
    expect(ageGroupForAge(17)).toBe('child')
    expect(ageGroupForAge(30)).toBe('adult')
    expect(ageGroupForAge(65)).toBe('elder')
  })
})

describe('[№33-ВЫДЕЛЕНИЕ] кнопки и подписи не выделяются', () => {
  const css = readFileSync(resolve(root, 'app/assets/css/main.css'), 'utf8')

  it('button/.btn/label — user-select: none', () => {
    expect(css).toMatch(/button,\s*\.btn,\s*label\s*\{[^}]*user-select:\s*none/)
  })

  it('.simulator-widget целиком — user-select: none', () => {
    expect(css).toMatch(/\.simulator-widget,\s*\.simulator-widget \*\s*\{[^}]*user-select:\s*none/)
  })
})
