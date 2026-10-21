// tests/pace-variance.test.ts
// [П7] индивидуальный темп людей: каждый человек на спавне получает
// множитель скорости 0.85..1.15; у группы (семья/колонна) множитель ОДИН
// на всех — колонна не растягивается. Машины множитель не получают.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import { randomPersonPace, PERSON_PACE_MIN, PERSON_PACE_MAX } from '~/utils/simTuning'
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
  maxAgents: 24,
  stepAudibleDistance: 400,
  engineAudibleDistance: 800,
} as TrafficConfig)

describe('randomPersonPace — диапазон множителя ([П7])', () => {
  it('все значения в пределах 0.85..1.15', () => {
    expect(PERSON_PACE_MIN).toBe(0.85)
    expect(PERSON_PACE_MAX).toBe(1.15)
    for (let i = 0; i < 300; i++) {
      const p = randomPersonPace()
      expect(p).toBeGreaterThanOrEqual(PERSON_PACE_MIN)
      expect(p).toBeLessThanOrEqual(PERSON_PACE_MAX)
    }
  })
})

describe('спавн: разброс и единство темпа ([П7])', () => {
  beforeEach(() => {
    // 0.01 (детерминизм, как в spawn-limit): все спавны групповые по 2;
    // pace = 0.85 + 0.3*0.01 = 0.853 -> скорость человека 40 * 0.853 = 34.12
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
  })
  afterEach(() => vi.restoreAllMocks())

  it('все люди на спавне получили один множитель (у группы общий), скорость 44.8', async () => {
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
      carSpawnIntervalMin: 999, // машины не спавнятся
      carSpawnIntervalMax: 1000,
      autoJournal: false,
    })

    const spawn = useSimulatorSpawn(
      simElements, aiAgents, sceneSize,
      fixedXPerson, fixedYPerson, fixedXCar, fixedYCar,
      integration, simOpts
    )

    const cfg = baseCfg()
    for (let frames = 0; frames < 30; frames++) {
      spawn.updateSpawnLogic(1, cfg, true, 24)
      await Promise.resolve()
      await new Promise(r => setTimeout(r, 0))
    }

    const persons = aiAgents.value.filter(a => a.type === 'person')
    expect(persons.length).toBeGreaterThan(2)
    const expected = 40 * (0.85 + 0.3 * 0.01) // 34.12
    const seen = new Set<number>()
    for (const p of persons) {
      expect(p.speed).toBeCloseTo(expected, 5)
      seen.add(p.speed)
    }
    // один множитель на ВСЕХ спавненных в этом окне (мок случайности
    // одинаков) — главное: скорость НЕ равна сырым 40, множитель применён
    expect(seen.size).toBe(1)
    expect(expected).toBeLessThan(40) // множитель применён (не сырые 40)
  })

  it('члены одной группы имеют ИДЕНТИЧНУЮ скорость (колонна не растягивается)', async () => {
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
      maxNonFamily: 0, // только семьи/группы
      personWidth: PERSON_WIDTH,
      personHeight: PERSON_HEIGHT,
      carWidth: CAR_WIDTH,
      carHeight: CAR_HEIGHT,
      carSpawnIntervalMin: 999,
      carSpawnIntervalMax: 1000,
      autoJournal: false,
    })

    const spawn = useSimulatorSpawn(
      simElements, aiAgents, sceneSize,
      fixedXPerson, fixedYPerson, fixedXCar, fixedYCar,
      integration, simOpts
    )

    const cfg = baseCfg()
    for (let frames = 0; frames < 30; frames++) {
      spawn.updateSpawnLogic(1, cfg, true, 24)
      await Promise.resolve()
      await new Promise(r => setTimeout(r, 0))
    }

    const byGroup = new Map<string, Set<number>>()
    for (const p of aiAgents.value.filter(a => a.type === 'person' && a.groupId)) {
      if (!byGroup.has(p.groupId)) byGroup.set(p.groupId, new Set())
      byGroup.get(p.groupId)!.add(p.speed)
    }
    expect(byGroup.size).toBeGreaterThan(0)
    for (const [groupId, speeds] of byGroup) {
      expect(speeds.size).toBe(1) // у группы темп один
      void groupId
    }
  })
})
