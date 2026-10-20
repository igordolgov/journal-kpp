// tests/spawn-limit.test.ts
// [ФИКС-ЛИМИТ] Регрессионный тест: «Макс. агентов» ограничивает число
// ОДНОВРЕМЕННЫХ агентов на сцене. Раньше группа из 2-4 человек считалась
// одним агентом, и на сцене оказывалось больше людей, чем разрешено.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import { PERSON_WIDTH, PERSON_HEIGHT, CAR_WIDTH, CAR_HEIGHT } from '~/utils/simulatorConstants'
import type { TrafficConfig } from '~/types/simulator'

const makePeople = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    fio: `Человек ${i + 1}`,
    gender: i % 2 === 0 ? 'male' : 'female',
    location: 'outside',
  }))

const baseCfg = (): TrafficConfig => ({
  enabled: true,
  intervalMin: 1,
  intervalMax: 2,
  personSpeed: 40,
  carSpeed: 100,
  carGateId: '',
  personGateId: '',
  gateCloseDelay: 10,
  wicketCloseDelay: 2,
  maxAgents: 5,
  stepAudibleDistance: 400,
  engineAudibleDistance: 800,
} as TrafficConfig)

describe('лимит одновременных агентов (Макс. агентов)', () => {
  beforeEach(() => {
    // 0.01 < 0.15 => все спавны групповые; groupSize = 2 (детерминизм)
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
  })
  afterEach(() => vi.restoreAllMocks())

  it('не превышает maxAgents, даже когда спавнятся группы', async () => {
    const simElements = ref<any[]>([])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ width: 1280, height: 720 })
    const fixedXPerson = ref(795)
    const fixedYPerson = ref(187)
    const fixedXCar = ref(635)
    const fixedYCar = ref(180)

    const integration = useSimulatorIntegration({ people: makePeople(40) })
    const simOpts = ref({
      maxGroupSize: 4,
      maxNonFamily: 1,
      personWidth: PERSON_WIDTH,
      personHeight: PERSON_HEIGHT,
      carWidth: CAR_WIDTH,
      carHeight: CAR_HEIGHT,
      carSpawnIntervalMin: 999, // машины не спавнятся — проверяем людей
      carSpawnIntervalMax: 1000,
      autoJournal: false,
    })

    const spawn = useSimulatorSpawn(
      simElements, aiAgents, sceneSize,
      fixedXPerson, fixedYPerson, fixedXCar, fixedYCar,
      integration, simOpts
    )

    const cfg = baseCfg()
    const MAX = 5
    let frames = 0
    // 60 кадров по 1с: таймеры спавна сработают многократно
    for (; frames < 60; frames++) {
      spawn.updateSpawnLogic(1, cfg, true, MAX)
      // агенты добавляются через nextTick — вытягиваем их
      await Promise.resolve()
      await new Promise(r => setTimeout(r, 0))
      const active = aiAgents.value.filter(a => a.state !== 'done').length
      expect(active).toBeLessThanOrEqual(MAX)
    }
    // за 60с лимит точно должен быть достигнут
    const finalActive = aiAgents.value.filter(a => a.state !== 'done').length
    expect(finalActive).toBe(MAX)
  })
})
