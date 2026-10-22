// tests/car-left-departure.test.ts
// [№12-РАЗЪЕЗД] машины не могут разъехаться внутри территории: въезжающая
// после прохода стоит на посадке НА ОСИ ворот, а выезжающая поднимается к
// своей остановке ПО ТОЙ ЖЕ ОСИ — «лоб в лоб». Решение заказчика: въехавшая
// уезжает НАЛЕВО (за левый край сцены), освобождая путь выезжающей.
//  A. Выезжающая на оси ниже → уезд налево (afterTarget переписан).
//  B. Коридор свободен → канонический уезд вниз сохранён.
//  C. Выезжающая появилась уже ПОСЛЕ старта уезда вниз → переключение
//     налево в движении (хук mid-departure).
//  D. Выезжающая выше линии дороги (уже выехала) → не блок, уезд вниз.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }

// Ворота: забор 380..420 (линия дороги F = 420), ось x = 640.
const GATE = {
  id: 'gate-1', x: 595, y: 380, width: 90, height: 40,
  category: 'gate', type: 'gate', settings: {},
}

const buildPhysics = () => {
  const simElements = ref<any[]>([GATE])
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
  return { simElements, aiAgents, physics }
}

const mkCar = (
  id: string,
  direction: 'enter' | 'exit',
  state: string,
  cx: number, cy: number,
  target: { x: number; y: number },
  after: { x: number; y: number },
  velocity = 0,
) => ({
  id,
  element: {
    id, x: cx - 40, y: cy - 20, width: 80, height: 40,
    rotation: 0, velocity, category: 'car', type: 'actor', direction,
    settings: {},
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'gate-1',
})

const CFG = { carGateId: 'gate-1', personGateId: '' }

// Канонические точки (производные от GATE): ось 640, посадка въезда
// center y = 420 - 20 + 58 = 458, уезд вниз за нижний край (y = 820),
// стоп выезда center y = 400 + 40 + 10 = 450.
const ENTER_CX = 640
const ENTER_LANDING_Y = 458
const AFTER_DOWN_Y = SCENE.height + 80 + 20 // 820
const EXIT_STOP_Y = 450

describe('[№12-РАЗЪЕЗД] уезд въезжающей налево при занятом коридоре', () => {
  afterEach(() => vi.restoreAllMocks())

  it('A: выезжающая на оси ниже — въезжающая уезжает НАЛЕВО и освобождает путь', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const enter = mkCar('car-in', 'enter', 'waiting_after',
      ENTER_CX, ENTER_LANDING_Y,
      { x: ENTER_CX, y: ENTER_LANDING_Y }, { x: ENTER_CX, y: AFTER_DOWN_Y })
    const exit = mkCar('car-out', 'exit', 'to_gate',
      ENTER_CX, 540, { x: ENTER_CX, y: EXIT_STOP_Y },
      { x: SCENE.width + 100, y: 354 })
    h.aiAgents.value = [enter as any, exit as any]

    // вежливая пауза 0.8с — уезд происходит на ~0.9с
    for (let i = 0; i < 12; i++) h.physics.updateAiMovement(DT, CFG)
    expect(enter.state).toBe('moving_away')
    // точка ухода переписана НАЛЕВО, по текущей полосе
    expect(enter.afterTarget.x).toBeLessThan(0)
    expect(enter.afterTarget.y).toBeCloseTo(ENTER_LANDING_Y, 0)
    expect(enter.target.x).toBeLessThan(0)

    // машина реально уезжает влево
    const x0 = enter.element.x
    for (let i = 0; i < 45; i++) h.physics.updateAiMovement(DT, CFG)
    expect(enter.element.x).toBeLessThan(x0 - 40)

    // выезжающая освободилась и поднимается к своей остановке
    const exitCy = exit.element.y + exit.element.height / 2
    expect(exitCy).toBeLessThan(500)
  })

  it('B: коридор уезда свободен — канонический уезд ВНИЗ сохранён', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const enter = mkCar('car-in', 'enter', 'waiting_after',
      ENTER_CX, ENTER_LANDING_Y,
      { x: ENTER_CX, y: ENTER_LANDING_Y }, { x: ENTER_CX, y: AFTER_DOWN_Y })
    h.aiAgents.value = [enter as any]

    for (let i = 0; i < 12; i++) h.physics.updateAiMovement(DT, CFG)
    expect(enter.state).toBe('moving_away')
    expect(enter.afterTarget.x).toBe(ENTER_CX)
    expect(enter.afterTarget.y).toBe(AFTER_DOWN_Y)
  })

  it('C: выезжающая встала на ось ПОСЛЕ старта уезда вниз — переключение налево в движении', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const enter = mkCar('car-in', 'enter', 'moving_away',
      ENTER_CX, 470, { x: ENTER_CX, y: AFTER_DOWN_Y },
      { x: ENTER_CX, y: AFTER_DOWN_Y }, 40)
    const exit = mkCar('car-out', 'exit', 'to_gate',
      ENTER_CX, 560, { x: ENTER_CX, y: EXIT_STOP_Y },
      { x: SCENE.width + 100, y: 354 })
    h.aiAgents.value = [enter as any, exit as any]

    // хук mid-departure срабатывает в первый же кадр, до шага движения
    h.physics.updateAiMovement(DT, CFG)
    expect(enter.afterTarget.x).toBeLessThan(0)
    expect(enter.target.x).toBeLessThan(0)

    const x0 = enter.element.x
    for (let i = 0; i < 20; i++) h.physics.updateAiMovement(DT, CFG)
    expect(enter.element.x).toBeLessThan(x0 - 40)
    // вниз машина не поехала: корпус не пересёк стоящую ниже выезжающую
    const enterCy = enter.element.y + enter.element.height / 2
    const exitCy = exit.element.y + exit.element.height / 2
    expect(enterCy).toBeLessThan(exitCy)
  })

  it('D: выезжающая выше линии дороги (уже выехала) — не блок, уезд вниз', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const enter = mkCar('car-in', 'enter', 'waiting_after',
      ENTER_CX, ENTER_LANDING_Y,
      { x: ENTER_CX, y: ENTER_LANDING_Y }, { x: ENTER_CX, y: AFTER_DOWN_Y })
    const exit = mkCar('car-out', 'exit', 'moving_away',
      500, 376, { x: -100, y: 354 }, { x: -100, y: 354 }, 60)
    h.aiAgents.value = [enter as any, exit as any]

    for (let i = 0; i < 12; i++) h.physics.updateAiMovement(DT, CFG)
    expect(enter.state).toBe('moving_away')
    expect(enter.afterTarget.x).toBe(ENTER_CX)
    expect(enter.afterTarget.y).toBe(AFTER_DOWN_Y)
  })
})
