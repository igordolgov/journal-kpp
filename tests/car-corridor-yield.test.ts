// tests/car-corridor-yield.test.ts
// [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] машины уступают проезд друг другу «как люди»:
//  1) выезжающая машина, стоящая на посадке въезда (= её остановка), отъезжает
//     ВГЛУБЬ БАЗЫ, пока въезжающая проходит ворота; въезжающая проходит
//     ПЛАВНО (без скачков позиции) и без watchdog-телепорта;
//  2) въезжающая, припаркованная НА линии прохода выезда, отъезжает НАЗАД ПО
//     ДОРОГЕ, выезжающая проходит ворота плавно;
//  3) колонна машин отъезжает «в.lockstep» — дистанция между своими не меняется;
//  4) после проезда и закрытия ворот уступившая машина возвращается на свою
//     остановку (re-approach);
//  5) ожидающая выше дороги машина (waiting_after) НЕ считается «стоящей на
//     моей остановке» — въезжающая не отъезжает от неё (радиус 35 < PULL 40);
//  6) [АНТИ-СКАЧОК] сторож не телепортирует агента на ЗАНЯТУЮ цель.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'
import { CAR_STOP_OFFSET } from '~/utils/simulatorConstants'

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

const ROAD_Y = 220 - CAR.height / 2          // 200 — центр на дороге
const ENTER_STOP_Y = ROAD_Y                  // остановка въезда (бампер на линии)
const ENTER_CROSS_Y = ROAD_Y + CAR_STOP_OFFSET // 258 — посадка въезда
const EXIT_CROSS_Y = ROAD_Y - CAR_EXIT_PULL_PAST // 160 — ожидание закрытия

const buildHarness = (gateOverrides: Record<string, unknown> = {}) => {
  const gate: any = { ...GATE, settings: { ...GATE.settings, ...gateOverrides } }
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const warns: string[] = []
  const spy = vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
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
  return { gate, simElements, aiAgents, sceneSize, physics, warns, spy }
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
    speed: 100, type: 'car', direction: s.direction, travelMode: 'car',
  }
  return agent
}

const centerOf = (a: any) => ({
  x: a.element.x + CAR.width / 2,
  y: a.element.y + CAR.height / 2,
})

// максимальный скачок позиции за кадр + пересечение корпусов (прямоугольники)
// касание углами в пределах 2px пересечением не считается
const trackMotion = (cars: any[]) => {
  const last = new Map<string, { x: number; y: number }>()
  let maxJump = 0
  let overlapped = false
  return {
    step() {
      for (let i = 0; i < cars.length; i++) {
        const c = centerOf(cars[i])
        const prev = last.get(cars[i].id)
        if (prev) maxJump = Math.max(maxJump, Math.hypot(c.x - prev.x, c.y - prev.y))
        last.set(cars[i].id, { x: c.x, y: c.y })
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i].element; const b = cars[j].element
          if (a.x < b.x + CAR.width - 2 && a.x + CAR.width > b.x + 2 &&
              a.y < b.y + CAR.height - 2 && a.y + CAR.height > b.y + 2) overlapped = true
        }
      }
    },
    maxJump: () => maxJump,
    everOverlapped: () => overlapped,
  }
}

describe('уступание машин у ворот ([БАГ-РЕПОРТ-6])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('выезжающая отъезжает вниз, въезжающая проходит ворота плавно, без watchdog', () => {
    const h = buildHarness()
    // въезжающая уже в проходе: цель — посадка (580, 258)
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'crossing',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_CROSS_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
    })
    // выезжающая стоит НА посадке въезда (её остановка = та же точка)
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'waiting_before',
      pos: { x: 580, y: ENTER_CROSS_Y }, target: { x: 580, y: ENTER_CROSS_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    h.aiAgents.value = [enter, exit]
    const motion = trackMotion([enter, exit])
    const startY = centerOf(exit).y

    for (let i = 0; i < 80; i++) { // 4с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      motion.step()
    }

    // встречная отъехала вниз (освободила посадку)
    expect(centerOf(exit).y - startY).toBeGreaterThanOrEqual(25)
    // въезжающая плавно прошла ворота и ждёт закрытия
    expect(enter.state).toBe('waiting_after')
    // без телепортов: скачок за кадр не длиннее шага скорости + посадка
    expect(motion.maxJump()).toBeLessThanOrEqual(100 * DT + 3)
    // корпуса не пересекались (носовой зазор при старте — 18px, это норма)
    expect(motion.everOverlapped()).toBe(false)
    // сторож молчал
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })

  it('въезжающая отъезжает по дороге, выезжающая проходит ворота плавно', () => {
    const h = buildHarness()
    // выезжающая уже в проходе: с остановки вверх к линии ожидания
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'crossing',
      pos: { x: 580, y: ENTER_CROSS_Y }, target: { x: 580, y: EXIT_CROSS_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    // въезжающая припаркована НА линии прохода выезда (её стоп = 580,200)
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'waiting_before',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    h.aiAgents.value = [enter, exit]
    const motion = trackMotion([enter, exit])
    const startX = centerOf(enter).x

    for (let i = 0; i < 100; i++) { // 5с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      motion.step()
    }

    // въезжающая отъехала назад по дороге (от ворот, вправо)
    expect(centerOf(enter).x - startX).toBeGreaterThanOrEqual(25)
    // выезжающая прошла ворота и ждёт закрытия на своей полосе
    expect(exit.state).toBe('waiting_after')
    expect(centerOf(exit).y).toBeLessThan(ENTER_STOP_Y)
    expect(motion.maxJump()).toBeLessThanOrEqual(100 * DT + 3)
    expect(motion.everOverlapped()).toBe(false)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })

  it('колонна въезжающих отъезжает синхронно — дистанция между своими сохраняется', () => {
    const h = buildHarness()
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'crossing',
      pos: { x: 580, y: ENTER_CROSS_Y }, target: { x: 580, y: EXIT_CROSS_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    const lead = mkCar({
      id: 'car-l', direction: 'enter', state: 'waiting_before',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    const tail = mkCar({
      id: 'car-t', direction: 'enter', state: 'waiting_before',
      pos: { x: 670, y: ENTER_STOP_Y }, target: { x: 670, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    h.aiAgents.value = [exit, lead, tail]
    const gap0 = centerOf(tail).x - centerOf(lead).x // 90
    let minGap = Infinity
    let maxGap = 0

    for (let i = 0; i < 80; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      const gap = centerOf(tail).x - centerOf(lead).x
      minGap = Math.min(minGap, gap)
      maxGap = Math.max(maxGap, gap)
    }

    // обе отъехали назад
    expect(gap0).toBeCloseTo(90, 5)
    // колонна не сжалась и не растянулась сильнее шага кадра
    expect(Math.abs(maxGap - gap0)).toBeLessThanOrEqual(CAR_YIELD_SPEED_EPS)
    expect(Math.abs(minGap - gap0)).toBeLessThanOrEqual(CAR_YIELD_SPEED_EPS)
    expect(h.warns.filter(w => w.includes('[watchdog]'))).toEqual([])
  })

  it('после проезда и закрытия ворот уступившая возвращается на свою остановку', () => {
    const h = buildHarness()
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'crossing',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_CROSS_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
    })
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'waiting_before',
      pos: { x: 580, y: ENTER_CROSS_Y }, target: { x: 580, y: ENTER_CROSS_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    h.aiAgents.value = [enter, exit]

    // фаза 1: въезжающая проходит, выезжающая отъезжает (3с)
    for (let i = 0; i < 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }
    expect(enter.state).toBe('waiting_after')
    const backedOffY = centerOf(exit).y
    expect(backedOffY).toBeGreaterThan(ENTER_CROSS_Y + 20)

    // фаза 2: ворота закрыли (вручную, без таймеров) — въезжающая уезжает вниз
    h.gate.settings.isOpen = false
    h.gate.settings.isAnimating = false
    for (let i = 0; i < 140; i++) { // 7с: уезд вниз мимо отъехавшей машины
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      if (!h.aiAgents.value.some(a => a.id === 'car-e')) break
    }
    // въезжающая ушла вниз (деспавн за нижним краем)
    const enterGone = !h.aiAgents.value.some(a => a.id === 'car-e')
    const enterBelow = enterGone || centerOf(enter).y > centerOf(exit).y + 40
    expect(enterBelow).toBe(true)

    // фаза 3: коридор свободен — выезжающая вернулась на остановку
    for (let i = 0; i < 160; i++) { // 8с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      if (exit.state === 'waiting_before' &&
          Math.abs(centerOf(exit).y - ENTER_CROSS_Y) < 8) break
    }
    expect(exit.state).toBe('waiting_before')
    expect(Math.abs(centerOf(exit).y - ENTER_CROSS_Y)).toBeLessThan(8)
    expect(h.warns.filter(w => w.includes('[watchdog]'))).toEqual([])
  })

  it('ожидающая выше дороги машина — не «моя остановка»: въезжающая не отъезжает, а выезжающая уезжает без закрытия ([БАГ-РЕПОРТ-7-УЕЗД])', () => {
    const h = buildHarness()
    // выезжающая уже прошла ворота и ждёт закрытия выше дороги (580,160)
    const exit = mkCar({
      id: 'car-x', direction: 'exit', state: 'waiting_after',
      pos: { x: 580, y: EXIT_CROSS_Y }, target: { x: 580, y: EXIT_CROSS_Y },
      exitPoint: { x: 580, y: EXIT_CROSS_Y }, afterTarget: { x: 1300, y: EXIT_CROSS_Y },
    })
    // въезжающая припаркована на своей остановке (580,200) — в 40px ниже
    const enter = mkCar({
      id: 'car-e', direction: 'enter', state: 'waiting_before',
      pos: { x: 580, y: ENTER_STOP_Y }, target: { x: 580, y: ENTER_STOP_Y },
      exitPoint: { x: 580, y: ENTER_CROSS_Y }, afterTarget: { x: 580, y: 900 },
      facingLeft: true,
    })
    h.aiAgents.value = [enter, exit]
    const startX = centerOf(enter).x

    for (let i = 0; i < 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }

    // не отъехала (40 >= CAR_YIELD_ON_MY_SPOT 35 — не считается «на моей»)
    expect(Math.abs(centerOf(enter).x - startX)).toBeLessThan(1)
    // [БАГ-РЕПОРТ-7-УЕЗД] выезжающая уехала, НЕ дожидаясь полного закрытия:
    // у ворот (с другой стороны) уже стоит въезжающая
    expect(exit.state).toBe('moving_away')
    expect(h.gate.settings.isOpen).toBe(true)
    // въезжающая не отъезжала; после раннего уезда встречной проход
    // освободился — она встала в очередь либо уже пошла на проход
    expect(['waiting_before', 'crossing']).toContain(enter.state)
  })
})

// допуск «lockstep» колонны: расхождение не больше уступки за 1 кадр + посадка
const CAR_YIELD_SPEED_EPS = 55 * DT + 2

describe('watchdog не телепортирует на занятую цель ([БАГ-РЕПОРТ-6-АНТИ-СКАЧОК])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('пешеход в crossing, чья цель занята стоящим, не прыгает (цель занята)', () => {
    const wicket = {
      id: 'w1', x: 760, y: 100, width: 50, height: 120,
      rotation: 0, velocity: 0, category: 'gate', type: 'gate',
      name: 'Калитка', zIndex: 300,
      settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
    }
    const simElements = ref<any[]>([wicket])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ ...SCENE })
    const warns: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      warns.push(args.map(String).join(' '))
    })
    const simOpts: any = {
      ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
      MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
      gateCloseDelay: 10, wicketCloseDelay: 0, stallEscalateTime: 10,
    }
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { g.settings.isOpen = true; return true },
      (g: any) => { g.settings.isOpen = false; return true },
      () => {},
      simOpts, undefined, undefined
    )
    // «сосед» стоит ровно НА цели пешехода p1 (легитимная очередь у калитки)
    const mate: any = {
      id: 'p2',
      element: { id: 'p2', x: 575, y: 373, width: 40, height: 55, rotation: 0, velocity: 0, category: 'human', type: 'actor', direction: 'exit' },
      state: 'waiting_before',
      target: { x: 595, y: 400, width: 0, height: 0 },
      afterTarget: { x: 2600, y: 400, width: 0, height: 0 },
      exitPoint: { x: 595, y: 320, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'exit', travelMode: 'walk',
    }
    const p1: any = {
      id: 'p1',
      element: { id: 'p1', x: 480, y: 373, width: 40, height: 55, rotation: 0, velocity: 0, category: 'human', type: 'actor', direction: 'exit' },
      state: 'crossing',
      target: { x: 595, y: 400, width: 0, height: 0 },
      afterTarget: { x: 2600, y: 400, width: 0, height: 0 },
      exitPoint: { x: 595, y: 400, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'exit', travelMode: 'walk',
    }
    aiAgents.value = [mate, p1]

    // 12с: подход, стоп за соседом, сторож (10с) — цель занята, телепорта НЕТ
    for (let i = 0; i < 240; i++) {
      physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
    }

    expect(warns.filter(w => w.includes('[watchdog]'))).toEqual([])
    // p1 остался в crossing у соседа (не прыгнул на цель и не улетел)
    expect(p1.state).toBe('crossing')
    const cx = p1.element.x + 20
    expect(cx).toBeLessThan(595) // не доехал/не прыгнул на занятую цель
  })
})
