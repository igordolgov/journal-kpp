// tests/walk-pace.test.ts
// [П1][№12] темп шага = скорости ходьбы: фаза CSS-анимации (settings._walkHold,
// секунды) растёт пропорционально пройденному пути — при торможении ноги
// перебирают РЕЖЕ и НИКОГДА не быстрее естественного темпа. Прежняя версия
// копила «паузу» dt*(1 - v/cruise): фаза убегала вперёд, до 2x при остановке —
// «ускорение ног при торможении» (баг-репорт №12), устранено. Машины фазу
// шага не двигают вовсе.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { walkHoldStep } from '~/utils/simTuning'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }

const buildPhysics = () => {
  const simElements = ref<any[]>([])
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

const mkPerson = (id: string, state: string, cx: number, cy: number, target: { x: number; y: number }, after: { x: number; y: number }) => ({
  id,
  element: {
    id, x: cx - 20, y: cy - 27.5, width: 40, height: 55,
    rotation: 0, velocity: 0, category: 'human', type: 'actor', direction: 'enter',
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
  gateId: '',
})

const mkCar = (id: string, state: string, cx: number, cy: number, target: { x: number; y: number }) => ({
  id,
  element: {
    id, x: cx - 40, y: cy - 20, width: 80, height: 40,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction: 'enter',
    settings: {},
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: target.x, y: 900, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction: 'enter', travelMode: 'car',
  gateId: '',
})

describe('walkHoldStep — математика фазы шага ([П1][№12])', () => {
  it('на крейсерской прирост равен кадру (естественное воспроизведение)', () => {
    expect(walkHoldStep(0.1, 40, 40)).toBeCloseTo(0.1, 6)
    expect(walkHoldStep(0.1, 50, 40)).toBeCloseTo(0.1, 6) // выше крейсерской — клэмп
  })

  it('чем медленнее ход, тем реже шаг: прирост пропорционален скорости', () => {
    expect(walkHoldStep(0.1, 20, 40)).toBeCloseTo(0.05, 6)
    expect(walkHoldStep(0.1, 10, 40)).toBeCloseTo(0.025, 6)
  })

  it('на месте фаза не растёт (анимацию ставит на паузу is-paused)', () => {
    expect(walkHoldStep(0.1, 0, 40)).toBe(0)
  })

  it('нулевая крейсерская не даёт деления на ноль (фолбэк на естественный темп)', () => {
    expect(walkHoldStep(0.1, 20, 0)).toBeCloseTo(0.1, 6)
  })

  it('[№12] ноги НИКОГДА не быстрее естественного темпа — регрессия «ускорения при торможении»', () => {
    // при любой скорости прирост за кадр не превышает длительность кадра,
    // а при замедлении (торможение) темп только падает — монотонность по v
    for (let v = 0; v <= 80; v += 2) {
      expect(walkHoldStep(0.1, v, 40)).toBeLessThanOrEqual(0.1 + 1e-9)
    }
    let prev = -1
    for (let v = 0; v <= 80; v += 2) {
      const cur = walkHoldStep(0.1, v, 40)
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = cur
    }
  })
})

describe('интеграция: фаза шага у агентов ([П1][№12])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('человек на дотягивании (тормозной участок) наращивает фазу, машина — нет', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    // человек идёт к остановке: последние 80 px — тормозной участок
    // (скорость ниже крейсерской) — фаза обязана нарастать
    const person = mkPerson('p-1', 'to_gate', 1000, 400, { x: 800, y: 400 }, { x: 800, y: 20 })
    h.aiAgents.value = [person as any]
    let landed = false
    for (let i = 0; i < 300 && !landed; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
      if (person.state === 'waiting_before') landed = true
    }
    expect(landed).toBe(true)
    const hold = (person.element.settings as any)?._walkHold ?? 0
    expect(hold).toBeGreaterThan(0.05)

    // машина тот же путь — фазу шага не двигает вовсе
    const car = mkCar('car-1', 'to_gate', 1000, 400, { x: 800, y: 400 })
    h.aiAgents.value = [car as any]
    let carLanded = false
    for (let i = 0; i < 300 && !carLanded; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
      if (car.state === 'waiting_before') carLanded = true
    }
    expect(carLanded).toBe(true)
    expect((car.element.settings as any)?._walkHold ?? 0).toBe(0)
  })

  it('на крейсерской фаза НЕ растёт (пишется только на ходе ниже крейсерской)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const person = mkPerson('p-2', 'to_gate', 100, 400, { x: 1000, y: 400 }, { x: 1000, y: 20 })
    h.aiAgents.value = [person as any]
    for (let i = 0; i < 20; i++) { // 2с: разгон (0.8с) + выход на крейсерскую
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    expect(person.element.velocity || 0).toBeGreaterThanOrEqual(40) // крейсерская
    const holdAt2s = (person.element.settings as any)?._walkHold ?? 0
    // вклад разгона: 0.8с набора скорости даёт фазу ~0.4 (интеграл v/cruise)
    expect(holdAt2s).toBeLessThan(0.45)
    for (let i = 0; i < 10; i++) { // ещё 1с чистой крейсерской
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    const holdAt3s = (person.element.settings as any)?._walkHold ?? 0
    // на крейсерской фаза заморожена — естественное воспроизведение
    expect(holdAt3s - holdAt2s).toBeCloseTo(0, 6)
  })
})
