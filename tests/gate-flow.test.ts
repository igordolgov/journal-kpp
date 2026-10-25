// tests/gate-flow.test.ts
// [№20-ВОРОТА-ИДЕАЛ] пересмотр логики движения у ворот:
//  1) выезжающая машина при свободной полосе заканчивает проход СРАЗУ на
//     линии ожидания въезжающих — никакого «проехала вверх, вернулась»;
//  2) полоса занята (встречная стоит/подъезжает) — ждёт вверху на посадке;
//  3) пока ворота не закрылись, точка ожидания пересчитывается в ОБЕ
//     стороны (корректор): полоса освободилась — вниз на линию, встречная
//     подъехала — вверх на посадку;
//  4) въехавшая машина уезжает НАЛЕВО сразу, когда выезжающая хочет выезд,
//     не дожидаясь закрытия ворот («чтобы не создавать пробку»);
//  5) уезд выезжающей — в сторону без встречных въезжающих на дороге;
//  6) человек не пересекает линию забора вне проёма калитки;
//  7) скорость людей меняется рампом (анти-рывок), не мгновенно.
// [№23] машины при пустых воротах ждут ПОЛНОГО закрытия до уезда; проход
// смещённого уступанием человека — пристройка к проёму и ход сквозь, без
// дуг (№30); взаимный затор встречных разрешается прорывом.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_EXIT_PULL_PAST, STOP_STANDOFF_ENTER, FOOT_PAD_PERSON } from '~/utils/simulatorTraffic'
import { clampPersonToFence } from '~/utils/gateFlow'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const PERSON = { width: 40, height: 55 }

const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const makeWicket = () => ({
  id: 'wicket-1', x: 550, y: 100, width: 60, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const F = 220                       // линия дороги/забора
const ROAD_Y = F - CAR.height / 2   // 200
const ENTER_STOP_Y = ROAD_Y - STOP_STANDOFF_ENTER        // 194 — линия ожидания
const EXIT_CROSS_Y = ROAD_Y - CAR_EXIT_PULL_PAST         // 160 — глубокая посадка
const EXIT_STOP_Y = ROAD_Y + CAR.height + 10             // 250
const CX = 580

const buildHarness = (elements: any[] = [], opts: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([...elements])
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
  return { simElements, aiAgents, sceneSize, physics, warns }
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
  exitPoint: { x: CX, y: direction === 'exit' ? EXIT_CROSS_Y : ROAD_Y + 58, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'car-gate-1',
})

const mkPerson = (id: string, state: string, cx: number, cy: number, target: { x: number; y: number }) => ({
  id,
  element: {
    id, x: cx - PERSON.width / 2, y: cy - PERSON.height / 2, width: PERSON.width, height: PERSON.height,
    rotation: 0, velocity: 0, category: 'person', type: 'actor', direction: 'enter',
    settings: {},
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: target.x, y: 900, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y + 78, width: 0, height: 0 },
  speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
  gateId: 'wicket-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

const tick = (h: ReturnType<typeof buildHarness>, n: number, cfg = { carGateId: 'car-gate-1', personGateId: 'wicket-1' }) => {
  for (let i = 0; i < n; i++) h.physics.updateAiMovement(DT, cfg)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('[№20-БЕЗ-ВОЗВРАТА] цель прохода выезжающей', () => {
  it('свободная полоса — проход заканчивается сразу на линии ожидания въезжающих', () => {
    const h = buildHarness([makeCarGate()])
    const exit = mkCar('car-x', 'exit', 'waiting_before', CX, EXIT_STOP_Y, { x: CX, y: EXIT_STOP_Y }, { x: 1300, y: EXIT_CROSS_Y })
    h.aiAgents.value = [exit as any]

    tick(h, 1)
    expect(exit.state).toBe('crossing')
    expect(exit.target.y).toBeGreaterThanOrEqual(ENTER_STOP_Y - 2)
    expect(exit.target.y).toBeLessThanOrEqual(ENTER_STOP_Y + 2)
  })

  it('полоса занята (встречная стоит на линии) — проход к глубокой посадке', () => {
    const h = buildHarness([makeCarGate()])
    const enter = mkCar('car-e', 'enter', 'waiting_before', CX, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 })
    const exit = mkCar('car-x', 'exit', 'waiting_before', CX, EXIT_STOP_Y, { x: CX, y: EXIT_STOP_Y }, { x: 1300, y: EXIT_CROSS_Y })
    h.aiAgents.value = [enter as any, exit as any]

    tick(h, 1)
    expect(exit.state).toBe('crossing')
    expect(Math.abs(exit.target.y - EXIT_CROSS_Y)).toBeLessThanOrEqual(2)
  })
})

describe('[№23-ВЫЕЗД/№20-КОРРЕКТОР] точка ожидания выезжающей до закрытия', () => {
  it('у ворот никого — ждёт ПОЛНОГО закрытия на линии ([№23]); после закрытия уезд в свободную сторону', () => {
    const h = buildHarness([makeCarGate()])
    // встречные — ТРАНЗИТ по дороге (moving_away, цели вне осевого коридора):
    // у ворот никого — раннего уезда нет ни при каких сторонах. (to_gate не
    // годится: его цель каждый тик переписывается на стоп-линию ворот —
    // выходила бы «машина у ворот». moving_away цели не переписываются.)
    const enterL = mkCar('car-l', 'enter', 'moving_away', 200, ENTER_STOP_Y, { x: 60, y: ENTER_STOP_Y }, { x: 60, y: ENTER_STOP_Y })
    const enterR = mkCar('car-r', 'enter', 'moving_away', 1000, ENTER_STOP_Y, { x: 1140, y: ENTER_STOP_Y }, { x: 1140, y: ENTER_STOP_Y })
    const exit = mkCar('car-x', 'exit', 'waiting_after', CX, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: 1300, y: ENTER_STOP_Y })
    h.aiAgents.value = [enterL as any, enterR as any, exit as any]
    tick(h, 12) // пауза 0.8с+ — ждёт закрытия ([№23]), ворота открыты
    expect(exit.state).toBe('waiting_after')
    expect(h.simElements.value[0].settings.isOpen).toBe(true)

    // правая сторона освободилась — ВСЁ РАВНО ждёт закрытия: у ворот никого
    h.aiAgents.value = [enterL as any, exit as any]
    tick(h, 12)
    expect(exit.state).toBe('waiting_after')

    // оператор закрыл ворота — уезд по правой (свободной) стороне
    h.simElements.value[0].settings.isOpen = false
    h.simElements.value[0].settings.isAnimating = false
    tick(h, 3)
    expect(['moving_away', 'done']).toContain(exit.state)
    expect(exit.afterTarget.x).toBeGreaterThan(1280)
  })

  it('у ворот машина (цель в коридоре), обе стороны дороги заняты — корректор поднимает на посадку, уезд после закрытия', () => {
    const h = buildHarness([makeCarGate()])
    // слева встречная на дороге (сторона занята), справа — машина, чья ЦЕЛЬ
    // на линии ожидания (претендует на ось): уезд некуда, линию надо
    // освободить — корректор поднимает выезжающую на глубокую посадку
    const enterL = mkCar('car-l', 'enter', 'to_gate', 200, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 })
    const enterR = mkCar('car-r', 'enter', 'to_gate', 640, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 })
    const exit = mkCar('car-x', 'exit', 'waiting_after', CX, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: 1300, y: ENTER_STOP_Y })
    h.aiAgents.value = [enterL as any, enterR as any, exit as any]

    tick(h, 25) // 2.5с — корректор поднимает выезжающую на посадку (раннего уезда нет: стороны дороги заняты)
    expect(exit.state).toBe('waiting_after')
    expect(Math.abs(centerOf(exit).y - EXIT_CROSS_Y)).toBeLessThanOrEqual(3)
  })
})

describe('[№27-УЕЗД-ЗАКРЫТИЕ] уезд въезжающей налево после закрытия', () => {
  it('выезжающая хочет выезд — въехавшая ждёт ПОЛНОГО закрытия и уезжает налево', () => {
    const h = buildHarness([makeCarGate()])
    const enter = mkCar('car-in', 'enter', 'waiting_after', CX, ROAD_Y + 58, { x: CX, y: ROAD_Y + 58 }, { x: CX, y: 900 })
    const exit = mkCar('car-out', 'exit', 'to_gate', CX, 400, { x: CX, y: EXIT_STOP_Y }, { x: 1300, y: EXIT_CROSS_Y })
    h.aiAgents.value = [enter as any, exit as any]
    expect(h.simElements.value[0].settings.isOpen).toBe(true)

    // [№27] подъехавшая выезжающая больше НЕ разрешает уезд из-под
    // открытого шлагбаума: вежливая пауза прошла, ворота открыты — машина
    // ждёт закрытия на посадке
    tick(h, 12) // 1.2с
    expect(enter.state).toBe('waiting_after')

    // оператор закрыл ворота — уезд налево (коридор уезда занят выезжающей)
    h.simElements.value[0].settings.isOpen = false
    h.simElements.value[0].settings.isAnimating = false
    tick(h, 3)
    expect(enter.state).toBe('moving_away')
    expect(enter.afterTarget.x).toBeLessThan(0)
    expect(Math.abs(enter.afterTarget.y - (ROAD_Y + 58))).toBeLessThanOrEqual(2)

    // выезжающая освобождена и идёт к своей остановке
    tick(h, 20)
    expect(centerOf(exit).y).toBeLessThan(400)
  })
})

describe('[№20-УЕЗД] сторона уезда выезжающей', () => {
  it('встречная въезжающая на дороге справа — уезд в свободную сторону (налево)', () => {
    const h = buildHarness([makeCarGate()])
    const exit = mkCar('car-x', 'exit', 'waiting_after', CX, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: 1300, y: ENTER_STOP_Y })
    const enter = mkCar('car-e', 'enter', 'to_gate', 950, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 })
    h.aiAgents.value = [exit as any, enter as any]
    // [№23] встречная претендует на ось (цель в коридоре) — У ВОРОТ есть
    // машина: ранний уезд в свободную сторону сразу после вежливой паузы
    tick(h, 10)

    // ранний уезд уже произошёл (ворота открыты); закрытие оператора
    // не влияет — уезд вбок по фактической полосе и в СВОБОДНУЮ сторону
    h.simElements.value[0].settings.isOpen = false
    h.simElements.value[0].settings.isAnimating = false
    tick(h, 3)
    expect(['moving_away', 'done']).toContain(exit.state)
    expect(exit.afterTarget.x).toBeLessThan(0)
    expect(Math.abs(exit.afterTarget.y - centerOf(exit).y)).toBeLessThanOrEqual(2)
  })
})

describe('[№20-КАЛИТКА-ЗАБОР] человек не пересекает забор вне проёма', () => {
  const WICKET = { x: 550, y: 100, width: 60, height: 120 }

  it('unit: корпус, накрывший линию забора, мягко возвращается на сторону цели; касание линии легально', () => {
    // зона калитки: полуширина 30 + 45 = 75 от оси 580 -> cx в [505..655];
    // проём [556..604]; берём cx вне проёма, но в зоне
    const above = { x: 500, y: 180, width: 40, height: 55 }   // cx 520, низ 233 накрывает F=220, цель выше
    for (let i = 0; i < 40; i++) clampPersonToFence(above, WICKET, 100)
    expect(above.y).toBeCloseTo(F - 2 - 55, 0)

    const below = { x: 500, y: 215, width: 40, height: 55 }   // cx 520, цель ниже (в базе)
    for (let i = 0; i < 40; i++) clampPersonToFence(below, WICKET, 400)
    expect(below.y).toBeCloseTo(F, 0)

    // цель выше, а сам накрыл линию с другой стороны (дрейф за проём) —
    // возвращается на сторону цели, без телепорта (пошагово)
    const drifted = { x: 500, y: 215, width: 40, height: 55 }
    const y0 = drifted.y
    clampPersonToFence(drifted, WICKET, 100)
    expect(drifted.y).toBeLessThan(y0)                         // шаг вверх...
    expect(y0 - drifted.y).toBeLessThanOrEqual(9)              // ...но не рывок

    // легальное касание: визуальный низ ровно на линии (спавн входа,
    // полоса выхода) — не триггерит
    const touching = { x: 500, y: F - 55 + 2, width: 40, height: 55 }
    clampPersonToFence(touching, WICKET, 100)
    expect(touching.y).toBe(F - 55 + 2)

    const aperture = { x: 570, y: 180, width: 40, height: 55 } // cx 590 в проёме
    clampPersonToFence(aperture, WICKET, 100)
    expect(aperture.y).toBe(180)

    const clear = { x: 500, y: 100, width: 40, height: 55 }   // низ 153 — не у линии
    clampPersonToFence(clear, WICKET, 100)
    expect(clear.y).toBe(100)

    const farAway = { x: 300, y: 180, width: 40, height: 55 } // cx 320 вне зоны калитки
    clampPersonToFence(farAway, WICKET, 100)
    expect(farAway.y).toBe(180)
  })

  it('физика: идущего к калитке человека сбоку не выносит за забор', () => {
    const h = buildHarness([makeWicket()])
    // человек в движении в зоне калитки (cx 520, вне проёма), корпус
    // пересекает линию забора
    const p = mkPerson('p-1', 'to_gate', 520, 200, { x: 580, y: 148 })
    p.element.velocity = 30
    h.aiAgents.value = [p as any]

    tick(h, 15, { carGateId: '', personGateId: 'wicket-1' })
    const bottom = p.element.y + p.element.height - FOOT_PAD_PERSON
    expect(bottom).toBeLessThanOrEqual(F - 4 + 0.5)
  })
})

describe('[№30-БЕЗ-ДУГИ] проход смещённого человека — пристройка и ход сквозь', () => {
  it('смещённый уступанием человек пристраивается к проёму: первая цель НЕ ось, проход строго в проём', () => {
    const h = buildHarness([makeWicket()])
    // человек смещён от оси 580 на 40px (после уступания выходящему)
    const p = mkPerson('p-1', 'waiting_before', 540, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]

    tick(h, 1)
    // пристройка началась: первая точка между стартом и осью, БЕЗ прямого возврата
    expect(p.state).toBe('crossing')
    expect(p.target.x).toBeGreaterThan(540)
    expect(p.target.x).toBeLessThan(580)

    // проход: пока корпус пересекает полосу забора (низ в диапазоне F±8),
    // человек в проёме — плечи не цепляют косяк
    let maxDev = 0
    let crossed = false
    for (let i = 0; i < 160; i++) {
      tick(h, 1)
      const c = centerOf(p as any)
      const bottom = p.element.y + p.element.height
      if (bottom > F - 8 && bottom < F + 40) {
        crossed = true
        maxDev = Math.max(maxDev, Math.abs(c.x - 580))
      }
      if (c.y > 226 + 40) break
    }
    expect(crossed).toBe(true)
    expect(maxDev).toBeLessThanOrEqual(2.5)
    expect(centerOf(p as any).y).toBeGreaterThan(226)
  })

  it('человек у самой линии забора: боковая пристройка к проёму — без наезда на забор', () => {
    const h = buildHarness([makeWicket()])
    // визуальный низ ровно на линии F (посадка входа), смещён на 40px
    const touchCy = F - PERSON.height / 2 + 2   // footPad = 2
    const p = mkPerson('p-2', 'waiting_before', 540, touchCy, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]
    tick(h, 1)
    expect(p.state).toBe('crossing')
    // [№30-БЕЗ-ДУГИ] пристройка — чисто боковой шаг на той же высоте:
    // ни отхода от забора, ни рывка к оси, ни старта вниз вдоль забора
    expect(p.target.x).toBe(550 + 6 + PERSON.width / 2) // 576 — край коридора проёма
    expect(p.target.y).toBe(touchCy)

    // весь проход: пока корпус НЕ в проёме (|cx-580| > 4) — визуальный низ
    // не ниже линии забора (скольжение вдоль, не сквозь)
    let violation = false
    let crossed = false
    for (let i = 0; i < 200; i++) {
      tick(h, 1)
      const c = centerOf(p as any)
      const visualBottom = p.element.y + p.element.height - FOOT_PAD_PERSON
      if (Math.abs(c.x - 580) > 4 && visualBottom > F + 0.5) violation = true
      if (c.y > 226 + 40) { crossed = true; break }
    }
    expect(crossed).toBe(true)
    expect(violation).toBe(false)
  })

  it('человек на оси начинает проход без дуги', () => {
    const h = buildHarness([makeWicket()])
    const p = mkPerson('p-2', 'waiting_before', 580, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]
    tick(h, 1)
    expect(p.state).toBe('crossing')
    // сквозная цель сразу: ось X, ниже забора (148 + 78 = 226 > F=220)
    expect(p.target.x).toBe(580)
    expect(p.target.y).toBe(226)
  })
})

describe('[№21-ВСТРЕЧНЫЕ] встречные расходятся правее без торможения', () => {
  it('двое идущих навстречу не сбавляют ход и расходятся боковым шагом «каждый правее»', () => {
    const h = buildHarness([makeWicket()])
    // оба moving_away (без ретаргета to_gate): один идёт влево, другой вправо
    const leftGoer = mkPerson('p-a', 'moving_away', 1000, 148, { x: 200, y: 148 })
    leftGoer.direction = 'enter'
    leftGoer.element.velocity = leftGoer.speed
    const rightGoer = mkPerson('p-b', 'moving_away', 200, 148, { x: 1200, y: 148 })
    rightGoer.direction = 'exit'
    rightGoer.element.velocity = rightGoer.speed
    h.aiAgents.value = [leftGoer as any, rightGoer as any]

    let minDist = Infinity
    let maxDiv = 0
    for (let i = 0; i < 130; i++) {
      tick(h, 1)
      const a = centerOf(leftGoer as any)
      const b = centerOf(rightGoer as any)
      minDist = Math.min(minDist, Math.hypot(a.x - b.x, a.y - b.y))
      maxDiv = Math.max(maxDiv, Math.abs(a.y - b.y))
      // торможения нет: ход остаётся крейсерским
      expect(leftGoer.element.velocity).toBeGreaterThanOrEqual(leftGoer.speed - 2)
      expect(rightGoer.element.velocity).toBeGreaterThanOrEqual(rightGoer.speed - 2)
    }
    // корпуса не вошли друг в друга и разошлись по высоте (каждый правее)
    expect(minDist).toBeGreaterThan(28)
    expect(maxDiv).toBeGreaterThan(25)
  })
})

describe('[№20-ПЛАВНОСТЬ] рамп скорости людей', () => {
  it('человек набирает скорость плавно (не мгновенно), доехав до крейсерской', () => {
    const h = buildHarness([makeWicket()])
    const p = mkPerson('p-ramp', 'to_gate', 1100, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]

    tick(h, 1, { carGateId: '', personGateId: 'wicket-1' })
    expect(p.element.velocity).toBeGreaterThan(0)
    expect(p.element.velocity).toBeLessThan(p.speed)          // ещё разгон
    tick(h, 6)
    expect(p.element.velocity).toBeCloseTo(p.speed, 5)        // ~0.7с — вышли на крейсерскую
  })
})
