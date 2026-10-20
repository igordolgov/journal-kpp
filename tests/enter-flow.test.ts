// tests/enter-flow.test.ts
// ДИАГНОСТИКА: поток ВХОДЯЩИХ людей через калитку — все обязаны деспавниться.
// Регрессия: поток входящих (одиночки/группа/встречные) полностью проходит калитку.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { useSimulatorCore } from '~/composables/simulator/useSimulatorCore'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'
import type { TrafficConfig } from '~/types/simulator'

const DT = 0.05

const makeWicket = () => ({
  id: 'wicket-1',
  x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Калитка',
  zIndex: 300,
  settings: {
    gateType: 'wicket',
    isOpen: true,
    isAnimating: false,
    openDuration: 0.5,
    closeDuration: 0.5,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

const makePerson = (id: number, loc: string) => ({
  id, fio: `Человек ${id}`, gender: 'male', location: loc,
})

const buildScene = (people: any[]) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const fixedXPerson = ref(795)
  const fixedYPerson = ref(187)
  const fixedXCar = ref(635)
  const fixedYCar = ref(180)

  const integration = useSimulatorIntegration({ people })
  const simOpts: any = {
    maxGroupSize: 4,
    maxNonFamily: 1,
    personWidth: PERSON_WIDTH,
    personHeight: PERSON_HEIGHT,
    carWidth: 80,
    carHeight: 40,
    carSpawnIntervalMin: 999,
    carSpawnIntervalMax: 1000,
    autoJournal: false,
    ACCEL: 100,
    DECEL: 100,
    REACTION_TIME: 1.5,
    MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220,
    ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10,
    wicketCloseDelay: 2,
    stallEscalateTime: 10,
  }

  const core = useSimulatorCore(simElements as any)
  const spawn = useSimulatorSpawn(
    simElements as any, aiAgents, sceneSize,
    fixedXPerson, fixedYPerson, fixedXCar, fixedYCar,
    integration, ref(simOpts) as any
  )
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (gate: any) => { gate.settings.isOpen = true; return true },
    (gate: any) => { gate.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined
  )

  const cfg = {
    enabled: true,
    intervalMin: 1,
    intervalMax: 2,
    personSpeed: 40,
    carSpeed: 100,
    carGateId: '',
    personGateId: 'wicket-1',
    gateCloseDelay: 10,
    wicketCloseDelay: 2,
    maxAgents: 6,
  } as unknown as TrafficConfig

  const flush = async () => {
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
  }

  return { simElements, aiAgents, spawn, physics, core, cfg, flush }
}

const diag = (aiAgents: any[]) => aiAgents.map((a: any) => ({
  id: a.id, state: a.state,
  pos: [Math.round(a.element.x), Math.round(a.element.y)],
  tgt: [Math.round(a.target?.x ?? NaN), Math.round(a.target?.y ?? NaN)],
  after: [Math.round(a.afterTarget?.x ?? NaN), Math.round(a.afterTarget?.y ?? NaN)],
  v: Math.round(a.element.velocity || 0), speed: a.speed,
}))

describe('диагностика: входящие люди не зависают', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // 0.5: одиночки, интервал 1.5с
  })
  afterEach(() => vi.restoreAllMocks())

  it('поток входящих: каждый деспавнится, никто не вечно на сцене', async () => {
    const people = Array.from({ length: 10 }, (_, i) => makePerson(i + 1, 'outside'))
    const s = buildScene(people)

    // 40 тактов спавна по 1с + физика между тактами (20 кадров = 1с)
    for (let tick = 0; tick < 40; tick++) {
      s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
      await s.flush()
      for (let f = 0; f < 20; f++) {
        s.core.updateGateWatchdog(DT)
        s.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      }
    }
    await s.flush()

    // хвост: 120с чистой физики — все обязаны уйти
    for (let f = 0; f < 2400; f++) {
      s.core.updateGateWatchdog(DT)
      s.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }

    expect(diag(s.aiAgents.value)).toEqual([])
    expect(s.aiAgents.value.length).toBe(0)
  })

  it('входящая группа из 3 человек полностью проходит и деспавнится', async () => {
    vi.restoreAllMocks()
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.01) // группы
    const people = Array.from({ length: 5 }, (_, i) => makePerson(i + 1, 'outside'))
    const s = buildScene(people)

    for (let i = 0; i < 20; i++) s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await s.flush()
    expect(s.aiAgents.value.length).toBeGreaterThanOrEqual(2)

    for (let f = 0; f < 3600; f++) { // 180с
      s.core.updateGateWatchdog(DT)
      s.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }
    await s.flush()

    expect(diag(s.aiAgents.value)).toEqual([])
    rnd.mockRestore()
  })

  it('встречные одиночки (вход + выход) при открытой калитке — оба проходят', async () => {
    const people = [
      makePerson(1, 'outside'),
      makePerson(2, 'inside'),
    ]
    const s = buildScene(people)

    for (let i = 0; i < 20; i++) s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await s.flush()
    expect(s.aiAgents.value.length).toBe(2)

    for (let f = 0; f < 3600; f++) { // 180с
      s.core.updateGateWatchdog(DT)
      s.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }
    await s.flush()

    expect(diag(s.aiAgents.value)).toEqual([])
  })
})
