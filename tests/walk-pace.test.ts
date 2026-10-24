// tests/walk-pace.test.ts
// [П1][№12][№26-ФИКС-ФАЗА] темп шага = скорости ходьбы: фаза-ЗАДЕРЖКА
// CSS-анимации (settings._walkHold, секунды; animation-delay = +hold) растёт
// на dt*(1 - v/cruise), пока человек идёт медленнее крейсерской — рендеримая
// скорость цикла ног = v/cruise: при торможении ноги перебирают РЕЖЕ и
// НИКОГДА не быстрее естественного темпа. Прежняя версия №12 копила
// +dt*v/cruise при ОТРИЦАТЕЛЬНОМ delay (*-1s) — рендеримая скорость была
// 1 + v/cruise (до 2x): ноги «семенили» вдвое быстрее на тормозном подходе
// к точке останова (репорт №26). Машины фазу шага не двигают вовсе.

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

describe('walkHoldStep — математика фазы-задержки ([П1][№12][№26])', () => {
  it('на крейсерской прирост нулевой (естественное воспроизведение)', () => {
    expect(walkHoldStep(0.1, 40, 40)).toBeCloseTo(0, 6)
    expect(walkHoldStep(0.1, 50, 40)).toBeCloseTo(0, 6) // выше крейсерской — клэмп
  })

  it('чем медленнее ход, тем сильнее задержка фазы: ноги = v/cruise', () => {
    // рендеримая скорость цикла = 1 - прирост/dt = v/cruise
    expect(walkHoldStep(0.1, 20, 40)).toBeCloseTo(0.05, 6)  // ноги на 0.5 цикла
    expect(walkHoldStep(0.1, 10, 40)).toBeCloseTo(0.075, 6) // ноги на 0.25 цикла
  })

  it('на месте задержка максимальна (ноги замирают; физика не вызывает при v<=0.05)', () => {
    expect(walkHoldStep(0.1, 0, 40)).toBeCloseTo(0.1, 6)
  })

  it('нулевая крейсерская не даёт деления на ноль (фолбэк на естественный темп)', () => {
    expect(walkHoldStep(0.1, 20, 0)).toBeCloseTo(0, 6)
  })

  it('[№26] задержка НИКОГДА не отрицательна и монотонно убывает по скорости', () => {
    // при любой скорости прирост в [0, dt]; чем быстрее шаг — тем меньше
    // задержка (без разрывов на границе крейсерской: подход к остановке
    // без скачка темпа ног)
    let prev = Infinity
    for (let v = 0; v <= 80; v += 2) {
      const cur = walkHoldStep(0.1, v, 40)
      expect(cur).toBeGreaterThanOrEqual(-1e-9)
      expect(cur).toBeLessThanOrEqual(0.1 + 1e-9)
      expect(cur).toBeLessThanOrEqual(prev + 1e-9)
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
