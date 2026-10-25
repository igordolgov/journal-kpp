// tests/cross-direct.test.ts
// [№30-БЕЗ-ДУГИ] Репорт №30: «давай уберем вообще эту "дугу". и сделай
// рефакторинг и упрощение всей логики движения и уступания, чтобы она была
// максимально похожа на движения в жизни».
//
// Проход через калитку теперь — как в жизни, без кривых:
//  1) РЕЕСТР: параметров дуги больше нет (pReturnOn/pReturnArc удалены);
//  2) ПРИСТРОЙКА: первая цель прохода — точка проёма на ТОЙ ЖЕ высоте
//     (короткий боковой шаг, без подъёма/спуска и без рывка);
//  3) СКВОЗЬ: после пристройки цель = сквозная точка выхода, ход к ней;
//  4) БЕЗ ТОРМОЖЕНИЙ: человек в проходе идёт обычным шагом — после набора
//     хода скорость не проваливается (нет «шарканья» у пристройки и
//     разгона после неё);
//  5) ГАРАНТИЯ ЗАБОРА: во втором отрезке корпус не выходит за проём;
//  6) человек на оси (смещение <= 2px) пристройки не получает — цель
//     сразу сквозная; направление прохода (вниз/вверх) роли не играет.

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { wicketAlignX } from '~/utils/gateFlow'
import { PERSON_TUNING_FIELDS, defaultPersonTuning } from '~/utils/personTuning'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.05
const GATE_X = 760
const GATE_W = 80
const AXIS_X = GATE_X + GATE_W / 2
const FENCE_Y = 220
// стандартный сценарий: человек уступанием отошёл на 30px вправо от оси,
// стоит в 60px перед линией забора, сквозная точка выхода — в 60px за ней
const START_X = AXIS_X + 30
const START_Y = FENCE_Y - 60
const EXIT_Y = FENCE_Y + 60
// коридор центров, при котором корпус целиком проходит в проём
const LO_X = GATE_X + 6 + PERSON_WIDTH / 2
const HI_X = GATE_X + GATE_W - 6 - PERSON_WIDTH / 2

const cxOf = (el: any) => el.x + PERSON_WIDTH / 2
const cyOf = (el: any) => el.y + PERSON_HEIGHT / 2

// --- геометрия пристройки: wicketAlignX ---

describe('геометрия пристройки к проёму [№30]', () => {
  it('смещённого человека ставит на ближайший проходной x', () => {
    expect(wicketAlignX(START_X, { x: GATE_X, width: GATE_W }, PERSON_WIDTH / 2)).toBe(HI_X)
  })
  it('человека за проёмом не тянет через стойку', () => {
    expect(wicketAlignX(GATE_X - 60, { x: GATE_X, width: GATE_W }, PERSON_WIDTH / 2)).toBe(LO_X)
  })
  it('человек в проёме остаётся на месте', () => {
    expect(wicketAlignX(AXIS_X + 5, { x: GATE_X, width: GATE_W }, PERSON_WIDTH / 2)).toBe(AXIS_X + 5)
  })
  it('узкая калитка — пристройка на ось', () => {
    // 40px < корпус + 2*запас: коридор вырожден — пристройка на ось калитки
    expect(wicketAlignX(AXIS_X + 30, { x: GATE_X, width: 40 }, PERSON_WIDTH / 2)).toBe(GATE_X + 20)
  })
  it('мусорные входы — ось проёма, без NaN', () => {
    expect(wicketAlignX(NaN, { x: GATE_X, width: GATE_W }, PERSON_WIDTH / 2)).toBe(AXIS_X)
  })
})

describe('реестр: параметров дуги больше нет [№30]', () => {
  it('pReturnOn/pReturnArc удалены из реестра и дефолтов', () => {
    expect(PERSON_TUNING_FIELDS.find(f => f.key === 'pReturnArc')).toBeUndefined()
    expect(PERSON_TUNING_FIELDS.find(f => f.toggleKey === 'pReturnOn')).toBeUndefined()
    const d = defaultPersonTuning() as Record<string, unknown>
    expect('pReturnArc' in d).toBe(false)
    expect('pReturnOn' in d).toBe(false)
  })
})

// --- физика: пристройка + ход сквозь проём ---

const makeWicket = () => ({
  id: 'wicket-1', x: GATE_X, y: 100, width: GATE_W, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: true, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const buildHarness = (tuning: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    personTuning: tuning,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (gate: any) => { gate.settings.isOpen = true; return true },
    (gate: any) => { gate.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined,
  )
  return { simElements, aiAgents, physics }
}

const mkYieldedPerson = () => ({
  id: 'p1',
  element: {
    id: 'p1', x: START_X - PERSON_WIDTH / 2, y: START_Y - PERSON_HEIGHT / 2,
    width: PERSON_WIDTH, height: PERSON_HEIGHT,
    rotation: Math.PI / 2, velocity: 0, category: 'human', type: 'actor', direction: 'enter',
  },
  state: 'waiting_before',
  target: { x: START_X, y: START_Y, width: 0, height: 0 },
  afterTarget: { x: 900, y: 420, width: 0, height: 0 },
  exitPoint: { x: AXIS_X, y: EXIT_Y, width: 0, height: 0 },
  speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
})

describe('физика: проход как в жизни — пристройка и ход сквозь [№30]', () => {
  it('первая цель — пристройка к проёму на той же высоте (без рывка)', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    expect(p.state).toBe('crossing')
    // x — ближайший проходной (правый край коридора центров)...
    expect(p.target.x).toBeCloseTo(HI_X, 5)
    // ...y — ТОТ ЖЕ: боковой шаг без подъёма/спуска (репорт №29 закрыт
    // окончательно: ни бокового рывка к оси, ни хода «не туда»)
    expect(p.target.y).toBeCloseTo(START_Y, 5)
  })

  it('первый отрезок — чисто боковой шаг', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    tick()
    const sx = cxOf(p.element)
    const sy = cyOf(p.element)
    for (let i = 0; i < 4; i++) tick()
    const mx = cxOf(p.element) - sx
    const my = cyOf(p.element) - sy
    // человек пристраивается вбок, а не срывается вниз и не пятается
    expect(Math.abs(mx)).toBeGreaterThan(1)
    expect(Math.abs(my)).toBeLessThan(1)
  })

  it('после пристройки — ход сквозь проём к следующей точке', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    tick()
    // дождаться перехода на сквозную цель
    let switched = false
    for (let i = 0; i < 60; i++) {
      tick()
      if (Math.abs(p.target.x - AXIS_X) < 0.5 && Math.abs(p.target.y - EXIT_Y) < 0.5) { switched = true; break }
    }
    expect(switched).toBe(true)
    const bx = cxOf(p.element)
    const by = cyOf(p.element)
    for (let i = 0; i < 6; i++) tick()
    const mx = cxOf(p.element) - bx
    const my = cyOf(p.element) - by
    // ход к выходу: вперёд больше, чем вбок
    expect(my).toBeGreaterThan(Math.abs(mx))
    expect(my).toBeGreaterThan(0)
  })

  it('человек в проходе не тормозит: после набора хода скорость не проваливается', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    let seenCruise = false
    let minAfter = Infinity
    for (let i = 0; i < 120; i++) {
      tick()
      if (p.state !== 'crossing') break
      const v = p.element.velocity || 0
      if (v >= 38) seenCruise = true
      else if (seenCruise) minAfter = Math.min(minAfter, v)
    }
    expect(seenCruise).toBe(true)
    // прежний brake-cap «шаркал» у точек пути (спад до ~11 px/с);
    // теперь транзит идёт обычным шагом — без провалов и без разгона
    expect(minAfter).toBeGreaterThanOrEqual(30)
  })

  it('гарантия забора: во втором отрезке корпус не выходит за проём', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    let leg2 = false
    let maxCx = -Infinity
    for (let i = 0; i < 200; i++) {
      tick()
      if (p.state !== 'crossing') break
      if (Math.abs(p.target.x - AXIS_X) < 0.5 && Math.abs(p.target.y - EXIT_Y) < 0.5) leg2 = true
      if (leg2) maxCx = Math.max(maxCx, cxOf(p.element))
    }
    expect(leg2).toBe(true)
    // центр не правее коридора проёма (правая стойка + запас 6px)
    expect(maxCx).toBeLessThanOrEqual(HI_X + 0.6)
  })

  it('проход завершается штатно: crossing -> moving_away', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    tick() // waiting_before -> crossing
    for (let i = 0; i < 200 && p.state === 'crossing'; i++) tick()
    expect(p.state).toBe('moving_away')
  })

  it('человек на оси: пристройки нет, цель сразу сквозная', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    p.element.x = AXIS_X - PERSON_WIDTH / 2
    p.target = { x: AXIS_X, y: START_Y, width: 0, height: 0 }
    h.aiAgents.value = [p]
    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    expect(p.state).toBe('crossing')
    expect(p.target.x).toBeCloseTo(AXIS_X, 5)
    expect(p.target.y).toBeCloseTo(EXIT_Y, 5)
  })

  it('выезд вверх симметричен: пристройка на той же высоте', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    const px = AXIS_X - 30
    const py = FENCE_Y + 60
    p.direction = 'exit'
    p.element.direction = 'exit'
    p.element.x = px - PERSON_WIDTH / 2
    p.element.y = py - PERSON_HEIGHT / 2
    p.target = { x: px, y: py, width: 0, height: 0 }
    p.afterTarget = { x: 600, y: 60, width: 0, height: 0 }
    p.exitPoint = { x: AXIS_X, y: FENCE_Y - 60, width: 0, height: 0 }
    h.aiAgents.value = [p]
    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    expect(p.state).toBe('crossing')
    expect(p.target.x).toBeCloseTo(LO_X, 5)
    expect(p.target.y).toBeCloseTo(py, 5)
  })
})
