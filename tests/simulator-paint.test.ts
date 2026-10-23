// tests/simulator-paint.test.ts
// [№14-ПЛАВНОСТЬ-DEV] Пиним контракт императивного paint-моста:
// семантика стилей идентична прежним реактивным биндингам шаблона.
import { describe, it, expect } from 'vitest'
import {
  agentTransform, labelTransform, gateTransform, isAgentPaused,
  paintAgent, paintLabel, paintGate, paintCommandLine,
  paintCoord, snapshotPrevPositions, quantizeWalkHold,
} from '~/utils/simulatorPaint'

const fakeNode = () => {
  const attrs: Record<string, string> = {}
  return {
    attrs,
    style: {
      _props: {} as Record<string, string>,
      setProperty(n: string, v: string) { this._props[n] = v },
    } as any,
    setAttribute(n: string, v: string) { attrs[n] = v },
  }
}

const fakeAvatar = () => ({
  classes: new Set<string>(),
  classList: {
    toggle(name: string, on: boolean) {
      if (on) this._s.add(name)
      else this._s.delete(name)
    },
    _s: null as unknown as Set<string>,
  },
  style: {
    _props: {} as Record<string, string>,
    setProperty(n: string, v: string) { this._props[n] = v },
  } as any,
})
// связываем _s с Set
const mkAvatar = () => {
  const a: any = fakeAvatar()
  a.classList._s = a.classes
  return a
}

describe('isAgentPaused (семантика прежнего :class-биндинга)', () => {
  it('явный isPaused имеет приоритет над скоростью', () => {
    expect(isAgentPaused({ isPaused: false, velocity: 0 })).toBe(false)
    expect(isAgentPaused({ isPaused: true, velocity: 5 })).toBe(true)
  })
  it('без флага — пауза при velocity < 0.1', () => {
    expect(isAgentPaused({ velocity: 0.05 })).toBe(true)
    expect(isAgentPaused({ velocity: 0 })).toBe(true)
    expect(isAgentPaused({ velocity: 2 })).toBe(false)
  })
})

describe('agentTransform (семантика getElementStyle)', () => {
  it('машина: _facingLeft=true -> зеркало scaleX(-1)', () => {
    const el = { x: 10.5, y: 20, category: 'car', settings: { _facingLeft: true } }
    expect(agentTransform(el, false)).toBe('translate3d(10.5px, 20px, 0) scaleX(-1)')
  })
  it('машина: без _facingLeft зеркалим по направлению enter', () => {
    const el = { x: 0, y: 0, category: 'car', direction: 'enter', settings: {} }
    expect(agentTransform(el, false)).toContain('scaleX(-1)')
    const el2 = { x: 0, y: 0, category: 'car', direction: 'exit', settings: {} }
    expect(agentTransform(el2, false)).toContain('scaleX(1)')
  })
  it('человек: rotate только при enableRotation', () => {
    const el = { x: 1, y: 2, category: 'human', rotation: Math.PI, settings: {} }
    expect(agentTransform(el, true)).toBe('translate3d(1px, 2px, 0) rotate(180deg)')
    expect(agentTransform(el, false)).toBe('translate3d(1px, 2px, 0)')
  })
})

describe('labelTransform', () => {
  it('центр по x, верх на 50px выше агента, центрирование плашки -50%', () => {
    const el = { x: 10, y: 100, width: 40, height: 80 }
    expect(labelTransform(el)).toBe('translate3d(30px, 50px, 0) translateX(-50%)')
  })
})

describe('gateTransform', () => {
  it('дефолты без settings', () => {
    expect(gateTransform(undefined)).toBe('translateX(0px) scaleX(1)')
    expect(gateTransform({})).toBe('translateX(0px) scaleX(1)')
  })
  it('фактическое положение стрелы', () => {
    expect(gateTransform({ _animX: -320, _animScaleX: 0.5 })).toBe('translateX(-320px) scaleX(0.5)')
  })
})

describe('paintAgent', () => {
  it('пишет transform+zIndex в корень, паузу и --walk-hold в аватар', () => {
    const node: any = fakeNode()
    const avatar = mkAvatar()
    const el = {
      x: 5, y: 6, category: 'human', zIndex: 180, velocity: 0,
      settings: { _walkHold: 1.25 },
    }
    paintAgent({ node, avatar }, el as any, false)
    expect(node.style.transform).toBe('translate3d(5px, 6px, 0)')
    expect(node.style.zIndex).toBe('180')
    expect(avatar.classes.has('is-paused')).toBe(true)
    expect(avatar.style._props['--walk-hold']).toBe('1.25')

    el.velocity = 3
    paintAgent({ node, avatar }, el as any, false)
    expect(avatar.classes.has('is-paused')).toBe(false)
  })
  it('без аватара (машина) — не падает, is-paused не трогается', () => {
    const node: any = fakeNode()
    const el = { x: 1, y: 2, category: 'car', zIndex: 0, settings: { _facingLeft: false } }
    paintAgent({ node, avatar: null }, el as any, false)
    expect(node.style.transform).toBe('translate3d(1px, 2px, 0) scaleX(1)')
    expect(node.style.zIndex).toBe('1')
  })
})

describe('paintLabel / paintGate / paintCommandLine', () => {
  it('лейбл получает translate3d-позицию', () => {
    const n: any = fakeNode()
    paintLabel(n, { x: 4, y: 40, width: 20 } as any)
    expect(n.style.transform).toBe('translate3d(14px, -10px, 0) translateX(-50%)')
  })
  it('стрела ворот — фактический transform', () => {
    const n: any = fakeNode()
    paintGate(n, { _animX: -100 } as any)
    expect(n.style.transform).toBe('translateX(-100px) scaleX(1)')
    paintGate(null, { _animX: -100 } as any) // не падает
  })
  it('линия команды — 4 координаты; без актора — тихий выход', () => {
    const line: any = fakeNode()
    paintCommandLine(line, { x: 0, y: 0, width: 40, height: 80 } as any, { x: 100, y: 200, width: 20, height: 10 } as any)
    expect(line.attrs).toEqual({ x1: '20', y1: '40', x2: '110', y2: '205' })
    expect(() => paintCommandLine(line, null, null)).not.toThrow()
  })
})

// ------------------------------------------------------------------
// [№15-ФИКС-ШАГ] Интерполяция рендера: физика идёт подшагами 1/60с,
// paint берёт prev + (cur - prev) * alpha — движение равномерно при
// неровном кадре. prev-позиции снимает snapshotPrevPositions.
// ------------------------------------------------------------------
describe('№15: интерполяция рендера (fixed timestep)', () => {
  it('paintCoord: alpha>=1 или нет prev — текущая позиция', () => {
    const el: any = { x: 10, y: 20 }
    expect(paintCoord(el, 'x', 1)).toBe(10)
    expect(paintCoord(el, 'y', 0.5)).toBe(20) // _py нет — fallback на cur
    expect(paintCoord(el, 'x', 1.5)).toBe(10)
  })

  it('paintCoord: alpha=0.5 — половина пути от prev к текущей', () => {
    const el: any = { x: 10, y: 100, _px: 0, _py: 0 }
    expect(paintCoord(el, 'x', 0.5)).toBe(5)
    expect(paintCoord(el, 'y', 0.25)).toBe(25)
    // alpha=0 (аккумулятор исчерпан подшагами до нуля) — рендер текущей позиции
    expect(paintCoord(el, 'x', 0)).toBe(10)
  })

  it('paintCoord: невалидный prev (NaN/строка) игнорируется', () => {
    const el: any = { x: 10, _px: NaN }
    expect(paintCoord(el, 'x', 0.5)).toBe(10)
    const el2: any = { x: 10, _px: 'гы' }
    expect(paintCoord(el2, 'x', 0.5)).toBe(10)
  })

  it('snapshotPrevPositions снимает _px/_py у всех с числовыми координатами', () => {
    const a: any = { x: 1, y: 2 }
    const b: any = { x: 3, y: 4 }
    const c: any = { name: 'ворота' } // без x — пропускается
    snapshotPrevPositions([a, b, c])
    expect(a._px).toBe(1); expect(a._py).toBe(2)
    expect(b._px).toBe(3); expect(b._py).toBe(4)
    expect(c._px).toBeUndefined()
  })

  it('agentTransform с alpha интерполирует translate3d, зеркало не ломается', () => {
    const car: any = { x: 10, y: 20, _px: 0, _py: 0, category: 'car', direction: 'enter' }
    expect(agentTransform(car, false, 0.5)).toBe('translate3d(5px, 10px, 0) scaleX(-1)')
    const person: any = { x: 10, y: 20, _px: 0, _py: 0 }
    expect(agentTransform(person, false, 0.5)).toBe('translate3d(5px, 10px, 0)')
  })

  it('labelTransform с alpha следует за агентом', () => {
    const el: any = { x: 10, y: 50, _px: 0, _py: 0, width: 40, height: 20 }
    expect(labelTransform(el, 0.5)).toBe('translate3d(25px, -25px, 0) translateX(-50%)')
  })
})

// ------------------------------------------------------------------
// [№16-МЕНЬШЕ-ЗАПИСЕЙ] кэш записей: неизменные значения не пишутся в DOM.
// Профиль (№16): узкое место — размазанная по кадру стоимость style-recalc
// и CSS-парсинга от покадровых записей; большинство агентов стоит.
// ------------------------------------------------------------------
describe('№16: кэш записей (write-once)', () => {
  it('повтор с тем же состоянием не меняет transform; изменение — пишет', () => {
    const node: any = fakeNode()
    const el: any = { x: 5, y: 6, category: 'human', zIndex: 10, velocity: 0 }
    paintAgent({ node, avatar: null }, el, false)
    const t1 = node.style.transform
    paintAgent({ node, avatar: null }, el, false)
    expect(node.style.transform).toBe(t1)
    el.x = 7
    paintAgent({ node, avatar: null }, el, false)
    expect(node.style.transform).toBe('translate3d(7px, 6px, 0)')
  })

  it('is-paused: повтор без изменения состояния не трогает классы', () => {
    const node: any = fakeNode()
    const avatar = mkAvatar()
    const el: any = { x: 0, y: 0, velocity: 0 } // стоит -> пауза
    paintAgent({ node, avatar }, el, false)
    expect(avatar.classes.has('is-paused')).toBe(true)
    paintAgent({ node, avatar }, el, false)
    expect(avatar.classes.has('is-paused')).toBe(true)
    el.velocity = 2
    paintAgent({ node, avatar }, el, false)
    expect(avatar.classes.has('is-paused')).toBe(false)
  })

  it('quantizeWalkHold: шаг кванта 1/20с, отсутствие — 0', () => {
    expect(quantizeWalkHold(0.123)).toBe(0.1)
    expect(quantizeWalkHold(0.127)).toBe(0.15)
    expect(quantizeWalkHold(undefined)).toBe(0)
    expect(quantizeWalkHold(null)).toBe(0)
  })

  it('--walk-hold пишется квантованным через setProperty', () => {
    const node: any = fakeNode()
    const avatar = mkAvatar()
    const el: any = { x: 0, y: 0, velocity: 1, settings: { _walkHold: 1.234 } }
    paintAgent({ node, avatar }, el, false)
    expect(avatar.style._props['--walk-hold']).toBe('1.25') // 1.234*20=24.68 -> 25 -> 1.25
  })

  it('кэши разных узлов независимы', () => {
    const a: any = fakeNode()
    const b: any = fakeNode()
    const el: any = { x: 1, y: 1, category: 'human', velocity: 0 }
    paintAgent({ node: a, avatar: null }, el, false)
    paintAgent({ node: b, avatar: null }, el, false)
    expect(a.style.transform).toBe(b.style.transform)
  })
})
