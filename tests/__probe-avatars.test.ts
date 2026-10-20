// tests/__probe-avatars.test.ts
// Назначение: ВИЗУАЛЬНЫЙ пробник конструктора персонажей. Запускается ТОЛЬКО с
// env PROBE_AVATARS=1 (в обычных прогонах скипается) и пишет SVG-листы-сетки в
// scripts/avatar-probe/out/ (вне src). Используется для ручного аудита
// посадки причёсок/лица/уборов: pnpm test -- __probe-avatars
import { describe, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { renderPersonSvg } from '~/utils/personSvgRenderer'
import type { PersonAppearance } from '~/utils/personSvgRenderer'

const OUT = '/home/z/my-project/scripts/avatar-probe/out'

const BASE: PersonAppearance = {
  gender: 'male',
  ageGroup: 'adult',
  skinTone: '#fbbf24',
  eyeColor: '#1e293b',
  hairColor: '#4a2c17',
  hairStyleId: 'short',
  headwear: 'none',
  glasses: 'none',
  clothingStyle: 'standard',
  topColor: '#3b82f6',
  bottomColor: '#1e293b',
  skirtColor: '#64748b',
  shoeColor: '#1f2937',
  bodyWidth: 1,
  faceWidth: 1,
  animation: { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 10 },
}

const STYLES = ['short', 'long', 'braid', 'ponytail', 'bun', 'curly', 'mohawk', 'bald'] as const
// male-стили рендерим мужчиной, женские — женщиной (enforcement совпадает с рантаймом)
const genderFor = (s: string) => (['long', 'braid', 'ponytail', 'bun'].includes(s) ? 'female' : 'male')

const cell = (look: PersonAppearance, view: 'front' | 'back', x: number, y: number): string => {
  const inner = renderPersonSvg(look, { view, isMoving: false })
    .replace('<svg viewBox="0 0 50 100" width="100%" height="100%"', `<svg x="${x}" y="${y}" width="50" height="100" viewBox="0 0 50 100"`)
  return inner
}

const sheet = (name: string, rows: Array<{ label: string; make: (s: string) => PersonAppearance; view: 'front' | 'back' }>): void => {
  const CW = 62   // шаг колонки
  const CH = 122  // шаг строки
  const W = 40 + STYLES.length * CW
  const H = 30 + rows.length * CH
  let body = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f8fafc"/>`
  rows.forEach((row, ri) => {
    body += `<text x="6" y="${30 + ri * CH + 58}" font-family="DejaVu Sans" font-size="9" fill="#475569">${row.label}</text>`
    STYLES.forEach((s, ci) => {
      const x = 40 + ci * CW
      const y = 30 + ri * CH
      body += `<rect x="${x - 3}" y="${y - 3}" width="56" height="106" fill="#ffffff" stroke="#e2e8f0"/>`
      body += `<line x1="${x - 3}" y1="${y + 96.4}" x2="${x + 53}" y2="${y + 96.4}" stroke="#cbd5e1" stroke-width="0.6"/>`
      body += cell(row.make(s), row.view, x, y)
      body += `<text x="${x}" y="${y + 112}" font-family="DejaVu Sans" font-size="8" fill="#94a3b8">${s}</text>`
    })
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
  writeFileSync(`${OUT}/${name}.svg`, svg)
}

describe.skipIf(!process.env.PROBE_AVATARS)('probe: листы аватаров', () => {
  it('пишет SVG-сетки в scripts/avatar-probe/out', () => {
    mkdirSync(OUT, { recursive: true })

    sheet('01-front-back', [
      { label: 'front fw=1', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s }) },
      { label: 'back fw=1', view: 'back', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s }) },
      { label: 'front fw=0.8', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, faceWidth: 0.8 }) },
      { label: 'front fw=1.2', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, faceWidth: 1.2 }) },
      { label: 'back fw=0.8', view: 'back', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, faceWidth: 0.8 }) },
    ])

    sheet('02-hats', [
      { label: 'cap front', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, headwear: 'cap', headwearColor: '#b91c1c' }) },
      { label: 'cap back', view: 'back', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, headwear: 'cap', headwearColor: '#b91c1c' }) },
      { label: 'beanie front', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, headwear: 'beanie', headwearColor: '#0d9488' }) },
      { label: 'hat front', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, headwear: 'hat', headwearColor: '#334155' }) },
      { label: 'hat back', view: 'back', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, headwear: 'hat', headwearColor: '#334155' }) },
    ])

    sheet('03-elder-receding', [
      { label: 'elder M front', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, ageGroup: 'elder' }) },
      { label: 'elder M back', view: 'back', make: (s) => ({ ...BASE, hairStyleId: s, ageGroup: 'elder' }) },
      { label: 'receding M front', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, hasRecedingHairline: true }) },
      { label: 'receding M back', view: 'back', make: (s) => ({ ...BASE, hairStyleId: s, hasRecedingHairline: true }) },
    ])

    sheet('04-face', [
      { label: 'glasses', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, glasses: 'glasses' }) },
      { label: 'round', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, glasses: 'round' }) },
      { label: 'sunglasses', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, glasses: 'sunglasses' }) },
      { label: 'beard', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, facialHair: 'beard' }) },
      { label: 'mustache', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, facialHair: 'mustache' }) },
      { label: 'goatee', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, facialHair: 'goatee' }) },
      { label: 'stubble', view: 'front', make: (s) => ({ ...BASE, hairStyleId: s, facialHair: 'stubble' }) },
      { label: 'hoodie', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, clothingStyle: 'hoodie', topColor: '#7c3aed' }) },
    ])

    sheet('05-child-widths', [
      { label: 'child front', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, ageGroup: 'child' }) },
      { label: 'child back', view: 'back', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, ageGroup: 'child' }) },
      { label: 'bw=0.8', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, bodyWidth: 0.8 }) },
      { label: 'bw=1.2', view: 'front', make: (s) => ({ ...BASE, gender: genderFor(s) as 'male' | 'female', hairStyleId: s, bodyWidth: 1.2 }) },
    ])
  })
})
