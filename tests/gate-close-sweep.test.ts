// tests/gate-close-sweep.test.ts
// [№13-БЕЗОПАСНОСТЬ] основное правило КПП: ворота никогда не остаются
// открытыми (частично или полностью), если около них нет машин.
//  • Отсчёт закрытия [G2] стартует, когда ни один корпус не ПЕРЕКРЫВАЕТ
//    линию шлагбаума: ждущие на стоп-линиях (бампер в 6/10 px до линии)
//    и посадка за линией перекрытия не создают — шлагбаум опускается за
//    спиной уехавшей с посадки машины и ПЕРЕД очередью, как в жизни.
//  • Очередь [G3] (все waiting_before у своих ворот) держит ворота
//    открытыми — открытие оправдано присутствием ждущих.
//  • Машина на посадке (waiting_after) уезжает только после ПОЛНОГО
//    закрытия ворот; пока у линии легальная очередь, уезд разрешён и на
//    открытых воротах — «последняя машина цикла» дождётся закрытия сама.
//  • Калитка живёт по тем же правилам со своим occupied/очередью и
//    wicketCloseDelay: пустая открытая калитка закрывается свипом.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_STOP_OFFSET } from '~/utils/simulatorConstants'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }

// автомобильные ворота (420,100,320,120): ось X=580, линия дороги F=220
const makeCarGate = (isOpen: boolean) => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const makeWicket = (isOpen: boolean) => ({
  id: 'wicket-1', x: 850, y: 100, width: 50, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const ROAD_Y = 220 - CAR.height / 2            // 200
const ENTER_STOP_Y = ROAD_Y - 6                // 194
const ENTER_CROSS_Y = ROAD_Y + CAR_STOP_OFFSET // 258
const EXIT_STOP_Y = ROAD_Y + CAR.height + 10   // 250

const buildHarness = (gateOverrides: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) => {
  const gate: any = { ...makeCarGate(true), settings: { ...makeCarGate(true).settings, ...gateOverrides } }
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const warns: string[] = []
  vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    warns.push(args.map(String).join(' '))
  })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    ...opts,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined,
  )
  return { gate, simElements, aiAgents, physics, warns }
}

const mkCar = (id: string, direction: 'enter' | 'exit', state: string, cx: number, cy: number, target: { x: number; y: number }, after: { x: number; y: number }) => ({
  id,
  element: {
    id, x: cx - CAR.width / 2, y: cy - CAR.height / 2, width: CAR.width, height: CAR.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: direction === 'enter' },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'car-gate-1',
})

const tick = (h: ReturnType<typeof buildHarness>, n: number, cfg = { carGateId: 'car-gate-1', personGateId: 'wicket-1' }) => {
  for (let i = 0; i < n; i++) h.physics.updateAiMovement(DT, cfg)
}

describe('закрытие по линии шлагбаума и ожидание закрытия ([№13])', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('посадка не перекрывает линию — ворота закрываются за спиной машины (delay=0), машина уезжает после закрытия', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const car = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    // 0.5с: вежливая пауза не истекла, но корпус за линией — свип закрыл
    // ворота (delay=0), машина осталась ждать на посадке
    tick(h, 5)
    expect(car.state).toBe('waiting_after')
    expect(h.gate.settings.isOpen).toBe(false)

    // после паузы машина видит ПОЛНОЕ закрытие и уезжает
    tick(h, 10)
    expect(['moving_away', 'done']).toContain(car.state)
  })

  it('очередь ждущих у линии держит ворота открытыми ([G3])', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const first = mkCar('car-1', 'enter', 'waiting_before',
      580, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    const second = mkCar('car-2', 'enter', 'waiting_before',
      720, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [first as any, second as any]

    // обе ждут у линии — ворота открыты (открытие оправдано очередью)
    tick(h, 30)
    expect(h.aiAgents.value.some(a => a.id === 'car-1')).toBe(true)
    expect(h.aiAgents.value.some(a => a.id === 'car-2')).toBe(true)
    expect(h.gate.settings.isOpen).toBe(true)
  })

  it('машина на посадке уезжает на открытых воротах, пока у линии легальная очередь ([№13])', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const leaving = mkCar('car-1', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    const waiting = mkCar('car-2', 'enter', 'waiting_before',
      720, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [leaving as any, waiting as any]

    // первая уезжает (очередь оправдывает открытые ворота), вторая ждёт у линии
    tick(h, 30)
    expect(['moving_away', 'done']).toContain(leaving.state)
    expect(h.aiAgents.value.some(a => a.id === 'car-2')).toBe(true)
    expect(h.gate.settings.isOpen).toBe(true)
  })

  it('отложенное закрытие: отсчёт 10с, машина на посадке ждёт и уезжает после срабатывания', () => {
    vi.useFakeTimers()
    const h = buildHarness({}, { gateCloseDelay: 10 })
    const car = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    // машина стоит на посадке и ждёт закрытия ([№13])
    tick(h, 30)
    expect(car.state).toBe('waiting_after')
    expect(h.gate.settings.isOpen).toBe(true)

    // 9с — меньше gateCloseDelay: ворота ещё открыты, машина ждёт
    vi.advanceTimersByTime(9000)
    tick(h, 1)
    expect(h.gate.settings.isOpen).toBe(true)
    expect(car.state).toBe('waiting_after')

    // 10с — отсчёт сработал: ворота закрылись, машина уезжает
    vi.advanceTimersByTime(1200)
    tick(h, 1)
    expect(h.gate.settings.isOpen).toBe(false)
    tick(h, 15)
    expect(['moving_away', 'done']).toContain(car.state)
  })

  it('корпус, перекрывающий линию шлагбаума (crossing), держит ворота открытыми', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    // машина в crossing ровно на линии: корпус 200..240 против F=220
    const car = mkCar('car-e', 'enter', 'crossing',
      580, 220, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    tick(h, 10)
    expect(h.gate.settings.isOpen).toBe(true)
  })

  it('выезжающая на полосе (waiting_after) ждёт закрытия и уезжает вбок после него', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const exitCar = mkCar('car-x', 'exit', 'waiting_after',
      580, ROAD_Y - CAR_EXIT_PULL_PAST, { x: 580, y: ROAD_Y - CAR_EXIT_PULL_PAST }, { x: 1300, y: ROAD_Y - CAR_EXIT_PULL_PAST })
    h.aiAgents.value = [exitCar as any]

    // корпус за линией — свип закрыл (delay=0), выезжающая ждёт на полосе
    tick(h, 5)
    expect(exitCar.state).toBe('waiting_after')
    expect(h.gate.settings.isOpen).toBe(false)

    // после паузы — уезд вбок по своей полосе
    tick(h, 10)
    expect(['moving_away', 'done']).toContain(exitCar.state)
  })

  it('ЧАСТИЧНО открытые ворота (isOpen+isAnimating) удерживают машину на посадке ([№13])', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const car = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    // шлагбаум ещё опускается (частично открыт), пауза подходит к концу:
    // «открыты частично» = закрытия нет — машина продолжает ждать
    tick(h, 5)
    h.gate.settings.isOpen = true
    h.gate.settings.isAnimating = true
    tick(h, 20)
    expect(car.state).toBe('waiting_after')

    // анимация завершилась — ворота полностью закрыты, машина уезжает
    h.gate.settings.isOpen = false
    h.gate.settings.isAnimating = false
    tick(h, 10)
    expect(['moving_away', 'done']).toContain(car.state)
  })

  it('калитка: пустая открытая закрывается свипом после wicketCloseDelay, человек в зоне держит её открытой', () => {
    vi.useFakeTimers()
    const wicket: any = makeWicket(true)
    const simElements = ref<any[]>([wicket])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ ...SCENE })
    const simOpts: any = {
      ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
      MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
      gateCloseDelay: 0, wicketCloseDelay: 2, stallEscalateTime: 10,
    }
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { g.settings.isOpen = true; return true },
      (g: any) => { g.settings.isOpen = false; return true },
      () => {}, simOpts, undefined, undefined,
    )
    const CFG = { carGateId: 'car-gate-1', personGateId: 'wicket-1' }
    // пустая открытая калитка: отсчёт 2с — закрытие
    for (let i = 0; i < 3; i++) physics.updateAiMovement(DT, CFG)
    vi.advanceTimersByTime(2500)
    for (let i = 0; i < 2; i++) physics.updateAiMovement(DT, CFG)
    expect(wicket.settings.isOpen).toBe(false)

    // человек в зоне калитки (waiting_before) держит её открытой
    wicket.settings.isOpen = true
    const person = {
      id: 'p1',
      element: { id: 'p1', x: 860, y: 210, width: 40, height: 55, rotation: Math.PI / 2, velocity: 0, category: 'human', type: 'actor', direction: 'enter' },
      state: 'waiting_before',
      target: { x: 875, y: 180, width: 0, height: 0 },
      afterTarget: { x: 875, y: 340, width: 0, height: 0 },
      exitPoint: { x: 875, y: 180, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
      gateId: 'wicket-1',
    }
    aiAgents.value = [person as any]
    for (let i = 0; i < 3; i++) physics.updateAiMovement(DT, CFG)
    vi.advanceTimersByTime(5000)
    for (let i = 0; i < 2; i++) physics.updateAiMovement(DT, CFG)
    expect(wicket.settings.isOpen).toBe(true)
  })
})
