// tests/no32-motor-arrival.test.ts
// [№32] Два репорта:
//  A) «когда ворота закрыты, при нажатии на кнопку закрытия слышен звук
//     мотора, пока не нажмёшь отмену закрытия» — холостой твин 0 -> 0 с
//     зацикленным мотором. Створ уже в целевом положении -> анимации нет:
//     флаги финализируются сразу, твин не создаётся, звук не запускается.
//  B) «перед точками ожидания люди сначала замирают как бы скользя, а затем
//     перескакивают на несколько миллиметров» — старый профиль торможения
//     (11 -> 4 px/с на последних 8px + снап до 1px) заменён равнозамедленным
//     ходом v = √(2·a·d): без ползучего хвоста, посадка <= пары десятых px.
//     Машины НЕ тронуты (№27: «машины идеальны»), параметр pArriveDecel —
//     в реестре настроек (группа «Плавность хода», применяется на ходу).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorCore } from '~/composables/simulator/useSimulatorCore'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { trafficPointsFor } from '~/utils/simulatorTraffic'
import { PERSON_TUNING_FIELDS, tuneNumber } from '~/utils/personTuning'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// A) Ворота: холостой «ЗАКРЫТЬ»/«ОТКРЫТЬ» без анимации и мотора [№32-A]
// ---------------------------------------------------------------------------

const makeSlidingGate = (isOpen: boolean) => ({
  id: 'gate-1', x: 700, y: 100, width: 120, height: 24,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: {
    gateType: 'sliding', isOpen, isAnimating: false, isStopping: false,
    openDuration: 2, closeDuration: 2,
    _animX: isOpen ? -120 : 0,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

describe('ворота: створ уже в целевом положении — без фантомного твина и мотора [№32-A]', () => {
  it('ЗАКРЫТЬ на закрытых воротах — no-op: isAnimating не включается, твина нет', () => {
    const simElements = ref<any[]>([makeSlidingGate(false)])
    const core = useSimulatorCore(simElements as any)
    const gate = simElements.value[0]
    const before = { ...gate.settings }

    expect(core.closeGate(gate as any)).toBe(true)
    expect(gate.settings.isAnimating).toBe(false)
    expect(gate.settings.isOpen).toBe(false)
    expect(gate.settings._animX).toBe(before._animX)
    expect(core.gateTweens.size).toBe(0)
    core.killAllGateTweens()
  })

  it('ОТКРЫТЬ на открытых воротах — no-op', () => {
    const simElements = ref<any[]>([makeSlidingGate(true)])
    const core = useSimulatorCore(simElements as any)
    const gate = simElements.value[0]

    expect(core.openGate(gate as any)).toBe(true)
    expect(gate.settings.isAnimating).toBe(false)
    expect(gate.settings.isOpen).toBe(true)
    expect(gate.settings._animX).toBe(-120)
    expect(core.gateTweens.size).toBe(0)
    core.killAllGateTweens()
  })

  it('ЗАКРЫТЬ на ОТКРЫТЫХ воротах по-прежнему анимирует (регресс)', () => {
    const simElements = ref<any[]>([makeSlidingGate(true)])
    const core = useSimulatorCore(simElements as any)
    const gate = simElements.value[0]

    expect(core.closeGate(gate as any)).toBe(true)
    expect(gate.settings.isAnimating).toBe(true)
    expect(core.gateTweens.size).toBe(1)
    // kill не сбрасывает isAnimating (это делает сторож ворот) — чистим реестр
    core.killAllGateTweens()
    expect(core.gateTweens.size).toBe(0)
  })

  it('калитка: ЗАКРЫТЬ на закрытой без разблокировки — прежний no-op без твина', () => {
    const wicket = {
      ...makeSlidingGate(false),
      id: 'wicket-1', width: 40, name: 'Калитка',
      settings: { gateType: 'wicket', isOpen: false, isAnimating: false, _animScaleX: 1 },
    }
    const simElements = ref<any[]>([wicket])
    const core = useSimulatorCore(simElements as any)

    expect(core.closeGate(wicket as any)).toBe(true)
    expect(wicket.settings.isAnimating).toBe(false)
    expect(core.gateTweens.size).toBe(0)
    core.killAllGateTweens()
  })
})

// ---------------------------------------------------------------------------
// B) Люди: равнозамедленная посадка у точки ожидания [№32-B]
// ---------------------------------------------------------------------------

const DT = 0.05
const GATE_X = 760
const GATE_W = 80
const FENCE_Y = 220
const SCENE = { width: 1280, height: 720 }

const makeWicket = () => ({
  id: 'wicket-1', x: GATE_X, y: 100, width: GATE_W, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: true, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

// каноническая точка ожидания входящего человека (физика пересчитывает цель
// из геометрии ворот каждый тик — сценарий строим на той же формуле)
const STOP = trafficPointsFor(
  makeWicket() as any, { width: PERSON_WIDTH, height: PERSON_HEIGHT }, 'enter', SCENE,
).stop

const buildHarness = (tuning: Record<string, unknown> = {}, opts: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    personTuning: tuning,
    ...opts,
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

// человек идёт ВВЕРХ к точке ожидания (стоим ниже неё, на дороге)
const mkApproachingPerson = (dyBelowStop: number, velocity: number) => ({
  id: 'p1',
  element: {
    id: 'p1', x: STOP.x - PERSON_WIDTH / 2, y: STOP.y + dyBelowStop - PERSON_HEIGHT / 2,
    width: PERSON_WIDTH, height: PERSON_HEIGHT,
    rotation: 0, velocity, category: 'human', type: 'actor', direction: 'enter',
    settings: {},
  },
  state: 'to_gate',
  target: { x: STOP.x, y: STOP.y, width: 0, height: 0 },
  afterTarget: { x: STOP.x, y: 60, width: 0, height: 0 },
  exitPoint: { x: STOP.x, y: FENCE_Y + 40, width: 0, height: 0 },
  speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
  gateId: 'wicket-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

describe('посадка у точки ожидания: равнозамедленный ход без замирания [№32-B]', () => {
  it('на подбеге (6px) скорость следует капу √(2·a·d), а не ползучему полу', () => {
    // DECEL огромный: скорость за тик сходится к капу точно
    const h = buildHarness({}, { DECEL: 100000 })
    const p = mkApproachingPerson(6, 40)
    h.aiAgents.value = [p as any]

    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    // √(2·110·6) ≈ 36.3; старый профиль дал бы ~9-11 px/с
    expect(p.element.velocity).toBeCloseTo(Math.sqrt(2 * 110 * 6), 1)
  })

  it('вся зона 2..6px идёт ходом > 15 px/с, прибытие — точное, последний шаг <= 0.5px', () => {
    const h = buildHarness({})
    const p = mkApproachingPerson(8, 40)
    h.aiAgents.value = [p as any]

    let lastPos = centerOf(p).y
    let landed = false
    let lastStep = Infinity
    for (let i = 0; i < 40 && !landed; i++) {
      h.physics.updateAiMovement(0.02, { carGateId: '', personGateId: 'wicket-1' })
      const c = centerOf(p)
      const dist = Math.hypot(c.x - STOP.x, c.y - STOP.y)
      if (p.state === 'to_gate' && dist > 1.5 && dist < 6.5) {
        // зона старого «замирания»: скорость остаётся ходовой
        expect(p.element.velocity).toBeGreaterThan(15)
      }
      if (p.state !== 'to_gate') {
        landed = true
        lastStep = Math.abs(lastPos - c.y)
      }
      lastPos = c.y
    }

    expect(landed).toBe(true)
    expect(p.state).toBe('waiting_before')
    expect(p.element.velocity).toBe(0)
    // точная посадка в центр цели
    expect(centerOf(p).x).toBeCloseTo(STOP.x, 6)
    expect(centerOf(p).y).toBeCloseTo(STOP.y, 6)
    // финальный шаг — доли пикселя: перескока «на несколько миллиметров» нет
    expect(lastStep).toBeLessThan(0.5)
  })

  it('подход с 60px завершается посадкой без застревания (регресс очереди)', () => {
    const h = buildHarness({})
    const p = mkApproachingPerson(60, 0)
    h.aiAgents.value = [p as any]

    for (let i = 0; i < 120 && p.state === 'to_gate'; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }
    expect(p.state).toBe('waiting_before')
    expect(centerOf(p).y).toBeCloseTo(STOP.y, 6)
  })

  it('ползунок pArriveDecel действует на ходу: 30 px/с² — заметно мягче 110', () => {
    const TARGETS = [
      { h: buildHarness({}), name: 'default' },
      { h: buildHarness({ pArriveDecel: 30 }), name: 'soft' },
    ]
    const vels: number[] = []
    for (const t of TARGETS) {
      const p = mkApproachingPerson(6, 40)
      t.h.aiAgents.value = [p as any]
      // три тика при обычном DECEL: скорость успевает сойтись к капу кривой
      for (let i = 0; i < 3; i++) {
        t.h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      }
      vels.push(p.element.velocity)
    }
    // √(2·30·d) заметно ниже √(2·110·d) на том же остатке пути
    expect(vels[1]).toBeLessThan(vels[0] - 3)
    expect(vels[1]).toBeLessThan(24)
  })
})

describe('реестр: pArriveDecel [№32-B]', () => {
  it('поле в группе «Плавность хода», дефолт 110, кламп по диапазону', () => {
    const f = PERSON_TUNING_FIELDS.find(x => x.key === 'pArriveDecel')
    expect(f).toBeDefined()
    expect(f!.group).toBe('Плавность хода')
    expect(f!.def).toBe(110)
    expect(f!.min).toBeLessThanOrEqual(110)
    expect(f!.max).toBeGreaterThanOrEqual(110)
    expect(tuneNumber({ pArriveDecel: 9999 }, 'pArriveDecel')).toBe(f!.max)
    expect(tuneNumber({ pArriveDecel: 1 }, 'pArriveDecel')).toBe(f!.min)
    expect(tuneNumber({}, 'pArriveDecel')).toBe(110)
  })
})

// ---------------------------------------------------------------------------
// Машины: профиль торможения у точки НЕ изменился (№27: «машины идеальны»)
// ---------------------------------------------------------------------------

describe('машины: прежний профиль дотягивания у посадки [№32-B-КАР]', () => {
  it('car crossing на дист 6px: кап прежний ~16 px/с (taper 12 -> 8)', () => {
    // DECEL огромный: скорость за тик сходится к капу точно
    const h = buildHarness({}, { DECEL: 100000 })
    const TARGET = { x: GATE_X + GATE_W / 2, y: FENCE_Y + 40 }
    const car = {
      id: 'c1',
      element: {
        // центр машины в 6px НИЖЕ цели посадки
        id: 'c1', x: TARGET.x - 40, y: TARGET.y - 6 - 20,
        width: 80, height: 40,
        rotation: 0, velocity: 40, category: 'vehicle', type: 'actor', direction: 'enter',
        settings: {},
      },
      state: 'crossing',
      target: { x: TARGET.x, y: TARGET.y, width: 0, height: 0 },
      afterTarget: { x: TARGET.x, y: 480, width: 0, height: 0 },
      exitPoint: { x: TARGET.x, y: TARGET.y, width: 0, height: 0 },
      speed: 100, type: 'car', direction: 'enter', travelMode: 'car',
      gateId: 'wicket-1',
    }
    h.aiAgents.value = [car as any]
    h.physics.updateAiMovement(DT, { carGateId: 'wicket-1', personGateId: 'wicket-1' })
    // прежний профиль машины: dist 6 < 12 -> k=0.5 -> 8 + (24-8)·0.5 = 16
    expect(car.element.velocity).toBeCloseTo(16, 0.6)
  })
})
