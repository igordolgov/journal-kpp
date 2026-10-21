// tests/car-accel-cap.test.ts
// [П2] машина трогается мягче: потолок разгона 60 px/с² (в жизни легковушка
// набирает ход за ~1с). ACCEL из настроек остаётся общим регулятором, но для
// машин не поднимается выше 60; люди разгоняются по-прежнему ACCEL/2.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }

const buildPhysics = (opts: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    ...opts,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    () => true, () => true, () => {}, simOpts, undefined, undefined,
  )
  return { aiAgents, physics }
}

const mkCar = (id: string, cx: number, cy: number, speed: number) => ({
  id,
  element: {
    id, x: cx - 40, y: cy - 20, width: 80, height: 40,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction: 'enter',
    settings: { _facingLeft: true },
  },
  state: 'to_gate',
  target: { x: 400, y: cy, width: 0, height: 0 },
  afterTarget: { x: 400, y: 900, width: 0, height: 0 },
  exitPoint: { x: 400, y: cy, width: 0, height: 0 },
  speed, type: 'car', direction: 'enter', travelMode: 'car',
  gateId: '',
})

const mkPerson = (id: string, cx: number, cy: number, speed: number) => ({
  id,
  element: {
    id, x: cx - 20, y: cy - 27.5, width: 40, height: 55,
    rotation: 0, velocity: 0, category: 'human', type: 'actor', direction: 'enter',
  },
  state: 'to_gate',
  target: { x: 400, y: cy, width: 0, height: 0 },
  afterTarget: { x: 400, y: 20, width: 0, height: 0 },
  exitPoint: { x: 400, y: cy, width: 0, height: 0 },
  speed, type: 'person', direction: 'enter', travelMode: 'walk',
  gateId: '',
})

describe('потолок разгона машин 60 px/с² ([П2])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('машина с ACCEL=100 в настройках разгоняется не быстрее 60 px/с²', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const car = mkCar('car-1', 1000, 200, 100) as any
    h.aiAgents.value = [car]
    for (let i = 0; i < 5; i++) { // 0.5с разгона
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    // 60 px/с² * 0.5с = 30 px/с (+допуск на квантование кадра)
    expect(car.element.velocity).toBeLessThanOrEqual(31)
    expect(car.element.velocity).toBeGreaterThanOrEqual(25)
  })

  it('даже большой ACCEL в настройках не поднимает разгон машины выше 60', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics({ ACCEL: 300 })
    const car = mkCar('car-1', 1000, 200, 100) as any
    h.aiAgents.value = [car]
    for (let i = 0; i < 5; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    expect(car.element.velocity).toBeLessThanOrEqual(31)
  })

  it('люди разгоняются по-прежнему ACCEL/2 (потолок машин их не касается)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = buildPhysics()
    const person = mkPerson('p-1', 1000, 400, 40) as any
    h.aiAgents.value = [person]
    for (let i = 0; i < 3; i++) { // 0.3с
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    // 50 px/с² * 0.3с = 15 px/с (потолок машин 60 не применяется)
    expect(person.element.velocity).toBeGreaterThanOrEqual(14)
    expect(person.element.velocity).toBeLessThanOrEqual(16)
  })
})
