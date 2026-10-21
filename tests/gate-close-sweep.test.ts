// tests/gate-close-sweep.test.ts
// [П6] шлагбаум закрывается ПО ФАКТУ расчистки створа, а не от момента
// посадки: отсчёт [G2] стартует, когда корпус машины полностью покинул зону
// створа (80 px от линии дороги F); вошедший в створ корпус снимает
// отложенное закрытие; очередь [G3] держит ворота открытыми. Калитка
// живёт по своим правилам и свипом не закрывается.

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

describe('свип закрытия по расчистке створа ([П6])', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('посадка в створе держит ворота открытыми; после уезда корпус очищает створ — ворота закрываются (delay=0)', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const car = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    // 0.5с: вежливая пауза не истекла, машина в створе — ворота открыты
    tick(h, 5)
    expect(car.state).toBe('waiting_after')
    expect(h.gate.settings.isOpen).toBe(true)

    // 1.5с: машина уехала с посадки, но ещё В створе (центр не прошёл F+80)
    tick(h, 10)
    expect(['moving_away', 'done']).toContain(car.state)
    expect(h.gate.settings.isOpen).toBe(true)

    // 3с: корпус покинул зону створа — при delay=0 свип закрывает ворота
    tick(h, 15)
    expect(h.gate.settings.isOpen).toBe(false)
  })

  it('очередь на остановке держит ворота открытыми ([G3])', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const leaving = mkCar('car-1', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    const waiting = mkCar('car-2', 'enter', 'waiting_before',
      580, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [leaving as any, waiting as any]

    // первая уезжает, вторая стоит на остановке В створе — ворота открыты
    tick(h, 30)
    expect(['moving_away', 'done']).toContain(leaving.state)
    expect(h.aiAgents.value.some(a => a.id === 'car-2')).toBe(true)
    expect(h.gate.settings.isOpen).toBe(true)
  })

  it('отложенное закрытие: отсчёт 10с после расчистки, вошедший корпус снимает отсчёт', () => {
    vi.useFakeTimers()
    const h = buildHarness({}, { gateCloseDelay: 10 })
    const car = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS_Y, { x: 580, y: ENTER_CROSS_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [car as any]

    // машина уезжает и покидает створ — свип ставит отсчёт 10с
    tick(h, 30)
    expect(h.gate.settings.isOpen).toBe(true)
    const cleared = !h.aiAgents.value.some(o =>
      o.type === 'car' && o.state !== 'done' &&
      Math.abs((o.element.y + CAR.height / 2) - 220) <= 80 &&
      Math.abs((o.element.x + CAR.width / 2) - 580) <= 100)
    expect(cleared).toBe(true)

    // 9с — меньше gateCloseDelay: ворота ещё открыты
    vi.advanceTimersByTime(9000)
    expect(h.gate.settings.isOpen).toBe(true)

    // в створ входит другая машина — отсчёт снимается
    const newcomer = mkCar('car-2', 'enter', 'waiting_before',
      580, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    h.aiAgents.value = [newcomer as any]
    tick(h, 1)
    vi.advanceTimersByTime(12000)
    expect(h.gate.settings.isOpen).toBe(true)

    // створ снова пуст — новый отсчёт срабатывает через 10с
    h.aiAgents.value = []
    tick(h, 1)
    vi.advanceTimersByTime(9900)
    expect(h.gate.settings.isOpen).toBe(true)
    vi.advanceTimersByTime(300)
    expect(h.gate.settings.isOpen).toBe(false)
  })

  it('калитка свипом не закрывается — у неё свои правила [G2]', () => {
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
    for (let i = 0; i < 50; i++) {
      physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    }
    // delay=0 у автомобильных ворот не трогает калитку: пустой створ калитки
    // без людей закрывается только её собственным таймером после прохода
    expect(wicket.settings.isOpen).toBe(true)
  })

  it('машина на полосе выезда (waiting_after) тоже держит створ', () => {
    const h = buildHarness({}, { gateCloseDelay: 0 })
    const exitCar = mkCar('car-x', 'exit', 'waiting_after',
      580, ROAD_Y - CAR_EXIT_PULL_PAST, { x: 580, y: ROAD_Y - CAR_EXIT_PULL_PAST }, { x: 1300, y: ROAD_Y - CAR_EXIT_PULL_PAST })
    h.aiAgents.value = [exitCar as any]

    // выезжающая на полосе ожидания (центр F-46) — в створе, ворота открыты
    tick(h, 5)
    expect(h.gate.settings.isOpen).toBe(true)
  })
})
