// tests/person-tuning.test.ts
// [№27-НАСТРОЙКИ-ЛЮДЕЙ] реестр настроек движения/логики людей:
//  1) реестр консистентен (уникальные ключи, дефолт в диапазоне, тумблеры в дефолтах);
//  2) tuneNumber клампит мусор и выходы за диапазон, tuneBool — строгое !== false;
//  3) физика читает настройки: pForceCross ускоряет принудительный проход,
//     pYieldOn=false отключает шаг уступания, pAccelOn=false даёт мгновенный разгон;
//  4) шаг уступания ОБХОДИТ ждущих рядом: двое ждущих, уступая одному проходному,
//     не накладываются (репорт №27 «прыгают друг на друга после уступания»);
//  5) [№27-УЕЗД-ЗАКРЫТИЕ] машина на посадке не уезжает при незакрытых воротах,
//     даже когда другая машина у ворот; при закрытых — немедленный уезд без паузы.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import {
  PERSON_TUNING_FIELDS, defaultPersonTuning, tuneNumber, tuneBool,
} from '~/utils/personTuning'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.05
const PERSON = { width: PERSON_WIDTH, height: PERSON_HEIGHT }
const CAR = { width: 80, height: 40 }
const SCENE = { width: 1280, height: 720 }

const makeWicket = () => ({
  id: 'wicket-1', x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const buildPersonHarness = (tuning: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
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

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

describe('реестр настроек людей [№27]', () => {
  afterEach(() => vi.restoreAllMocks())

  it('ключи уникальны, дефолт в диапазоне, тумблеры присутствуют в дефолтах', () => {
    const keys = PERSON_TUNING_FIELDS.map(f => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const f of PERSON_TUNING_FIELDS) {
      expect(f.min).toBeLessThanOrEqual(f.max)
      expect(f.def).toBeGreaterThanOrEqual(f.min)
      expect(f.def).toBeLessThanOrEqual(f.max)
      expect(f.step).toBeGreaterThan(0)
      // [№28-ЖИВАЯ-ПАНЕЛЬ] у каждого поля есть секция для компактной панели
      expect(typeof f.group).toBe('string')
      expect(f.group.length).toBeGreaterThan(0)
    }
    const defs = defaultPersonTuning()
    for (const f of PERSON_TUNING_FIELDS) {
      expect(defs[f.key]).toBe(f.def)
      if (f.toggleKey) expect(defs[f.toggleKey]).toBe(true)
    }
  })

  it('tuneNumber клампит, tuneBool — строгое !== false', () => {
    expect(tuneNumber({ pBypassRadius: 9999 }, 'pBypassRadius')).toBe(140)
    expect(tuneNumber({ pBypassRadius: -5 }, 'pBypassRadius')).toBe(20)
    expect(tuneNumber({ pBypassRadius: 'мусор' }, 'pBypassRadius')).toBe(80)
    expect(tuneNumber({}, 'pBypassRadius')).toBe(80)
    expect(tuneBool({}, 'pBypassOn')).toBe(true)
    expect(tuneBool({ pBypassOn: false }, 'pBypassOn')).toBe(false)
    expect(tuneBool({ pBypassOn: 'x' }, 'pBypassOn')).toBe(true)
  })
})

describe('физика читает настройки [№27]', () => {
  afterEach(() => vi.restoreAllMocks())

  it('pForceCross меньше дефолта — принудительный проход начинается раньше', () => {
    // человек у несуществующих ворот (cfg.personGateId битый):
    // ветка [gate-missing] форсирует проход через pForceCross
    const run = (tuning: Record<string, unknown>) => {
      const h = buildPersonHarness(tuning)
      const p = mkPerson('p1', 'waiting_before', { x: 1000, y: 194.5 }, { x: 1000, y: 194.5 }, 'enter')
      h.aiAgents.value = [p as any]
      let crossedAt: number | null = null
      for (let i = 0; i < 300; i++) {
        h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'missing-gate' })
        if (h.aiAgents.value[0]?.state === 'crossing') { crossedAt = i * DT; break }
      }
      return crossedAt
    }
    const early = run({ pForceCross: 2 })
    const late = run({ pForceCross: 8 })
    expect(early).not.toBeNull()
    expect(late).not.toBeNull()
    expect(early!).toBeLessThan(late!)
  })

  it('pYieldOn=false — ждущий не шагает в сторону проходящего', () => {
    const h = buildPersonHarness({ pYieldOn: false })
    const waiter = mkPerson('waiter', 'waiting_before', { x: 800, y: 300 }, { x: 800, y: 300 }, 'exit')
    const passer = mkPerson('passer', 'moving_away', { x: 500, y: 300 }, { x: 1400, y: 300 }, 'enter', 40)
    h.aiAgents.value = [waiter as any, passer as any]
    const startX = waiter.element.x
    const startY = waiter.element.y
    for (let i = 0; i < 200; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (!h.aiAgents.value.some(a => a.id === 'passer')) break
    }
    // уступания нет: смещение минимально (только аварийный клапан при контакте)
    expect(Math.hypot(waiter.element.x - startX, waiter.element.y - startY)).toBeLessThan(12)
  })

  it('pAccelOn=false — скорость применяется мгновенно (без рампы)', () => {
    const h = buildPersonHarness({ pAccelOn: false })
    const walker = mkPerson('w', 'moving_away', { x: 1000, y: 300 }, { x: 200, y: 300 }, 'exit')
    h.aiAgents.value = [walker as any]
    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    expect(walker.element.velocity).toBeGreaterThan(35)
  })
})

describe('уступание обходит ждущих рядом [№27]', () => {
  afterEach(() => vi.restoreAllMocks())

  it('двое ждущих, уступая проходному, не накладываются друг на друга', () => {
    const h = buildPersonHarness()
    // проходной идёт по линии y=300 прямо на ждущего A (800,300);
    // ждущий B стоит в 24px позади-справа от A — без обхода оба отходили бы
    // в одну сторону и сталкивались
    const waiterA = mkPerson('A', 'waiting_before', { x: 800, y: 300 }, { x: 800, y: 300 }, 'exit')
    const waiterB = mkPerson('B', 'waiting_before', { x: 824, y: 324 }, { x: 824, y: 324 }, 'exit')
    const passer = mkPerson('passer', 'moving_away', { x: 500, y: 300 }, { x: 1400, y: 300 }, 'enter', 40)
    h.aiAgents.value = [waiterA as any, waiterB as any, passer as any]

    let minDist = Infinity
    for (let i = 0; i < 400; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (!h.aiAgents.value.some(a => a.id === 'passer')) break
      const a = centerOf(h.aiAgents.value.find(x => x.id === 'A'))
      const b = centerOf(h.aiAgents.value.find(x => x.id === 'B'))
      minDist = Math.min(minDist, Math.hypot(a.x - b.x, a.y - b.y))
    }
    // нижняя граница — страховка шага 0.9 × PERSON_HARD_SEP (27) с допуском кадра
    expect(minDist).toBeGreaterThan(25)
  })
})

describe('уезд машины только после закрытия ворот [№27-УЕЗД-ЗАКРЫТИЕ]', () => {
  afterEach(() => vi.restoreAllMocks())

  const buildCarHarness = (gateOpen: boolean, tuning: Record<string, unknown> = {}) => {
    const gate: any = makeCarGate()
    gate.settings.isOpen = gateOpen
    const simElements = ref<any[]>([gate])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ ...SCENE })
    const simOpts: any = {
      ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
      MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
      gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
      personTuning: tuning,
    }
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { g.settings.isOpen = true; return true },
      (g: any) => { g.settings.isOpen = false; return true },
      () => {},
      simOpts,
    )
    return { gate, simElements, aiAgents, physics }
  }

  it('ворота ОТКРЫТЫ, другая машина у ворот — машина НЕ уезжает (стояла и стоит)', () => {
    const h = buildCarHarness(true)
    const enter = mkCar('car-e', 'enter', 'to_gate', 1000, 194, { x: 580, y: 194 }, { x: 580, y: 900 })
    const landed = mkCar('car-l', 'enter', 'waiting_after', 580, 258, { x: 580, y: 258 }, { x: 580, y: 900 })
    h.aiAgents.value = [enter as any, landed as any]
    for (let i = 0; i < 40; i++) { // 2с — пауза 0.8с давно прошла
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }
    expect(landed.state).toBe('waiting_after')
  })

  it('ворота ЗАКРЫТЫ, другая машина у ворот — немедленный уезд без вежливой паузы', () => {
    const h = buildCarHarness(false)
    const enter = mkCar('car-e', 'enter', 'to_gate', 1000, 194, { x: 580, y: 194 }, { x: 580, y: 900 })
    const landed = mkCar('car-l', 'enter', 'waiting_after', 580, 258, { x: 580, y: 258 }, { x: 580, y: 900 })
    h.aiAgents.value = [enter as any, landed as any]
    let departedAt: number | null = null
    for (let i = 0; i < 10; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      if (landed.state === 'moving_away') { departedAt = i * DT; break }
    }
    expect(departedAt).not.toBeNull()
    expect(departedAt!).toBeLessThan(0.3)
  })

  it('pQuietZone=0 — позиции остаются конечными (нет NaN от деления на 0)', () => {
    const h = buildPersonHarness({ pQuietZone: 0 })
    const walker = mkPerson('w', 'to_gate', { x: 1000, y: 194.5 }, { x: 800, y: 194.5 }, 'enter')
    const other = mkPerson('o', 'waiting_before', { x: 820, y: 194.5 }, { x: 800, y: 194.5 }, 'exit')
    h.aiAgents.value = [walker as any, other as any]
    for (let i = 0; i < 200; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }
    for (const a of h.aiAgents.value) {
      expect(Number.isFinite(a.element.x)).toBe(true)
      expect(Number.isFinite(a.element.y)).toBe(true)
    }
  })
})
