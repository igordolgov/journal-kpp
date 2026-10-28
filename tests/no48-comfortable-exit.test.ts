// tests/no48-comfortable-exit.test.ts
// [№48-КОМФОРТНЫЙ-РАЗЪЕЗД] репорт: «выехавшая машина останавливается слишком
// высоко (не должна выходить за рамки дороги); если править точки останова,
// два грузовика не могут разъехаться сверху ворот; настрой по умолчанию
// комфортный разъезд».
//
// Решение:
//  1) глубина посадки выезда — АДАПТИВНАЯ (gateFlow.exitPullPastFor): по носу
//     самого высокого встречного, реально стоящего/претендующего на линию
//     (enterLaneOpponentHeight). Против легковой F − 56 (было всегда F − 71),
//     против грузовика F − 71 — разъезд двух грузовиков «сверху ворот»
//     работает как в №46;
//  2) ранний уезд [№34] разрешён от той же адаптивной полосы;
//  3) пользовательские точки cross/after ВЫЕЗДА машины валидируются на
//     коридор разъезда (заниженные молча заменяются геометрией — правками
//     точек больше нельзя сломать разъезд);
//  4) фоновая дорога (№49): полотно не ниже 160px, нижний край полосы
//     приподнят.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { enterLaneOpponentHeight, exitLaneBusy, exitPullPastFor } from '~/utils/gateFlow'
import { isValidPoint, CAR_EXIT_PULL_PAST, STOP_STANDOFF_ENTER } from '~/utils/simulatorTraffic'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

// ─── Геометрия сценария (как в exit-pullback.test.ts) ──────────────────────
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const TRUCK = { width: 120, height: 65 }
const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})
const F = 220                       // линия дороги (низ ворот)
const ROAD_Y = F - CAR.height / 2   // 200
const LINE_Y = ROAD_Y - STOP_STANDOFF_ENTER // 194 — линия ожидания въезжающих
const EXIT_CROSS_Y = ROAD_Y - CAR_EXIT_PULL_PAST // 129 — гарантийный коридор

const buildHarness = () => {
  const gate: any = makeCarGate()
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
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
  return { gate, aiAgents, physics }
}

const mkAgent = (
  id: string, direction: 'enter' | 'exit', state: string,
  size: { width: number; height: number }, cx: number, cy: number,
  target: { x: number; y: number },
) => ({
  id,
  element: {
    id, x: cx - size.width / 2, y: cy - size.height / 2, width: size.width, height: size.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: direction === 'enter' },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: direction === 'exit' ? SCENE.width + 100 : target.x, y: cy, width: 0, height: 0 },
  exitPoint: { x: cx, y: direction === 'exit' ? cy : target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'car-gate-1',
})

const centerOf = (a: any) => a.element.y + a.element.height / 2

describe('[№48] адаптивная глубина посадки exitPullPastFor', () => {
  it('глубина = нос встречного + стендофф въезда; 0 — встречных нет', () => {
    expect(exitPullPastFor(0)).toBe(0)
    expect(exitPullPastFor(CAR.height)).toBe(CAR.height + STOP_STANDOFF_ENTER)   // 46
    expect(exitPullPastFor(50)).toBe(56)
    expect(exitPullPastFor(TRUCK.height)).toBe(TRUCK.height + STOP_STANDOFF_ENTER) // 71
  })

  it('гарантийный коридор не изменился: CAR_EXIT_PULL_PAST = 71 (грузовик + 6)', () => {
    expect(CAR_EXIT_PULL_PAST).toBe(TRUCK.height + STOP_STANDOFF_ENTER)
    expect(CAR_EXIT_PULL_PAST).toBe(71)
  })
})

describe('[№48] enterLaneOpponentHeight — самый высокий претендент на линию', () => {
  it('встречная в коридоре оси — её высота; грузовик выше легковой', () => {
    const h = buildHarness()
    const gate = h.gate
    const me = mkAgent('me', 'exit', 'waiting_after', CAR, 580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y })
    const carOpp = mkAgent('opp-car', 'enter', 'to_gate', CAR, 580, LINE_Y, { x: 580, y: LINE_Y })
    expect(enterLaneOpponentHeight([me, carOpp] as any, me as any, gate)).toBe(CAR.height)

    const truckOpp = mkAgent('opp-truck', 'enter', 'to_gate', TRUCK, 590, LINE_Y + 12, { x: 580, y: LINE_Y })
    expect(enterLaneOpponentHeight([me, carOpp, truckOpp] as any, me as any, gate)).toBe(TRUCK.height)
    expect(exitLaneBusy([me, truckOpp] as any, me as any, gate)).toBe(true)
  })

  it('встречные вне коридора оси (±70) и свой поток — не претенденты (0)', () => {
    const h = buildHarness()
    const gate = h.gate
    const me = mkAgent('me', 'exit', 'waiting_after', CAR, 580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y })
    // цели дальних — вне осевого коридора (они едут мимо/к своей точке,
    // а не к линии у этих ворот)
    const farL = mkAgent('far-l', 'enter', 'to_gate', TRUCK, 200, LINE_Y, { x: 200, y: LINE_Y })
    const farR = mkAgent('far-r', 'enter', 'to_gate', TRUCK, 1000, LINE_Y, { x: 1000, y: LINE_Y })
    const sameDir = mkAgent('mate', 'exit', 'waiting_after', TRUCK, 590, LINE_Y, { x: 590, y: LINE_Y })
    expect(enterLaneOpponentHeight([me, farL, farR, sameDir] as any, me as any, gate)).toBe(0)
    expect(exitLaneBusy([me, farL, farR] as any, me as any, gate)).toBe(false)
  })

  it('цель на линии (подъезжающая) — тоже претендент', () => {
    const h = buildHarness()
    const gate = h.gate
    const me = mkAgent('me', 'exit', 'waiting_after', CAR, 580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y })
    // корпус вне коридора по Y, но ЦЕЛЬ на линии
    const approaching = mkAgent('appr', 'enter', 'to_gate', TRUCK, 640, 100, { x: 580, y: LINE_Y })
    expect(enterLaneOpponentHeight([me, approaching] as any, me as any, gate)).toBe(TRUCK.height)
  })
})

describe('[№48] валидация точек выезда: коридор разъезда неотключаем', () => {
  const gate = { x: 420, y: 100, width: 320, height: 120 }
  const scene = { width: 1280, height: 720 }
  const ctxOf = (size: { width: number; height: number }) => ({
    vertical: true, gate, size, scene,
  })

  it('точка cross на гарантийном коридоре (низ F−71) — валидна', () => {
    const p = { x: 580, y: EXIT_CROSS_Y }
    expect(isValidPoint('cross', 'exit', p, ctxOf(CAR))).toBe(true)
  })

  it('заниженная точка cross (низ выше F−71... ближе к дороге) — невалидна, берётся геометрия', () => {
    // низ корпуса на F − 40: разъезд грузовиков сломан такой точкой
    const p = { x: 580, y: F - 40 - CAR.height / 2 }
    expect(isValidPoint('cross', 'exit', p, ctxOf(CAR))).toBe(false)
  })

  it('заниженный after тоже невалиден — уезд не рвёт инвариант на всём ходу', () => {
    const p = { x: 1340, y: F - 30 - CAR.height / 2 }
    expect(isValidPoint('after', 'exit', p, ctxOf(CAR))).toBe(false)
    const ok = { x: 1340, y: EXIT_CROSS_Y }
    expect(isValidPoint('after', 'exit', ok, ctxOf(CAR))).toBe(true)
  })

  it('людей коридор не касается: cross человека на линии дороги F валиден', () => {
    const PERSON = { width: 40, height: 55 }
    const p = { x: 580, y: F - PERSON.height / 2 + 2 }
    expect(isValidPoint('cross', 'exit', p, ctxOf(PERSON))).toBe(true)
  })
})

describe('[№48] корректор: посадка по носу встречного (интеграция)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('против легковой спуск с коридора на F − 46 и уезд по АДАПТИВНОЙ полосе (было F − 71)', () => {
    const h = buildHarness()
    // встречная (легковая) претендует на линию; по бокам тоже встречные —
    // ранний уезд [№34] недоступен, работает спуск/корректор
    const opp = mkAgent('opp', 'enter', 'to_gate', CAR, 580, LINE_Y, { x: 580, y: LINE_Y })
    const farL = mkAgent('far-l', 'enter', 'to_gate', CAR, 200, LINE_Y, { x: 580, y: LINE_Y })
    const farR = mkAgent('far-r', 'enter', 'to_gate', CAR, 1000, LINE_Y, { x: 580, y: LINE_Y })
    const exit = mkAgent('exit', 'exit', 'waiting_after', CAR, 580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y })
    h.aiAgents.value = [opp, farL, farR, exit as any]

    // встречная у оси быстро становится очередью (waiting_before) — выезжающая
    // спускается с F − 71 на адаптивную посадку F − 46 и уезжает по ней
    const adaptedLaneY = F - CAR.height / 2 - exitPullPastFor(CAR.height) // 154
    for (let i = 0; i < 60; i++) {
      h.physics.updateAiMovement(0.1, { carGateId: 'car-gate-1', personGateId: '' })
      if (exit.state === 'moving_away') break
    }
    expect(['moving_away', 'done']).toContain(exit.state)
    // уезд — по фактической (адаптивной) полосе, а не по коридору F − 71
    expect(exit.afterTarget.y).toBeCloseTo(adaptedLaneY, 0)
  })

  it('против грузовика полоса уезда прежняя F − 71 — разъезд двух грузовиков не сломан', () => {
    const h = buildHarness()
    const opp = mkAgent('opp', 'enter', 'to_gate', TRUCK, 580, LINE_Y, { x: 580, y: LINE_Y })
    const farL = mkAgent('far-l', 'enter', 'to_gate', CAR, 200, LINE_Y, { x: 580, y: LINE_Y })
    const farR = mkAgent('far-r', 'enter', 'to_gate', CAR, 1000, LINE_Y, { x: 580, y: LINE_Y })
    const exit = mkAgent('exit', 'exit', 'waiting_after', CAR, 580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y })
    h.aiAgents.value = [opp, farL, farR, exit as any]

    for (let i = 0; i < 60; i++) {
      h.physics.updateAiMovement(0.1, { carGateId: 'car-gate-1', personGateId: '' })
      if (exit.state === 'moving_away') break
    }
    expect(['moving_away', 'done']).toContain(exit.state)
    // против грузовика адаптивная посадка = гарантийный коридор F − 71
    expect(exit.afterTarget.y).toBeCloseTo(EXIT_CROSS_Y, 0)
  })

  it('ранний уезд [№34] разрешён уже с адаптивной полосы (против легковой)', () => {
    const h = buildHarness()
    const opp = mkAgent('opp', 'enter', 'to_gate', CAR, 1000, LINE_Y, { x: 580, y: LINE_Y })
    const exit = mkAgent('exit', 'exit', 'waiting_after', CAR, 580, F - exitPullPastFor(CAR.height) - CAR.height / 2, { x: 580, y: EXIT_CROSS_Y })
    h.aiAgents.value = [opp, exit as any]

    for (let i = 0; i < 10; i++) h.physics.updateAiMovement(0.1, { carGateId: 'car-gate-1', personGateId: '' })
    // корпус на F − 46 (выше носа легковой) — уезд без ожидания закрытия
    expect(exit.state).toBe('moving_away')
    expect(h.gate.settings.isOpen).toBe(true)
  })
})

// [№48] фоновая дорога (№49) — отдельный файл no49-traffic-road-band.test.ts

