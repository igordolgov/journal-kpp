// tests/traffic-scheme.test.ts
// [СХЕМА-ТРАЕКТОРИЙ][КАНОН «КАК РАНЬШЕ»] регрессионные тесты единой геометрии
// траекторий. Забор горизонтальный (город сверху, база снизу), вдоль городской
// стороны — дорога:
//  1) вход: спавн за ПРАВЫМ краем на линии дороги -> стоп у ворот (подошва/
//     бампер на нижней линии ворот) -> проход ВНИЗ -> уход за нижний край;
//  2) выход: спавн за НИЖНИМ краем -> стоп под воротами -> проход ВВЕРХ к
//     линии дороги -> уход ВБОК за правый край;
//  3) валидация: настроенные оффсеты не с той стороны отбрасываются
//     (именно они давали «спавнятся не с той стороны»);
//  4) машина покидает waiting_after за ~2с, а не через closeDelay+15с;
//  5) ретаргет физики приводит цель к той же остановке, что и спавн;
//  6) ждущий у прохода человек отходит в сторону, когда мимо проходит
//     встречный (уступают ОБА направления, а не только входящий).
// Все точки схемы — ЦЕНТР агента (физика центрирует элемент на цели).

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  trafficPointsFor,
  deriveTrafficPoints,
  isValidPoint,
  CAR_EXIT_PULL_PAST,
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

// калитка (760,100,80,120): центр X = 800, нижняя линия (дорога) F = 220
// человек 40x55, подошва = центр + h/2 - 2 -> центр на дороге = 194.5
const W_CX = 800
const W_ROAD = 220 - PERSON_HEIGHT / 2 + 2 // 194.5
const OFF_PERSON = 78                      // PERSON_STOP_OFFSET

describe('simulatorTraffic: каноническая схема — вход', () => {
  const wicket = makeWicket()
  const PH = PERSON.height / 2

  it('вход: спавн за правым краем на линии дороги, стоп у калитки, проход вниз, уход за нижний край', () => {
    const pts = deriveTrafficPoints(wicket, PERSON, 'enter', SCENE)
    expect(pts.vertical).toBe(false) // колонна группы по X (подход сбоку)
    // спавн полностью за правым краем
    expect(pts.spawn.x - PH).toBeGreaterThanOrEqual(SCENE.width)
    // спавн на линии дороги: подошва на нижней линии калитки (220)
    expect(pts.spawn.y + PH - 2).toBeCloseTo(220, 5)
    // стоп: подошва на 6 px ВЫШЕ линии ([СПЕЦ-Z5/Z7] не впритык к забору),
    // X — центр калитки
    expect(pts.stop.y + PH - 2).toBeCloseTo(214, 5)
    expect(pts.stop.x).toBeCloseTo(W_CX, 5)
    // проход: подошва на стоп-офсет ниже линии дороги
    expect(pts.cross.y + PH - 2).toBeCloseTo(220 + OFF_PERSON, 5)
    // уход: верхняя кромка за нижним краем сцены
    expect(pts.after.y - PH).toBeGreaterThanOrEqual(SCENE.height)
    expect(pts.after.x).toBeCloseTo(W_CX, 5)
  })

  it('выход: спавн за нижним краем, стоп под калиткой, проход вверх к дороге, уход ВБОК за правый край', () => {
    const pts = deriveTrafficPoints(wicket, PERSON, 'exit', SCENE)
    expect(pts.vertical).toBe(true) // колонна группы по Y (подход снизу)
    // спавн за нижним краем (верхняя кромка >= 720)
    expect(pts.spawn.y - PH).toBeGreaterThanOrEqual(SCENE.height)
    // стоп: подошва на дороге + стоп-офсет
    expect(pts.stop.y + PH - 2).toBeCloseTo(220 + OFF_PERSON, 5)
    // проход: подошва выходит НА линию дороги
    expect(pts.cross.y + PH - 2).toBeCloseTo(220, 5)
    // уход ВБОК: спавн-точка за правым краем на линии дороги
    expect(pts.after.x - PH).toBeGreaterThanOrEqual(SCENE.width)
    expect(pts.after.y + PH - 2).toBeCloseTo(220, 5)
  })

  it('машина: вход слева по дороге через автомобильные ворота, уезжает вниз; выход уезжает вбок', () => {
    const gate = makeCarGate() // (420,100,320,120): центр X = 580, низ = 220
    const CH = CAR.height / 2
    const ROAD = 220 - CH // 200
    const OFF_CAR = 58    // CAR_STOP_OFFSET

    const enter = deriveTrafficPoints(gate, CAR, 'enter', SCENE)
    expect(enter.vertical).toBe(false)
    expect(enter.spawn.x - CH).toBeGreaterThanOrEqual(SCENE.width)
    // стоп: бампер (низ спрайта) на 6 px выше линии ворот ([СПЕЦ-Z7]),
    // X — центр ворот
    expect(enter.stop.y + CH).toBeCloseTo(214, 5)
    expect(enter.stop.x).toBeCloseTo(580, 5)
    // проход: бампер на 58px ниже линии
    expect(enter.cross.y + CH).toBeCloseTo(220 + OFF_CAR, 5)
    expect(enter.after.y - CH).toBeGreaterThanOrEqual(SCENE.height)

    const exit = deriveTrafficPoints(gate, CAR, 'exit', SCENE)
    expect(exit.spawn.y - CH).toBeGreaterThanOrEqual(SCENE.height)
    // [БАГ-РЕПОРТ-8-СТОП][СПЕЦ-Z8] стоп выезжающей — зеркально въезжающей,
    // бампер НЕ впритык: верх спрайта на 10 px НИЖЕ линии ворот
    // (bottom = линия + h + 10), по правке заказчика «не впритык к линии»
    expect(exit.stop.y + CH).toBeCloseTo(220 + 2 * CH + 10, 5)
    // [БАГ-РЕПОРТ-5] ждёт закрытия и уезжает ВЫШЕ линии дороги
    // (CAR_EXIT_PULL_PAST): за шлагбаумом, на своей полосе
    expect(exit.cross.y + CH).toBeCloseTo(220 - CAR_EXIT_PULL_PAST, 5)
    // уезжает ВБОК за правый край по своей полосе выше дороги
    expect(exit.after.x - CH).toBeGreaterThanOrEqual(SCENE.width)
    expect(exit.after.y + CH).toBeCloseTo(220 - CAR_EXIT_PULL_PAST, 5)
    expect(ROAD).toBeCloseTo(200, 5) // санити вычисления дороги
  })

  it('машина: side=left — спавн за ЛЕВЫМ краем и уход влево (двустороннее движение)', () => {
    const gate = makeCarGate()
    const CW = CAR.width / 2
    const enterL = deriveTrafficPoints(gate, CAR, 'enter', SCENE, 'left')
    expect(enterL.spawn.x + CW).toBeLessThanOrEqual(0) // за левым краем
    expect(enterL.spawn.y + CAR.height / 2).toBeCloseTo(220, 5) // на линии дороги
    expect(enterL.stop.x).toBeCloseTo(580, 5) // стоп не зависит от стороны
    const exitL = deriveTrafficPoints(gate, CAR, 'exit', SCENE, 'left')
    expect(exitL.after.x + CW).toBeLessThanOrEqual(0) // уезжает влево
    expect(exitL.after.y + CAR.height / 2).toBeCloseTo(220 - CAR_EXIT_PULL_PAST, 5)
    // правая сторона — по умолчанию (совместимость)
    const enterR = deriveTrafficPoints(gate, CAR, 'enter', SCENE)
    expect(enterR.spawn.x - CW).toBeGreaterThanOrEqual(SCENE.width)
  })
})

describe('simulatorTraffic: валидация настроенных оффсетов', () => {
  it('валидный спавн входа за боковым краем применяется (центр = центр ворот + оффсет)', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket', isOpen: false, isAnimating: false,
        // центр спавна x = 800 + 560 = 1360 (за правым краем), y = 160 + 34.5 = 194.5 (дорога)
        spawnEnterPersonX: 560,
        spawnEnterPersonY: 34.5,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.spawn.x).toBeCloseTo(1360, 5)
    expect(pts.spawn.y).toBeCloseTo(W_ROAD, 5)
  })

  it('устаревший spawnEnterPerson у ВЕРХНЕГО края отбрасывается — спавн остаётся за правым краем', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket', isOpen: false, isAnimating: false,
        // центр спавна y = 160 - 320 = -160 — над сценой (вертикальная схема)
        spawnEnterPersonY: -320,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.spawn.x - PERSON.height / 2).toBeGreaterThanOrEqual(SCENE.width)
    expect(pts.spawn.y + PERSON_HEIGHT / 2 - 2).toBeCloseTo(220, 5)
  })

  it('устаревший stopEnterPerson ниже забора отбрасывается — стоп выводится на линию дороги', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket', isOpen: false, isAnimating: false,
        // центр стопа на y = 160 + 267.5 = 427.5: ноги на 455 — глубоко под забором
        stopEnterPersonX: 0,
        stopEnterPersonY: 267.5,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.stop.y + PERSON_HEIGHT / 2 - 2).toBeCloseTo(214, 0)
    expect(pts.stop.x).toBeCloseTo(800, 5)
  })

  it('despawnExit у центра сцены (мусор) заменяется уходом ВБОК за правый край', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket', isOpen: false, isAnimating: false,
        despawnExitPersonX: -700, // центр ухода x = 100 — в сцене, не за краем
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'exit', SCENE)
    expect(pts.after.x - PERSON.height / 2).toBeGreaterThanOrEqual(SCENE.width)
  })

  it('despawnEnter выше забора (мусор) заменяется уходом за нижний край', () => {
    const gate = makeWicket({
      settings: {
        gateType: 'wicket', isOpen: false, isAnimating: false,
        despawnEnterPersonY: -200,
      },
    })
    const pts = trafficPointsFor(gate, PERSON, 'enter', SCENE)
    expect(pts.after.y - PERSON_HEIGHT / 2).toBeGreaterThanOrEqual(SCENE.height)
  })

  it('isValidPoint: точка ухода выхода принимается только за боковым краем', () => {
    const gate = makeWicket()
    const ctx = { vertical: true, gate, size: PERSON, scene: SCENE }
    const right = { x: SCENE.width + 80 + PERSON.height / 2, y: W_ROAD }
    const center = { x: 800, y: W_ROAD }
    expect(isValidPoint('after', 'exit', right, ctx)).toBe(true)
    expect(isValidPoint('after', 'exit', center, ctx)).toBe(false)
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
  afterTarget: { x: pos.x, y: direction === 'enter' ? SCENE.height + 100 : pos.y, width: 0, height: 0 },
  exitPoint: { x: pos.x, y: pos.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
})

describe('поведение: машина после ворот', () => {
  it('машина в waiting_after ждёт ПОЛНОГО закрытия ворот и уезжает после него ([№13])', () => {
    const h = buildCarHarness()
    // входящая машина уже проехала ворота: стоит в waiting_after под ними,
    // ворота ОТКРЫТЫ ([№13]: машина ждёт полного закрытия перед уездом)
    const car = mkCar('car-1', 'enter', 'waiting_after', { x: 540, y: 250 }, { x: 540, y: 250 })
    h.aiAgents.value = [car as any]

    // 0.7с — вежливая пауза ещё не истекла, машина стоит
    for (let i = 0; i < 14; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    }
    expect(car.state).toBe('waiting_after')

    // [№13-БЕЗОПАСНОСТЬ] пауза истекла, ворота открыты — машина ждёт
    // полного закрытия, не уезжает
    for (let i = 0; i < 20; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    }
    expect(car.state).toBe('waiting_after')

    // оператор опускает шлагбаум — машина уезжает
    h.carGate.settings.isOpen = false
    for (let i = 0; i < 40; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      if (car.state === 'moving_away') break
    }
    expect(car.state).toBe('moving_away')
    // уезд вниз по afterTarget ([Z7]: за нижний край сцены)
    expect(car.target.y).toBeGreaterThanOrEqual(SCENE.height)
  })

  it('машина в waiting_after уезжает по канонической схеме, не дожидаясь свободной стороны', () => {
    const h = buildCarHarness()
    h.carGate.settings.isOpen = false
    h.carGate.settings.isAnimating = false
    // въехавшая машина: afterTarget из спавна — за НИЖНИМ краем (уезд вниз)
    const car = mkCar('car-1', 'enter', 'waiting_after', { x: 540, y: 250 }, { x: 540, y: 250 })
    // другая машина стоит на дороге СПРАВА — раньше это заставляло ждать
    const other = mkCar('car-2', 'enter', 'waiting_before', { x: 900, y: 250 }, { x: 580, y: 250 })
    h.aiAgents.value = [car as any, other as any]

    for (let i = 0; i < 120; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      if (car.state === 'moving_away') break
    }
    expect(car.state).toBe('moving_away')
    // [БАГ-РЕПОРТ-5-РАЗЪЕЗД] уезд ВНИЗ по afterTarget, несмотря на занятую дорогу
    expect(car.target.y).toBeGreaterThanOrEqual(SCENE.height)

    // выехавшая машина уезжает ВБОК по afterTarget (своя полоса выше дороги)
    const exitCar = mkCar('car-3', 'exit', 'waiting_after', { x: 580, y: 160 }, { x: 580, y: 160 })
    exitCar.afterTarget = { x: -60 - CAR.width / 2, y: 160, width: 0, height: 0 }
    h.aiAgents.value = [exitCar as any]
    for (let i = 0; i < 120; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      if (exitCar.state === 'moving_away') break
    }
    expect(exitCar.state).toBe('moving_away')
    expect(exitCar.target.x + CAR.width / 2).toBeLessThanOrEqual(0)
  })


  it('входящая машина тормозит перед стоящей на дороге машиной, а не проезжает сквозь', () => {
    const h = buildCarHarness()
    // стоящее препятствие — машина, ждущая ОТКРЫТИЯ ворот: при [П6] стоящая
    // в waiting_after уезжает после 0.8с, поэтому вечное препятствие —
    // waiting_before (закрытые ворота, машина стоит на своей остановке)
    h.carGate.settings.isOpen = false
    const parked = mkCar('car-p', 'exit', 'waiting_before', { x: 580, y: 200 }, { x: 580, y: 200 })
    // входящая едет справа к той же остановке
    const enter = mkCar('car-e', 'enter', 'to_gate', { x: 1000, y: 200 }, { x: 580, y: 200 })
    h.aiAgents.value = [parked as any, enter as any]

    let minDist = Infinity
    for (let i = 0; i < 240; i++) { // 12с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      const dx = (enter.element.x + CAR.width / 2) - (parked.element.x + CAR.width / 2)
      const dy = (enter.element.y + CAR.height / 2) - (parked.element.y + CAR.height / 2)
      minDist = Math.min(minDist, Math.hypot(dx, dy))
    }
    // корпуса не пересеклись: центры двух машин (по 80 длиной) не ближе 80px
    expect(minDist).toBeGreaterThan(80)
  })

  it('две входящие машины с разных сторон занимают остановку по очереди (без лобового замерзания)', () => {
    const h = buildCarHarness()
    const fromRight = mkCar('car-r', 'enter', 'to_gate', { x: 1000, y: 200 }, { x: 580, y: 200 })
    const fromLeft = mkCar('car-l', 'enter', 'to_gate', { x: 200, y: 200 }, { x: 580, y: 200 })
    h.aiAgents.value = [fromRight as any, fromLeft as any]

    // машины проходят waiting_before за 1 кадр (ворота открыты — сразу
    // crossing), поэтому проверяем (а) отсутствие столкновений на всём пути
    // и (б) что ОБЕ progressed дальше to_gate (никто не замерз на полпути)
    for (let i = 0; i < 400; i++) { // 20с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      const dx = Math.abs(fromRight.element.x - fromLeft.element.x)
      expect(dx).toBeGreaterThan(76) // корпуса не пересеклись
    }
    expect(fromRight.state).not.toBe('to_gate')
    expect(fromLeft.state).not.toBe('to_gate')
  })

  it('машина в to_gate: ретаргет приводит цель остановки к геометрии ворот (бампер на 6px выше линии)', () => {
    const h = buildCarHarness()
    // ворота открыты; машина едет справа по дороге к остановке у ворот
    const car = mkCar('car-2', 'enter', 'to_gate', { x: 1000, y: 200 }, { x: 0, y: 0 })
    h.aiAgents.value = [car as any]

    h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    // стоп: бампер на 6px выше нижней линии ворот ([СПЕЦ-Z7] = 214), X — центр ворот (580)
    expect(car.target.y + CAR.height / 2).toBeCloseTo(214, 0)
    expect(car.target.x).toBeCloseTo(580, 0)
  })

  it('машина едет влево — флаг _facingLeft установлен, rotation остаётся 0 (не стоит на капоте)', () => {
    const h = buildCarHarness()
    const car = mkCar('car-3', 'enter', 'to_gate', { x: 1000, y: 200 }, { x: 0, y: 0 })
    h.aiAgents.value = [car as any]

    for (let i = 0; i < 30; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    }
    // машина движется влево по дороге -> физика запомнила курс влево
    expect((car.element.settings as any)?._facingLeft).toBe(true)
    // и НЕ вращается по вертикали
    expect(car.element.rotation).toBe(0)
  })
})

describe('поведение: уступание ждущего', () => {
  const buildPersonHarness = () => {
    const wicket = makeWicket()
    const simElements = ref<any[]>([wicket])
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
    return { simElements, aiAgents, physics }
  }

  const mkPerson = (id: string, state: string, pos: { x: number; y: number }, target: { x: number; y: number }, direction: 'enter' | 'exit', velocity = 0) => ({
    id,
    element: {
      id, x: pos.x - PERSON.width / 2, y: pos.y - PERSON.height / 2,
      width: PERSON.width, height: PERSON.height,
      rotation: 0, velocity, category: 'human', type: 'actor', direction,
    },
    state,
    target: { x: target.x, y: target.y, width: 0, height: 0 },
    afterTarget: { x: target.x, y: target.y, width: 0, height: 0 },
    exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
    speed: 40, type: 'person', direction, travelMode: 'walk',
  })

  it('ждущий у прохода отходит в сторону, когда встречный идёт прямо на него (лоб на дороге)', () => {
    const h = buildPersonHarness()
    // выходящий стоит в waiting_before; калитка закрыта — он ждёт
    const waiter = mkPerson('waiter', 'waiting_before', { x: 800, y: 300 }, { x: 800, y: 300 }, 'exit')
    // входящий идёт прямо НА него по одной линии (лобовая встреча на дороге)
    const passer = mkPerson('passer', 'moving_away', { x: 500, y: 300 }, { x: 1400, y: 300 }, 'enter', 40)
    h.aiAgents.value = [waiter as any, passer as any]
    const startX = waiter.element.x
    const startY = waiter.element.y

    for (let i = 0; i < 500; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      // [ВАЖНО] ref() оборачивает объекты в reactive-proxy: сравниваем по id,
      // а не по ссылке (includes(passenser) всегда false -> цикл рвался на 1-м кадре)
      if (!h.aiAgents.value.some(a => a.id === 'passer')) break
    }
    // ждущий уступил: сместился от проходящего минимум на 3px
    expect(Math.hypot(waiter.element.x - startX, waiter.element.y - startY)).toBeGreaterThan(3)
    // и пропустил: проходящий прошёл дальше ждущего по X (пока он на сцене)
    const passerFinal = h.aiAgents.value.find(a => a.id === 'passer') as any
    const waiterCx = waiter.element.x + PERSON.width / 2
    if (passerFinal) {
      expect(passerFinal.element.x + PERSON.width / 2).toBeGreaterThan(waiterCx)
    }
  })

  it('ждущий стоит на месте, если рядом никто не проходит', () => {
    const h = buildPersonHarness()
    const waiter = mkPerson('waiter', 'waiting_before', { x: 800, y: 300 }, { x: 800, y: 300 }, 'exit')
    // проходящий далеко (220px по вертикали) — вне PERSON_SEP_RADIUS
    const passer = mkPerson('passer', 'moving_away', { x: 500, y: 540 }, { x: 1400, y: 540 }, 'enter', 40)
    h.aiAgents.value = [waiter as any, passer as any]
    const startX = waiter.element.x
    const startY = waiter.element.y

    for (let i = 0; i < 300; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (!h.aiAgents.value.some(a => a.id === 'passer')) break
    }
    expect(Math.hypot(waiter.element.x - startX, waiter.element.y - startY)).toBeLessThan(0.5)
  })

  it('входящий останавливается перед стоящим выходящим, не толкает его; стоящий отходит вбок', () => {
    const h = buildPersonHarness()
    // выходящий стоит ровно на точке остановки входящего (конец прохода)
    const waiter = mkPerson('waiter', 'waiting_before', { x: 800, y: 194.5 }, { x: 800, y: 194.5 }, 'exit')
    // входящий идёт к той же точке
    const passer = mkPerson('passer', 'to_gate', { x: 1100, y: 194.5 }, { x: 800, y: 194.5 }, 'enter')
    h.aiAgents.value = [waiter as any, passer as any]
    const startX = waiter.element.x
    const startY = waiter.element.y

    let minDist = Infinity
    let maxWaiterShift = 0
    for (let i = 0; i < 600; i++) { // 30с максимум
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (!h.aiAgents.value.some(a => a.id === 'passer')) break
      const dx = (passer.element.x + PERSON.width / 2) - (waiter.element.x + PERSON.width / 2)
      const dy = (passer.element.y + PERSON.height / 2) - (waiter.element.y + PERSON.height / 2)
      minDist = Math.min(minDist, Math.hypot(dx, dy))
      maxWaiterShift = Math.max(
        maxWaiterShift,
        Math.hypot(waiter.element.x - startX, waiter.element.y - startY),
      )
    }
    // корпуса не столкнулись (минимальная дистанция центров > 30px; при
    // «толкании» она падает до ~0-10px)
    expect(minDist).toBeGreaterThan(30)
    // [№32] стоящий уступает заранее — уходит от исходной точки вбок, пока
    // входящий идёт/стоит у его курса. Кинематический подход входящего
    // (быстрее старого ползучего) сократил окно уступания: смещение
    // транзиентное (после прохода ждущий может вернуться к своей точке),
    // поэтому мерим МАКСИМУМ смещения за прогон, а не финал.
    expect(maxWaiterShift).toBeGreaterThan(4)
  })
})
