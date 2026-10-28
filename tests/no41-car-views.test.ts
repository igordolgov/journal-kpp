// tests/no41-car-views.test.ts
// [№41-РАКУРСЫ] имитация 3D: машина меняет вид по курсу — горизонтальный
// курс = боковой профиль (с зеркалом), вертикальный вверх (на зрителя) =
// вид спереди, вертикальный вниз (от зрителя) = вид сзади. Смена мгновенная,
// без поворота (№31-БЕЗ-ПОВОРОТА): paint-мост переключает display контейнеров.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import {
  getCarSvg, getCarSvgFront, getCarSvgRear,
  getTruckSvg, getTruckSvgFront, getTruckSvgRear,
} from '~/utils/simulatorSvg'
import { agentTransform, paintAgent } from '~/utils/simulatorPaint'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }

const buildPhysics = () => {
  const simElements = ref<any[]>([])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    () => true, () => true, () => {}, simOpts, undefined, undefined,
  )
  return { aiAgents, physics }
}

const mkCar = (id: string, cx: number, cy: number, speed: number, direction = 'enter') => ({
  id,
  element: {
    id, x: cx - 40, y: cy - 20, width: 80, height: 40,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: true, _view: 'side' },
  },
  state: 'to_gate',
  target: { x: cx, y: cy, width: 0, height: 0 },
  afterTarget: { x: cx, y: cy + 200, width: 0, height: 0 },
  exitPoint: { x: cx, y: cy, width: 0, height: 0 },
  speed, type: 'car', direction, travelMode: 'car',
  gateId: '',
})

const tickN = (h: ReturnType<typeof buildPhysics>, n: number) => {
  for (let i = 0; i < n; i++) h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
}

// Фейковый DOM-узел: достаточно для writeOnce (style[key] = value)
const fakeNode = () => ({ style: {} as Record<string, string> }) as unknown as HTMLElement

describe('[№41-РАКУРСЫ] SVG-варианты машин', () => {
  it('у легковой есть спереди/сзади: тот же формат, свой цвет, отличаются от профиля', () => {
    const side = getCarSvg('#ef4444')
    const front = getCarSvgFront('#ef4444')
    const rear = getCarSvgRear('#ef4444')
    for (const svg of [side, front, rear]) {
      expect(svg).toContain('<svg')
      expect(svg).toContain('#ef4444')
    }
    expect(front).not.toBe(side)
    expect(rear).not.toBe(side)
    expect(front).not.toBe(rear)
    // спереди — жёлтые фары, сзади — красные стоп-сигналы
    expect(front).toContain('#fbbf24')
    expect(rear).toContain('#ef4444')
  })

  it('у грузовика есть спереди/сзади, viewBox совпадает с боковым (120x65)', () => {
    const side = getTruckSvg('#0ea5e9')
    const front = getTruckSvgFront('#0ea5e9')
    const rear = getTruckSvgRear('#0ea5e9')
    for (const svg of [side, front, rear]) {
      expect(svg).toContain('viewBox="0 0 120 65"')
      expect(svg).toContain('#0ea5e9')
    }
    expect(front).not.toBe(side)
    expect(rear).not.toBe(side)
  })
})

describe('[№41-РАКУРСЫ] физика: смена вида по курсу', () => {
  afterEach(() => vi.restoreAllMocks())

  it('въезд: горизонтальный курс — side, после поворота вниз — rear', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    // машина уже у точки поворота (ворота): подъезд почти завершён
    const car = mkCar('car-e', 560, 300, 80) as any
    car.target = { x: 620, y: 300, width: 0, height: 0 }
    h.aiAgents.value = [car]
    tickN(h, 3)
    expect((car.element.settings as any)._view).toBe('side')
    // поворот: цель строго вниз (проезд через ворота за территорию) —
    // как в жизни: у самых ворот вертикаль начинает доминировать
    car.target = { x: 620, y: 520, width: 0, height: 0 }
    tickN(h, 2)
    expect((car.element.settings as any)._view).toBe('rear')
    // профильный курс не потерян: снова горизонталь — снова side
    car.target = { x: 900, y: 520, width: 0, height: 0 }
    tickN(h, 2)
    expect((car.element.settings as any)._view).toBe('side')
  })

  it('выезд: вертикальный курс вверх — front, после поворота вбок — side', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const car = mkCar('car-x', 620, 560, 80, 'exit') as any
    car.target = { x: 620, y: 340, width: 0, height: 0 }
    h.aiAgents.value = [car]
    tickN(h, 3)
    expect((car.element.settings as any)._view).toBe('front')
    car.target = { x: 940, y: 340, width: 0, height: 0 }
    tickN(h, 2)
    expect((car.element.settings as any)._view).toBe('side')
  })

  it('зеркало по-прежнему ведётся только на горизонтали', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const car = mkCar('car-l', 340, 300, 80) as any
    car.target = { x: 300, y: 300, width: 0, height: 0 } // едет влево
    h.aiAgents.value = [car]
    tickN(h, 3)
    expect((car.element.settings as any)._facingLeft).toBe(true)
    car.target = { x: 300, y: 520, width: 0, height: 0 } // вниз (у ворот)
    tickN(h, 2)
    // вертикальный участок НЕ перезаписывает горизонтальную ориентацию
    expect((car.element.settings as any)._facingLeft).toBe(true)
    expect((car.element.settings as any)._view).toBe('rear')
  })
})

describe('[№41-РАКУРСЫ] paint-мост: зеркало и display контейнеров', () => {
  it('agentTransform: зеркало только у side, у front/rear — чистый translate3d', () => {
    const base = { x: 10, y: 20, category: 'car', direction: 'enter', settings: { _facingLeft: true } }
    expect(agentTransform({ ...base, settings: { _facingLeft: true, _view: 'side' } } as any)).toContain('scaleX(-1)')
    expect(agentTransform({ ...base, settings: { _facingLeft: true, _view: 'front' } } as any)).not.toContain('scaleX')
    expect(agentTransform({ ...base, settings: { _facingLeft: true, _view: 'rear' } } as any)).not.toContain('scaleX')
    // старые ассеты без флага — прежнее поведение (side + зеркало)
    expect(agentTransform(base as any)).toContain('scaleX(-1)')
  })

  it('paintAgent включает контейнер активного ракурса, остальные прячет', () => {
    const node = fakeNode()
    const side = fakeNode()
    const front = fakeNode()
    const rear = fakeNode()
    const el = { x: 0, y: 0, zIndex: 1, category: 'car', settings: { _view: 'front' } }
    paintAgent({ node, avatar: null, carViews: { side, front, rear } }, el as any, 1)
    expect(side.style['display']).toBe('none')
    expect(front.style['display']).toBe('block')
    expect(rear.style['display']).toBe('none')

    // смена курса: rear включается мгновенно (новая запись display)
    el.settings._view = 'rear'
    paintAgent({ node, avatar: null, carViews: { side, front, rear } }, el as any, 1)
    expect(front.style['display']).toBe('none')
    expect(rear.style['display']).toBe('block')

    // возврат к профилю
    el.settings._view = 'side'
    paintAgent({ node, avatar: null, carViews: { side, front, rear } }, el as any, 1)
    expect(side.style['display']).toBe('block')
    expect(rear.style['display']).toBe('none')
  })

  it('у людей carViews нет — paintAgent не трогает display', () => {
    const node = fakeNode()
    const el = { x: 0, y: 0, zIndex: 2, category: 'human', velocity: 5 }
    expect(() => paintAgent({ node, avatar: null }, el as any, 1)).not.toThrow()
    expect(node.style['transform']).toContain('translate3d')
  })
})
