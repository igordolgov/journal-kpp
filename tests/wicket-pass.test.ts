// tests/wicket-pass.test.ts
// [ФИКС-ЗАСТРЯНИЕ] Регрессионные тесты прохода через калитку:
//  1) выходящий пешеход проходит через ОТКРЫТУЮ калитку и деспавнится;
//  2) зависший isAnimating лечится сторожем ворот, агент проходит;
//  3) зависшая цепочка группы принудительно продолжается (12с).

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
    isOpen: false,
    isAnimating: false,
    openDuration: 0.5,
    closeDuration: 0.5,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

const makePerson = (id: number) => ({
  id, fio: `Выходящий ${id}`, gender: 'male', location: 'inside',
})

interface Scene {
  simElements: ReturnType<typeof ref>
  aiAgents: ReturnType<typeof ref>
  spawn: ReturnType<typeof useSimulatorSpawn>
  physics: ReturnType<typeof useSimulatorPhysics>
  core: ReturnType<typeof useSimulatorCore>
  cfg: TrafficConfig
  simOpts: any
}

const buildScene = (people: any[]): Scene => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const fixedXPerson = ref(795)
  const fixedYPerson = ref(187)
  const fixedXCar = ref(635)
  const fixedYCar = ref(180)

  const integration = useSimulatorIntegration({ people })
  const simOpts = {
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
    wicketCloseDelay: 0,
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
    wicketCloseDelay: 0,
    maxAgents: 6,
  } as TrafficConfig

  return { simElements, aiAgents, spawn, physics, core, cfg, simOpts }
}

const runFrames = (scene: Scene, seconds: number, withWatchdog = false) => {
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    if (withWatchdog) scene.core.updateGateWatchdog(DT)
    scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
  }
}

describe('проход через калитку (выходящие люди)', () => {
  beforeEach(() => {
    // 0.5: группы не образуются (>= 0.15), пассажиров в машины не берём
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => vi.restoreAllMocks())

  const spawnExitPerson = async (scene: Scene) => {
    // первый пешеход exit спавнится через nextSpawnPersonExit = 14с
    for (let i = 0; i < 20; i++) {
      scene.spawn.updateSpawnLogic(1, scene.cfg, true, 6)
    }
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(scene.aiAgents.value.length).toBe(1)
    const agent = scene.aiAgents.value[0]
    expect(agent.direction).toBe('exit')
    return agent
  }

  it('выходящий проходит открытую калитку и деспавнится', async () => {
    const scene = buildScene([makePerson(1)])
    const agent = await spawnExitPerson(scene)

    // доходим до калитки (спавн ниже сцены, стоп ~78px ниже калитки)
    runFrames(scene, 30)
    expect(agent.state).toBe('waiting_before')

    // охранник открывает калитку
    const wicket = scene.simElements.value[0]
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = false

    runFrames(scene, 30)
    expect(agent.state).toBe('done')
    expect(scene.aiAgents.value.length).toBe(0)
  })

  it('зависший isAnimating лечится сторожем — агент проходит', async () => {
    const scene = buildScene([makePerson(1)])
    const agent = await spawnExitPerson(scene)
    runFrames(scene, 30)
    expect(agent.state).toBe('waiting_before')

    const wicket = scene.simElements.value[0]
    // аномалия: флаг «анимация идёт», хотя твин убит (в реестре его нет)
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = true

    // без сторожа агент не должен начать проход (регрессия старого поведения)
    runFrames(scene, 5)
    expect(agent.state).toBe('waiting_before')

    // со сторожем флаг лечится и агент проходит
    runFrames(scene, 30, true)
    expect(agent.state).toBe('done')
  })

  it('зависший isAnimating=false при визуально открытой калитке синхронизируется', async () => {
    const scene = buildScene([makePerson(1)])
    const agent = await spawnExitPerson(scene)
    runFrames(scene, 30)
    expect(agent.state).toBe('waiting_before')

    const wicket = scene.simElements.value[0]
    // аномалия: калитка визуально открыта (scale 0.1), но флаг isOpen=false
    wicket.settings.isOpen = false
    wicket.settings.isAnimating = false
    wicket.settings._animScaleX = 0.1

    runFrames(scene, 30, true)
    expect(wicket.settings.isOpen).toBe(true)
    expect(agent.state).toBe('done')
  })
  it('зависшая группа у открытой калитки продолжается принудительно', async () => {
    // 0.01 < 0.15 => спавн групповой; groupSize = 2 (детерминизм)
    ;(Math.random as any).mockRestore?.()
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.01)

    const scene = buildScene([makePerson(1), makePerson(2)])
    // первый exit-спавн через nextSpawnPersonExit = 14с
    for (let i = 0; i < 20; i++) scene.spawn.updateSpawnLogic(1, scene.cfg, true, 6)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(scene.aiAgents.value.length).toBe(2)

    const leader = scene.aiAgents.value.find((a: any) => a.isLeader)!
    const member = scene.aiAgents.value.find((a: any) => !a.isLeader)!
    expect(leader).toBeTruthy()
    expect(member).toBeTruthy()

    runFrames(scene, 30)
    expect(leader.state).toBe('waiting_before')
    expect(member.state).toBe('waiting_before')

    const wicket = scene.simElements.value[0]
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = false

    // лидер «завис» в crossing: цель далеко, скорость 0 — не прибывает
    const started = new Set<string>()
    // ждём, пока лидер начнёт проход, затем замораживаем его
    for (let i = 0; i < 200; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (leader.state === 'crossing') break
    }
    leader.state = 'crossing'
    leader.speed = 0
    leader.target = { x: leader.element.x + 500, y: leader.element.y, width: 0, height: 0 }

    // член группы ждёт лидера; через FORCE_CROSS_GROUP_AFTER (12с) проходит принудительно
    runFrames(scene, 40)
    expect(member.state).toBe('done')
    rnd.mockRestore()
  })

})
