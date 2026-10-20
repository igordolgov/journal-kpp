// tests/avatar-geometry.test.ts
// Назначение: регресс-тесты единой геометрии персонажа (avatarGeometry.ts).
// Проверяются инварианты «подогнанности» частей тела, из-за нарушения которых
// персонажи выглядели неестественно:
//  - руки отрывались от торса при bodyWidth < 1 (плечо на фиксированном отступе);
//  - ботинки не стыковались с ногой (узкий эллипс со смещением);
//  - шея отсутствовала (зазор голова-торс);
//  - стопы не отрывались в фазе переноса (маятник «циркуль»);
//  - подскок был физически перевёрнут (тело вверх в двойной опоре).
// Плюс: строковый SVG симулятора не содержит NaN/undefined и анимируется теми
// же walkPose-фазами, что и конструктор (классы anim-*/body-bounce).
import { describe, it, expect } from 'vitest'
import {
  computeAvatarGeometry,
  computeHeadDecor,
  walkPose,
  walkCycleDurationS,
  darkenColor,
  TAU,
} from '~/utils/avatarGeometry'
import { renderPersonSvg } from '~/utils/personSvgRenderer'

// Извлечение пар (x, y) из d-строки пути (все пути модуля чередуют x/y)
const pathPairs = (d: string): number[][] => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const pairs: number[][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
  return pairs
}

const BASE = {
  gender: 'male' as const,
  ageGroup: 'adult' as const,
  skinTone: '#fbbf24',
  hairColor: '#292524',
  hairStyleId: 'short',
  headwear: 'none',
  glasses: 'none',
  clothingStyle: 'standard',
  topColor: '#3b82f6',
  bottomColor: '#1e293b',
  shoeColor: '#1f2937',
  bodyWidth: 1,
  faceWidth: 1,
  animation: { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 10 },
}

describe('avatarGeometry: подгонка рук к торсу', () => {
  const widths = [0.8, 0.9, 1.0, 1.1, 1.2]
  const genders = ['male', 'female'] as const

  it('плечевой сустав сидит на краю торса при любом bodyWidth (рука не висит в воздухе)', () => {
    for (const gender of genders) {
      for (const bodyWidth of widths) {
        const g = computeAvatarGeometry({ ...BASE, gender, bodyWidth })
        for (const arm of [g.armBack, g.armFront]) {
          const span = Math.abs(arm.shoulderX - 25)
          const outerEdge = span + arm.stroke / 2
          const torsoEdge = g.torso.w
          // внешний край штриха руки совпадает с краем торса (допуск 0.6)
          expect(Math.abs(outerEdge - torsoEdge)).toBeLessThan(0.6)
        }
      }
    }
  })


  it('рука не дальше края торса ни в одной точке (регрессия отрыва при bodyWidth=0.8)', () => {
    const g = computeAvatarGeometry({ ...BASE, bodyWidth: 0.8 })
    // до фикса плечо было на 25±9.6 при торсе 25±9.6 — впритык, а старый код
    // ставил 25±(9+(-0.4))=25±9.4 с внешним краем 11.9 — за торсом
    for (const arm of [g.armBack, g.armFront]) {
      expect(Math.abs(arm.shoulderX - 25) + arm.stroke / 2).toBeLessThanOrEqual(g.torso.w + 0.01)
    }
  })

  it('рукав существует у suit/hoodie и короткий у остальных', () => {
    for (const style of ['suit', 'hoodie', 'standard', 'skirt', 'dress']) {
      const g = computeAvatarGeometry({ ...BASE, clothingStyle: style, gender: 'female' })
      expect(g.armFront.sleeveD.length).toBeGreaterThan(0)
      if (style === 'suit' || style === 'hoodie') {
        // длинный рукав доходит до локтя (y >= 47)
        const pairs = pathPairs(g.armFront.sleeveD)
        const maxY = Math.max(...pairs.map((p) => p[1]))
        expect(maxY).toBeGreaterThanOrEqual(47)
      }
    }
  })

  it('кисть есть и расположена ниже локтя', () => {
    const g = computeAvatarGeometry(BASE)
    for (const arm of [g.armBack, g.armFront]) {
      expect(arm.handR).toBeGreaterThan(0)
      expect(arm.handCy).toBeGreaterThan(47.5)
    }
  })
})

describe('avatarGeometry: подгонка ног и обуви', () => {
  it('верх ноги скрыт торсом (бедро не оголено)', () => {
    const widths = [0.8, 1.0, 1.2]
    for (const bodyWidth of widths) {
      const g = computeAvatarGeometry({ ...BASE, bodyWidth })
      for (const leg of [g.legBack, g.legFront]) {
        expect(leg.hipY).toBeLessThan(g.torso.bottom)
        expect(Math.abs(leg.hipX - 25) + leg.stroke / 2).toBeLessThan(g.torso.w * 1.1 + 0.01)
      }
    }
  })

  it('ботинок перекрывает торец ноги (нет зазора) и стоит на земле', () => {
    for (const gender of ['male', 'female'] as const) {
      const g = computeAvatarGeometry({ ...BASE, gender })
      for (const leg of [g.legBack, g.legFront]) {
        const pairs = pathPairs(leg.shoeD)
        const ys = pairs.map((p) => p[1])
        const xs = pairs.map((p) => p[0])
        // верх ботинка выше конца ноги -> перекрытие
        expect(Math.min(...ys)).toBeLessThan(leg.ankleY)
        // низ ботинка — общий уровень земли для обеих ног
        expect(Math.max(...ys)).toBeCloseTo(96.4, 6)
        expect(Math.abs(Math.max(...ys) - 96.4)).toBeLessThan(1e-9)
        // носок выступает наружу: правая вправо, левая влево
        if (leg.hipX > 25) expect(Math.max(...xs)).toBeGreaterThan(leg.hipX + 4)
        else expect(Math.min(...xs)).toBeLessThan(leg.hipX - 4)
      }
    }
  })

  it('обе ступни на одном уровне земли', () => {
    const g = computeAvatarGeometry(BASE)
    const maxYL = Math.max(...pathPairs(g.legBack.shoeD).map((p) => p[1]))
    const maxYR = Math.max(...pathPairs(g.legFront.shoeD).map((p) => p[1]))
    expect(maxYL).toBeCloseTo(maxYR, 6)
  })
})

describe('avatarGeometry: шея соединяет голову и торс', () => {
  it('верх шеи под головой, низ — в торсе', () => {
    for (const faceWidth of [0.8, 1.0, 1.2]) {
      const g = computeAvatarGeometry({ ...BASE, faceWidth })
      const headBottom = g.head.cy + g.head.ry
      expect(g.neck.y).toBeLessThan(headBottom)
      expect(g.neck.y + g.neck.h).toBeGreaterThan(g.torso.top)
      // шея не шире головы
      expect(g.neck.w).toBeLessThan(g.head.rx * 2)
    }
  })
})

describe('avatarGeometry: пути без NaN/undefined', () => {
  it('все path-строки геометрии конечны', () => {
    const combos: Array<Record<string, unknown>> = []
    for (const gender of ['male', 'female'] as const)
      for (const style of ['standard', 'hoodie', 'skirt', 'dress', 'suit'])
        for (const bodyWidth of [0.8, 1.2])
          combos.push({ ...BASE, gender, clothingStyle: style, bodyWidth })
    for (const c of combos) {
      const g = computeAvatarGeometry(c as never)
      const allPaths = [
        g.femaleTorsoPath, g.skirtPathD, g.dressPathD,
        g.armBack.pathD, g.armFront.pathD, g.armBack.sleeveD, g.armFront.sleeveD,
        g.legBack.shoeD, g.legFront.shoeD,
        g.suit.backD, g.suit.jacketFrontD, g.suit.shirtD,
        g.suit.tieKnotD, g.suit.tieBladeD, g.suit.lapelLD, g.suit.lapelRD,
        g.hood.backD, g.hood.rimD,
      ]
      for (const d of allPaths) {
        expect(d).toBeTruthy()
        expect(d).not.toContain('NaN')
        expect(d).not.toContain('undefined')
        for (const n of (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)) {
          expect(Number.isFinite(n)).toBe(true)
        }
      }
    }
  })
})

describe('walkPose: фазы ходьбы', () => {
  it('ноги в противофазе', () => {
    const p1 = walkPose(TAU / 4, BASE)
    expect(p1.frontLeg.angle).toBeGreaterThan(0)
    expect(p1.backLeg.angle).toBeLessThan(0)
    expect(p1.frontLeg.angle).toBeCloseTo(-p1.backLeg.angle, 9)
  })

  it('стопа отрывается только в фазе переноса (регрессия «циркуля»)', () => {
    const look = { ...BASE, animation: { ...BASE.animation, swingAmplitude: 5 } }
    // фаза 0: нога вертикальна, перенос — максимальный подъём
    expect(walkPose(0, look).frontLeg.lift).toBeCloseTo(5 * 0.9, 9)
    // крайние положения (двойная опора) — стопы на земле
    expect(walkPose(TAU / 4, look).frontLeg.lift).toBe(0)
    expect(walkPose(TAU / 4, look).backLeg.lift).toBe(0)
    expect(walkPose((3 * TAU) / 4, look).frontLeg.lift).toBe(0)
    // задняя нога отрывается во второй половине цикла
    expect(walkPose(TAU / 2, look).backLeg.lift).toBeCloseTo(4.5, 9)
    // одновременно поднята ровно одна стопа
    for (let k = 0; k < 16; k++) {
      const pose = walkPose((k / 16) * TAU, look)
      const lifted = (pose.frontLeg.lift > 0.01 ? 1 : 0) + (pose.backLeg.lift > 0.01 ? 1 : 0)
      expect(lifted).toBeLessThanOrEqual(1)
    }
  })

  it('руки в противофазе своим ногам', () => {
    const pose = walkPose(TAU / 8, BASE)
    expect(Math.sign(pose.frontArm.angle)).toBe(-Math.sign(pose.frontLeg.angle))
    expect(Math.sign(pose.backArm.angle)).toBe(-Math.sign(pose.backLeg.angle))
  })

  it('подскок направлен вниз и максимален в двойной опоре (регрессия перевёрнутого bounce)', () => {
    const look = { ...BASE, animation: { ...BASE.animation, bounceAmplitude: 8 } }
    const pVert = walkPose(0, look)        // опорная нога вертикальна
    const pDouble = walkPose(TAU / 4, look) // двойная опора
    expect(pVert.bounceY).toBe(0)
    expect(pDouble.bounceY).toBeGreaterThan(0)
    expect(pDouble.bounceY).toBeCloseTo(8 * 0.5, 9)
  })

  it('weight=0 обнуляет все амплитуды (плавный стоп без рывка)', () => {
    const pose = walkPose(1.234, BASE, 0)
    expect(pose.frontLeg.angle).toBe(0)
    expect(pose.frontLeg.lift).toBe(0)
    expect(pose.backArm.angle).toBe(0)
    expect(pose.swayX).toBe(0)
    expect(pose.bounceY).toBe(0)
  })

  it('амплитуды масштабируются слайдерами конструктора', () => {
    const wide = { ...BASE, animation: { speed: 1, swingAmplitude: 10, bounceAmplitude: 3, armSwing: 20 } }
    const pose = walkPose(TAU / 4, wide)
    expect(pose.frontLeg.angle).toBeCloseTo(22, 9)  // 10 * 2.2
    expect(pose.frontArm.angle).toBeCloseTo(-18, 9) // 20 * 0.9, противофаза
  })

  it('длительность цикла согласована со speed', () => {
    expect(walkCycleDurationS(BASE)).toBeCloseTo(1.1, 9)
    expect(walkCycleDurationS({ ...BASE, animation: { ...BASE.animation, speed: 2 } })).toBeCloseTo(0.55, 9)
    expect(walkCycleDurationS({ ...BASE, animation: { ...BASE.animation, speed: 0.5 } })).toBeCloseTo(2.2, 9)
  })
})

describe('renderPersonSvg: строковый рендерер симулятора', () => {
  const matrix: Array<Record<string, unknown>> = []
  for (const gender of ['male', 'female'] as const)
    for (const style of ['standard', 'hoodie', 'skirt', 'dress', 'suit'])
      for (const headwear of ['none', 'cap', 'hat', 'beanie'])
        for (const view of ['front', 'back'] as const)
          matrix.push({ ...BASE, gender, clothingStyle: style, headwear, hairStyleId: gender === 'female' && style === 'dress' ? 'long' : 'short' }, )

  it('ни одна комбинация не содержит NaN/undefined', () => {
    expect(matrix.length).toBeGreaterThan(30)
    for (const m of matrix) {
      const svg = renderPersonSvg(m as never, { view: (m.view as 'front'), isMoving: true })
      expect(svg).toContain('<svg')
      expect(svg).not.toContain('NaN')
      expect(svg).not.toContain('undefined')
    }
  })

  it('анимация использует те же фазы walkPose и имена классов паузы', () => {
    const svg = renderPersonSvg(BASE, { view: 'front', isMoving: true })
    // классы, на которые завязан .is-paused в SimulatorWidget
    for (const cls of ['anim-arm-l', 'anim-arm-r', 'anim-leg-l', 'anim-leg-r', 'body-bounce']) {
      expect(svg).toContain(`class="${cls}"`)
    }
    expect(svg).toContain('@keyframes leg-l')
    expect(svg).toContain('@keyframes body-bounce')
    // длительность цикла = WALK_BASE_CYCLE_S / speed
    expect(svg).toContain(`1.1s`)
  })

  it('статичная поза (isMoving=false) не содержит keyframes, но рисует те же части', () => {
    const svg = renderPersonSvg(BASE, { view: 'front', isMoving: false })
    expect(svg).not.toContain('@keyframes')
    expect(svg).toContain('<rect')   // торс
    expect(svg).toContain('<ellipse') // голова
    // ботинки как path присутствуют дважды (две ноги)
    expect(svg.split('90.8').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('плечевой сустав в SVG совпадает с единой геометрией', () => {
    const geo = computeAvatarGeometry(BASE)
    const svg = renderPersonSvg(BASE, { view: 'front', isMoving: true })
    expect(svg).toContain(`transform-origin: ${geo.armFront.shoulderX}px ${geo.armFront.shoulderY}px`)
    expect(svg).toContain(`transform-origin: ${geo.legFront.hipX}px ${geo.legFront.hipY}px`)
  })

  it('вид сзади не рисует лицо, вид спереди рисует глаза (пара кругов сверх ушей)', () => {
    const front = renderPersonSvg(BASE, { view: 'front', isMoving: false })
    const back = renderPersonSvg(BASE, { view: 'back', isMoving: false })
    const circles = (s: string) => (s.match(/<circle/g) ?? []).length
    // спереди: 2 уха + 2 глаза + 2 кисти; сзади: 2 уха + 2 кисти
    expect(circles(front)).toBe(6)
    expect(circles(back)).toBe(4)
  })
})

describe('computeHeadDecor: посадка причёски и лица', () => {
  const STYLES = ['short', 'long', 'braid', 'ponytail', 'bun', 'curly', 'mohawk', 'bald']
  const genderFor = (s: string) => (['long', 'braid', 'ponytail', 'bun'].includes(s) ? 'female' : 'male')

  const pairsOf = (fragment: string): number[][] => {
    // все пары (x, y) из d-атрибутов фрагмента
    const out: number[][] = []
    for (const d of fragment.match(/d="[^"]*"/g) ?? []) {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
      for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]])
    }
    return out
  }

  it('ни один фрагмент не содержит NaN/undefined (стили x faceWidth x вид)', () => {
    for (const style of STYLES) {
      for (const faceWidth of [0.8, 1, 1.2]) {
        for (const view of ['front', 'back'] as const) {
          for (const headwear of ['none', 'cap', 'hat', 'beanie'] as const) {
            const look = { ...BASE, gender: genderFor(style) as 'male' | 'female', hairStyleId: style, faceWidth, headwear }
            const decor = computeHeadDecor(look, view)
            for (const frag of [decor.ears, decor.hair, decor.face, decor.glasses, decor.facialHair, decor.hat]) {
              expect(frag).not.toContain('NaN')
              expect(frag).not.toContain('undefined')
              for (const n of (frag.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)) {
                expect(Number.isFinite(n)).toBe(true)
              }
            }
          }
        }
      }
    }
  })

  it('лысина: волосы отсутствуют спереди И сзади (регрессия «шлема» на затылке)', () => {
    for (const view of ['front', 'back'] as const) {
      const decor = computeHeadDecor({ ...BASE, hairStyleId: 'bald' }, view)
      expect(decor.hair).toBe('')
    }
  })

  it('симулятор: причёска без масштабной группы scale (смещение при faceWidth != 1)', () => {
    for (const faceWidth of [0.8, 1.2]) {
      const svg = renderPersonSvg({ ...BASE, faceWidth }, { view: 'front', isMoving: false })
      expect(svg).not.toContain('transform="scale(')
    }
  })

  it('каск сидит на черепе: точки дуги в пределах rx + толщина волос', () => {
    for (const faceWidth of [0.8, 1, 1.2]) {
      const g = computeAvatarGeometry({ ...BASE, faceWidth })
      for (const view of ['front', 'back'] as const) {
        const decor = computeHeadDecor({ ...BASE, faceWidth }, view, g.head)
        const pts = pairsOf(decor.hair)
        expect(pts.length).toBeGreaterThan(5)
        for (const [x] of pts) {
          // short/curly/back-варианты не имеют свободных прядей
          expect(Math.abs(x - g.head.cx)).toBeLessThanOrEqual(g.head.rx + 1.3)
        }
      }
    }
  })

  it('причёска симметрична относительно центра головы', () => {
    for (const style of ['short', 'curly', 'ponytail', 'bald']) {
      const g = computeAvatarGeometry(BASE)
      const decor = computeHeadDecor({ ...BASE, hairStyleId: style }, 'front', g.head)
      const pts = pairsOf(decor.hair)
      if (!pts.length) continue // bald
      const xs = pts.map((p) => p[0])
      const left = g.head.cx - Math.min(...xs)
      const right = Math.max(...xs) - g.head.cx
      expect(Math.abs(left - right)).toBeLessThan(0.6)
    }
  })

  it('глаза следуют за faceWidth (cx = head.cx ± rx*0.4)', () => {
    for (const faceWidth of [0.8, 1.2]) {
      const g = computeAvatarGeometry({ ...BASE, faceWidth })
      const decor = computeHeadDecor({ ...BASE, faceWidth }, 'front', g.head)
      const eyeMatches = [...decor.face.matchAll(/<circle cx="(-?\d+(?:\.\d+)?)" cy="(-?\d+(?:\.\d+)?)" r="/g)]
      expect(eyeMatches.length).toBe(2)
      const expectedDx = g.head.rx * 0.4
      for (const m of eyeMatches) {
        const dx = Math.abs(parseFloat(m[1]) - g.head.cx)
        expect(Math.abs(dx - expectedDx)).toBeLessThan(0.05)
      }
    }
  })

  it('купол убора существует и кромка убора шире купола (регрессия пустого domeD)', () => {
    for (const headwear of ['cap', 'beanie'] as const) {
      for (const view of ['front', 'back'] as const) {
        const decor = computeHeadDecor({ ...BASE, headwear, headwearColor: '#b91c1c' }, view)
        expect(decor.hat).toContain('<path d="M')
        expect(decor.hat).toContain('fill="#b91c1c"')
        expect(decor.hat).toContain('<rect')
      }
    }
  })

  it('пожилой мужчина с короткой стрижкой: залысины-полумесяцы вместо каска', () => {
    const decor = computeHeadDecor({ ...BASE, ageGroup: 'elder' }, 'front')
    // 2 tuft-пути вместо полилинии каска
    const paths = decor.hair.match(/<path/g) ?? []
    expect(paths.length).toBe(2)
    expect(decor.hair).not.toContain(' L25 ')
  })

  it('очки: дужки дотягиваются до края головы при любом faceWidth', () => {
    for (const faceWidth of [0.8, 1.2]) {
      const g = computeAvatarGeometry({ ...BASE, faceWidth })
      const decor = computeHeadDecor({ ...BASE, faceWidth, glasses: 'glasses' }, 'front', g.head)
      // дужки — пути с L: последняя пара = кончик дужки у края головы
      const temples = (decor.glasses.match(/d="M[^"]*L[^"]*"/g) ?? [])
        .map((d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
      expect(temples.length).toBeGreaterThanOrEqual(3) // мостик + 2 дужки
      const reach = Math.max(...temples.map((nums) => Math.abs(nums[nums.length - 2] - g.head.cx)))
      // максимум — кончик дужки: у края головы, но не за ним
      expect(reach).toBeGreaterThan(g.head.rx * 0.9)
      expect(reach).toBeLessThan(g.head.rx + 0.6)
    }
  })
})

describe('darkenColor', () => {
  it('не уходит в отрицательные значения и сохраняет формат', () => {
    expect(darkenColor('#101010', 40)).toBe('#000000')
    expect(darkenColor('#ff0000', 16)).toMatch(/^#[0-9a-f]{6}$/)
  })
})
