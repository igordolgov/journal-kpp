// tests/traffic-scheme.test.ts
// [СХЕМА-ТРАЕКТОРИЙ] регрессионные тесты единой геометрии траекторий:
//  1) вертикальный поток: вход сверху-вниз, выход снизу-вверх, точки по воротам;
//  2) валидация: настроенные оффсеты не с той стороны отбрасываются
//     (именно они давали «выходящие спавнятся сверху»);
//  3) горизонтальный поток для вертикального забора (совместимость);
//  4) машина покидает waiting_after за ~2с, а не через closeDelay+15с;
//  5) ретаргет физики приводит цель к той же остановке, что и спавн.
// Все точки схемы — ЦЕНТР агента (физика центрирует элемент на цели).

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  trafficPointsFor,
  deriveTrafficPoints,
  isVerticalFlow,
} from '~/utils/simulatorTraffic'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const PERSON = { width: PERSON_WIDTH, height: PERSON_HEIGHT }
const CAR = { width: 80, height: 40 }
const SCENE = { width: 1280, height: 720 }

const makeWicket = (overrides: Record<string, unknown> = {}) => ({
  id: 'wicket-1',
  x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Калитка',
  zIndex: 300,
  settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
  ...overrides,
})

const makeCarGate = (overrides: Record<string, unknown> = {}) => ({
  id: 'car-gate-1',
  x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Ворота',
  zIndex: 300,
  settings: { gateType: 'sliding', isOpen: false, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
  ...overrides,
})

describe('simulatorTraffic: ось потока', () => {
  it('калитка-дверь (выше, чем шире) — вертикальный поток', () => {
    expect(isVerticalFlow(makeWicket())).toBe(true)
  })
  it('ворота-слайдер (шире, чем выше) — горизонтальный забор, поток вертикальный', () => {
    expect(isVerticalFlow(makeCarGate())).toBe(true)
  })
  it('вертикальный забор (ворота выше, чем шире) — горизонтальный поток', () => {
    expect(isVerticalFlow(makeCarGate({ width: 120, height: 320 }))).toBe(false)
  })
})

describe('simulatorTraffic: вертикальная схема (центровые точки)', () => {
  const wicket = makeWicket()
  const PH = PERSON.height / 2

  it('вход: спавн за верхним краем, стоп над калиткой, проход под неё, уход вниз', () => {
    const pts = deriveTrafficPoints(wicket, PERSON, 'enter', SCENE)
    expect(pts.vertical).toBe(true)
    // спавн полностью за верхним краем (нижняя кромка <= 0)
    expect(pts.spawn.y + PH).toBeLessThanOrEqual(0)
    // стоп: визуальные ноги на 10px выше верхней линии (центр + h/2 - pad 2 = 90)
    expect(pts.stop.y + PH - 2).toBeCloseTo(90, 5)
    // проход: визуальные ноги на 26px ниже нижней линии (246)
    expect(pts.cross.y + PH - 2).toBeCloseTo(246, 5)
    // уход: верхняя кромка за нижним краем сцены
    expect(pts.after.y - PH).toBeGreaterThanOrEqual(SCENE.height)
    // все по центру калитки
    for (const p of [pts.spawn, pts.stop, pts.cross, pts.after]) {
      expect(p.x).toBeCloseTo(800, 5)
    }
  })

  it('выход: спавн за нижним краем, стоп под калиткой, проход над ней, уход вверх', () => {
    const pts = deriveTrafficPoints(wicket, PERSON, 'exit', SCENE)
    expect(pts.vertical).toBe(true)
    // спавн за нижним краем (верхняя кромка >= 720)
    expect(pts.spawn.y - PH).toBeGreaterThanOrEqual(SCENE.height)
    // стоп: визуальные ноги на 30px ниже нижней линии (250)
    expect(pts.stop.y + PH - 2).toBeCloseTo(250, 5)
    // проход: визуальные ноги на 26px выше верхней линии (74)
    expect(pts.cross.y + PH - 2).toBeCloseTo(74, 5)
    // уход: нижняя кромка выше верхнего края сцены
    expect(pts.after.y + PH).toBeLessThanOrEqual(0)
  })

  it('машина: вход сверху через автомобильные ворота, выход снизу вверх', () => {
    const gate = makeCarGate()
    const CH = CAR.height / 2
    const enter = deriveTrafficPoints(gate, CAR, 'enter', SCENE)
    expect(enter.spawn.y + CH).toBeLessThanOrEqual(0)
    // стоп: бампер (низ спрайта) на 10px выше верхней линии ворот (90)
    expect(enter.stop.y + CH).toBeCloseTo(100 - 10, 5)
    expect(enter.cross.y + CH).toBeCloseTo(220 + 26, 5)
    expect(enter.after.y - CH).toBeGreaterThanOrEqual(SCENE.height)

    const exit = deriveTrafficPoints(gate, CAR, 'exit', SCENE)
    expect(exit.spawn.y - CH).toBeGreaterThanOrEqual(SCENE.height)
    expect(exit.stop.y + CH).toBeCloseTo(220 + 30, 5)
    expect(exit.cross.y + CH).toBeCloseTo(100 - 26, 5)
    expect(exit.after.y + CH).toBeLessThanOrEqual(0)
  })
})

describe('simulatorTraffic: валидация настроенных оффсетов', () => {
  it('устаревший spawnExitPerson сверху отбрасывается — спавн остаётся снизу', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket',
        isOpen: false,
        isAnimating: false,
        // центр маркера = центр калитки (800,160) + оффсет: спавн у верха сцены
        spawnExitPersonX: 0,
        spawnExitPersonY: -320,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'exit', SCENE)
    expect(pts.spawn.y - PERSON.height / 2).toBeGreaterThanOrEqual(SCENE.height)
  })

  it('устаревший stopEnterPerson ниже забора отбрасывается — стоп выводится над калиткой', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket',
        isOpen: false,
        isAnimating: false,
        // центр стопа на y=427.5: ноги на 455 — глубоко под забором (220)
        stopEnterPersonX: 0,
        stopEnterPersonY: 267.5,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.stop.y + PERSON.height / 2 - 2).toBeCloseTo(90, 0)
  })

  it('валидный настроенный стоп применяется как есть (центр = центр ворот + оффсет)', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket',
        isOpen: false,
        isAnimating: false,
        // центр стопа y = 160 - 127.5 = 32.5 (ноги на 60 — над калиткой)
        stopEnterPersonX: 0,
        stopEnterPersonY: -127.5,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.stop.y).toBeCloseTo(32.5, 5)
    expect(pts.stop.x).toBeCloseTo(800, 5)
  })

  it('despawnEnter выше забора (мусор) заменяется уходом за нижний край', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket',
        isOpen: false,
        isAnimating: false,
        despawnEnterPersonY: -200,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.after.y - PERSON.height / 2).toBeGreaterThanOrEqual(SCENE.height)
  })
})

describe('simulatorTraffic: горизонтальный поток (вертикальный забор)', () => {
  const tallGate = makeCarGate({ width: 120, height: 320, x: 580, y: 180 })
  const CW = CAR.width / 2

  it('вход слева направо, выход справа налево', () => {
    const enter = deriveTrafficPoints(tallGate, CAR, 'enter', SCENE)
    expect(enter.vertical).toBe(false)
    expect(enter.spawn.x + CW).toBeLessThanOrEqual(0)
    // стоп: правая кромка на 10px левее левой линии ворот (580)
    expect(enter.stop.x + CW).toBeCloseTo(580 - 10, 5)
    // проход: левая кромка на 26px правее правой линии (700)
    expect(enter.cross.x - CW).toBeCloseTo(700 + 26, 5)
    expect(enter.after.x - CW).toBeGreaterThanOrEqual(SCENE.width)

    const exit = deriveTrafficPoints(tallGate, CAR, 'exit', SCENE)
    expect(exit.spawn.x - CW).toBeGreaterThanOrEqual(SCENE.width)
    expect(exit.stop.x - CW).toBeCloseTo(700 + 16, 5)
    expect(exit.cross.x + CW).toBeCloseTo(580 - 10, 5)
    expect(exit.after.x + CW).toBeLessThanOrEqual(0)
  })
})

// ----- Поведенческие тесты (харнесс физики, как в enter-flow) -----

const DT = 0.05

const buildCarHarness = () => {
  const carGate = makeCarGate({ settings: { gateType: 'sliding', isOpen: true, isAnimating: false } })
  const simElements = ref<any[]>([carGate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (gate: any) => { gate.settings.isOpen = true; return true },
    (gate: any) => { gate.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined
  )
  return { simElements, aiAgents, physics, carGate, simOpts }
}

const mkCar = (id: string, direction: 'enter' | 'exit', state: string, pos: { x: number; y: number }, target: { x: number; y: number }) => ({
  id,
  element: {
    id, x: pos.x - CAR.width / 2, y: pos.y - CAR.height / 2, width: CAR.width, height: CAR.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: pos.x, y: direction === 'enter' ? SCENE.height + 100 : -100, width: 0, height: 0 },
  exitPoint: { x: pos.x, y: pos.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
})

describe('поведение: машина после ворот', () => {
  it('машина в waiting_after уезжает за ~2с, даже если ворота открыты', () => {
    const h = buildCarHarness()
    // входящая машина уже проехала ворота: стоит в waiting_after под ними
    const car = mkCar('car-1', 'enter', 'waiting_after', { x: 540, y: 250 }, { x: 540, y: 250 })
    h.aiAgents.value = [car as any]

    let frames = 0
    for (; frames < 120; frames++) { // 6с максимум
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      if (car.state === 'moving_away') break
    }
    expect(car.state).toBe('moving_away')
    // CAR_LEAVE_DELAY = 1.6с -> 32 кадра; допуск на пару кадров
    expect(frames).toBeLessThanOrEqual(40)
    // цель — точка ухода за нижний край
    expect(car.target.y).toBeGreaterThanOrEqual(SCENE.height)
  })

  it('машина в to_gate: ретаргет приводит цель остановки к геометрии ворот', () => {
    const h = buildCarHarness()
    // ворота открыты; машина едет сверху к остановке перед воротами
    const car = mkCar('car-2', 'enter', 'to_gate', { x: 540, y: -80 }, { x: 0, y: 0 })
    h.aiAgents.value = [car as any]

    h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    // стоп: бампер на 10px выше верхней линии ворот (100), X — центр ворот (580)
    expect(car.target.y + CAR.height / 2).toBeCloseTo(100 - 10, 0)
    expect(car.target.x).toBeCloseTo(580, 0)
  })
})
