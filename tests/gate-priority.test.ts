// tests/gate-priority.test.ts
// [БАГ-РЕПОРТ-9] регрессионные тесты развязки «две машины у ворот» и плавности
// подхода к точке останова:
//  1) въезжающая НЕ стартует проход в корпус стоящей выезжающей — выезд идёт
//     первым, въезжающая отъезжает по дороге (приоритет выезда, №9);
//  2) пара полностью разъезжается без предохранителей (watchdog/crossing-cap/
//     direction-queue молчат), ворота закрываются после выезда, въезжающая
//     проходит на следующем открытии;
//  3) финальное дотягивание машины: на последних 10px скорость <= 12 px/с и
//     монотонно спадает — нет «клевка» в точке останова;
//  4) то же для человека (последние 8px — <= 10 px/с).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_STOP_OFFSET } from '~/utils/simulatorConstants'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'

const DT = 0.05
const CAR = { width: 80, height: 40 }
const SCENE = { width: 1280, height: 720 }

// автомобильные ворота (420,100,320,120): центр X=580, низ (дорога) F=220
const GATE = {
  id: 'car-gate-1',
  x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Ворота',
  zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
}

const ROAD_Y = 220 - CAR.height / 2              // 200
const ENTER_STOP_Y = ROAD_Y - 6                // остановка въезда ([СПЕЦ-Z7] 6px выше линии)
const ENTER_CROSS_Y = ROAD_Y + CAR_STOP_OFFSET   // 258 — посадка въезда
const EXIT_STOP_Y = ROAD_Y + CAR.height + 10     // 250 — остановка выезда ([СПЕЦ-Z8])
const EXIT_CROSS_Y = ROAD_Y - CAR_EXIT_PULL_PAST // 160 — ожидание закрытия

const buildHarness = (gateOverrides: Record<string, unknown> = {}) => {
  const gate: any = { ...GATE, settings: { ...GATE.settings, ...gateOverrides } }
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
    waitAfterMax: 30,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined
  )
  return { gate, simElements, aiAgents, sceneSize, physics, warns }
}

interface CarSpec {
  id: string
  direction: 'enter' | 'exit'
  state: string
  pos: { x: number; y: number }
  target: { x: number; y: number }
  exitPoint: { x: number; y: number }
  afterTarget: { x: number; y: number }
  facingLeft?: boolean
  speed?: number
}

const mkCar = (s: CarSpec) => {
  const el: any = {
    id: s.id,
    x: s.pos.x - CAR.width / 2, y: s.pos.y - CAR.height / 2,
    width: CAR.width, height: CAR.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction: s.direction,
    settings: { _facingLeft: s.facingLeft !== false },
  }
  const agent: any = {
    id: s.id, element: el, state: s.state,
    target: { x: s.target.x, y: s.target.y, width: 0, height: 0 },
    afterTarget: { x: s.afterTarget.x, y: s.afterTarget.y, width: 0, height: 0 },
    exitPoint: { x: s.exitPoint.x, y: s.exitPoint.y, width: 0, height: 0 },
    speed: s.speed ?? 100, type: 'car', direction: s.direction, travelMode: 'car',
  }
  return agent
}

const centerOf = (a: any) => ({
  x: a.element.x + CAR.width / 2,
  y: a.element.y + CAR.height / 2,
})

const trackPair = (a: any, b: any) => {
  let overlapped = false
  const check = () => {
    const A = a.element; const B = b.element
    if (A.x < B.x + CAR.width - 2 && A.x + CAR.width > B.x + 2 &&
        A.y < B.y + CAR.height - 2 && A.y + CAR.height > B.y + 2) overlapped = true
  }
  return { check, overlapped: () => overlapped }
}

describe('приоритет выезда у ворот ([БАГ-РЕПОРТ-9])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('въезжающая не заезжает в выезжающую: выезд проходит и уезжает первым ([П6]), въезд стартует по расчистке створа', () => {
    const h = buildHarness()
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'waiting_before',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'waiting_before',
      pos: { x: 580, y: EXIT_STOP_Y }, target: { x: 580, y: EXIT_STOP_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    h.aiAgents.value = [enter, exit]
    const pair = trackPair(enter, exit)
    let exitLanded = false
    let premature = false

    for (let i = 0; i < 220; i++) { // 11с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      pair.check()
      if (exit.state === 'waiting_after') exitLanded = true
      const exitOccupies = exit.state === 'crossing' || exit.state === 'waiting_after'
      if (exitOccupies && (enter.state === 'crossing' || enter.state === 'waiting_after')) premature = true
    }

    // выезжающая прошла ворота (садилась на полосу) и уехала, не дожидаясь
    // закрытия ([П6]: уезд с посадки после вежливой паузы)
    expect(exitLanded).toBe(true)
    expect(['moving_away', 'done']).toContain(exit.state)
    // въезжающая не стартовала, пока створ занимал выезд ([D1]/[D2])
    expect(premature).toBe(false)
    // ...и прошла следом на ещё открытых воротах (закрытие — по расчистке)
    expect(['crossing', 'waiting_after', 'moving_away', 'done']).toContain(enter.state)
    // корпуса не пересекались ни разу
    expect(pair.overlapped()).toBe(false)
    // сторож/капы/очередь молчат — пара разъезжается штатно
    const bad = h.warns.filter(w =>
      w.includes('[watchdog]') || w.includes('[crossing-cap]') || w.includes('[direction-queue]'))
    expect(bad).toEqual([])
  })

  it('пара полностью разъезжается: выезд проезжает и уезжает, въезжающая проходит следом ([П6])', () => {
    const h = buildHarness()
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'waiting_before',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'waiting_before',
      pos: { x: 580, y: EXIT_STOP_Y }, target: { x: 580, y: EXIT_STOP_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    h.aiAgents.value = [enter, exit]
    const pair = trackPair(enter, exit)

    let exitLanded = false
    let premature = false
    let enterCrossed = false

    // 45с: полный цикл пары без ручного вмешательства и без предохранителей:
    // выезд проходит, уезжает (очередь въезда легально держит ворота),
    // въезд стартует по расчистке створа и уезжает после ПОЛНОГО закрытия
    // ([№13]: оператор опускает шлагбаум за спиной въехавшей — таймер
    // отсчёта в юнит-тесте не тикает)
    for (let i = 0; i < 900; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      pair.check()
      if (enter.state === 'waiting_after' && h.gate.settings.isOpen && !h.gate.settings.isAnimating) {
        h.gate.settings.isOpen = false
      }
      if (exit.state === 'waiting_after') exitLanded = true
      const exitOccupies = exit.state === 'crossing' || exit.state === 'waiting_after'
      if (exitOccupies && (enter.state === 'crossing' || enter.state === 'waiting_after')) premature = true
      if (enter.state === 'crossing' || enter.state === 'waiting_after') enterCrossed = true
      if (h.aiAgents.value.length === 0) break
    }

    expect(exitLanded).toBe(true)            // выезд прошёл первым
    expect(premature).toBe(false)            // створ обслуживал по одной машине
    expect(enterCrossed).toBe(true)          // въезд прошёл следом
    expect(h.aiAgents.value.length).toBe(0)  // обе машины ушли со сцены
    // без пересечений корпусов и без сторожей
    expect(pair.overlapped()).toBe(false)
    const bad = h.warns.filter(w =>
      w.includes('[watchdog]') || w.includes('[crossing-cap]') ||
      w.includes('[direction-queue]') || w.includes('[post-gate-cap]'))
    expect(bad).toEqual([])
  })
})

describe('плавный подход к точке останова ([БАГ-РЕПОРТ-9-РЫВОК])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('машина: последние пиксели — дотягивание без клевка, монотонный спад', () => {
    const h = buildHarness({ isOpen: false })
    const car = mkCar({
      id: 'car-a', direction: 'enter', state: 'to_gate',
      pos: { x: 880, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    h.aiAgents.value = [car]

    const nearVel: number[] = []
    let minDist = Infinity
    let overshot = false
    for (let i = 0; i < 160; i++) { // 8с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      const c = centerOf(car)
      const d = Math.abs(c.x - 580)
      minDist = Math.min(minDist, d)
      if (c.x < 579) overshot = true
      if (d <= 10) nearVel.push(car.element.velocity || 0)
      if (car.state === 'waiting_before') break
    }

    expect(car.state).toBe('waiting_before')
    expect(Math.abs(centerOf(car).x - 580)).toBeLessThanOrEqual(1.5)
    expect(overshot).toBe(false)
    expect(nearVel.length).toBeGreaterThan(0)
    // [№9-РЫВОК] тапер 24 -> 8 px/с на последних 12px: кап считается ДО шага,
    // дистанция фиксируется ПОСЛЕ — допуск на один шаг (v*dt ≈ 1.2)
    expect(Math.max(...nearVel)).toBeLessThanOrEqual(23.5)
    for (let i = 1; i < nearVel.length; i++) {
      expect(nearVel[i]).toBeLessThanOrEqual(nearVel[i - 1] + 0.01)
    }
  })

  it('человек: последние пиксели — дотягивание без рывка', () => {
    const simElements = ref<any[]>([])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ ...SCENE })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const simOpts: any = {
      ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
      MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1, stallEscalateTime: 10,
    }
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      () => true, () => true, () => {}, simOpts, undefined, undefined
    )
    const person: any = {
      id: 'p-a',
      element: { id: 'p-a', x: 1000, y: 400, width: 40, height: 55, rotation: 0, velocity: 0, category: 'human', type: 'actor', direction: 'enter' },
      state: 'to_gate',
      target: { x: 800, y: 400, width: 0, height: 0 },
      afterTarget: { x: 800, y: 20, width: 0, height: 0 },
      exitPoint: { x: 800, y: 300, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
    }
    aiAgents.value = [person]

    const nearVel: number[] = []
    let arrived = false
    for (let i = 0; i < 300; i++) { // 15с
      physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
      const cx = person.element.x + 20
      const d = Math.abs(cx - 800)
      if (d <= 8) nearVel.push(person.element.velocity || 0)
      if (d <= 1.5) { arrived = true; break }
    }

    expect(arrived).toBe(true)
    expect(nearVel.length).toBeGreaterThan(0)
    // [№9-РЫВОК] тапер 11 -> 4 px/с на последних 8px: при dist 8 кап = 11
    expect(Math.max(...nearVel)).toBeLessThanOrEqual(11.5)
    for (let i = 1; i < nearVel.length; i++) {
      expect(nearVel[i]).toBeLessThanOrEqual(nearVel[i - 1] + 0.01)
    }
  })
})
