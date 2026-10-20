// tests/pause-hysteresis.test.ts
// [ФИКС-ДЁРГАНИЕ] регрессии «подёргивания людей при проходе через калитку»:
// класс is-paused (пауза CSS-анимаций рук/ног/корпуса) вычислялся в шаблоне
// как velocity < 0.1 без гистерезиса. Контроллер «стой/иди» в очереди у
// прохода гоняет скорость через порог 0.1 — класс мигает несколько раз в
// секунду, анимации замирают/возобновляются посреди цикла. Теперь флагом
// управляет физика: пауза < 0.1, возобновление > 1.5, в полосе между
// порогами флаг держит прежнее значение.

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const DT = 0.1

const buildPhysics = (simOpts: any = {}) => {
  const wicket = {
    id: 'w1', x: 600, y: 100, width: 50, height: 120,
    rotation: 0, velocity: 0, category: 'gate', type: 'gate',
    name: 'Калитка', zIndex: 300,
    settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
  }
  const simElements = ref<any[]>([wicket])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const opts = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 0, stallEscalateTime: 10,
    ...simOpts,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {}, opts, undefined, undefined
  )
  return { simElements, aiAgents, sceneSize, physics }
}

const makePerson = (over: Partial<any> = {}) => ({
  id: 'p1',
  element: {
    id: 'p1', x: 590, y: 300, width: 22, height: 42,
    rotation: 0, velocity: 0, zIndex: 200,
    asset: { type: 'person' }, direction: 'enter',
  },
  state: 'to_gate',
  target: { x: 590, y: 80, width: 0, height: 0 },
  afterTarget: { x: 590, y: 500, width: 0, height: 0 },
  speed: 60, type: 'person', direction: 'enter', travelMode: 'walk',
  ...over,
})

const CFG = { carGateId: 'car-gate', personGateId: 'w1' }

describe('[ФИКС-ДЁРГАНИЕ] is-paused с гистерезисом', () => {
  it('стоящий агент (waiting_before) получает isPaused=true', () => {
    const { aiAgents, physics } = buildPhysics()
    const person = makePerson({ state: 'waiting_before' })
    aiAgents.value = [person]
    for (let i = 0; i < 3; i++) physics.updateAiMovement(DT, CFG)
    expect(person.element.velocity).toBeLessThan(0.1)
    expect(person.element.isPaused).toBe(true)
  })

  it('разогнавшийся агент снимает паузу (isPaused=false)', () => {
    const { aiAgents, physics } = buildPhysics()
    const person = makePerson({ state: 'to_gate' })
    person.element.y = 600
    person.target = { x: 590, y: 80, width: 0, height: 0 }
    aiAgents.value = [person]
    for (let i = 0; i < 3; i++) physics.updateAiMovement(DT, CFG)
    expect(person.element.velocity).toBeGreaterThan(1.5)
    expect(person.element.isPaused).toBe(false)
  })

  it('в полосе гистерезиса (0.1..1.5) флаг не мигает — держит прежнее значение', () => {
    // Медленный разгон: ACCEL=5 => за кадр +0.5 px/s: 0.5 -> 1.0 -> 1.5 -> 2.0
    // Флаг читается в НАЧАЛЕ кадра, поэтому граница > 1.5 снимает паузу
    // только на кадре, когда сверху пришла скорость 2.0.
    const { aiAgents, physics } = buildPhysics({ ACCEL: 5, DECEL: 2 })
    const person = makePerson({ state: 'to_gate' })
    person.element.y = 600
    person.target = { x: 590, y: 80, width: 0, height: 0 }
    person.element.velocity = 0.5
    person.element.isPaused = true
    aiAgents.value = [person]
    physics.updateAiMovement(DT, CFG) // флаг(0.5): полоса -> держится; v := 1.0
    expect(person.element.velocity).toBeCloseTo(1.0, 5)
    expect(person.element.isPaused).toBe(true)
    physics.updateAiMovement(DT, CFG) // флаг(1.0): полоса -> держится; v := 1.5
    expect(person.element.velocity).toBeCloseTo(1.5, 5)
    expect(person.element.isPaused).toBe(true)
    physics.updateAiMovement(DT, CFG) // флаг(1.5): строгое > -> держится; v := 2.0
    expect(person.element.velocity).toBeCloseTo(2.0, 5)
    expect(person.element.isPaused).toBe(true)
    physics.updateAiMovement(DT, CFG) // флаг(2.0): выше 1.5 -> пауза снята
    expect(person.element.isPaused).toBe(false)
  })
})
