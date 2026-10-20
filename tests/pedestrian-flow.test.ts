// tests/pedestrian-flow.test.ts
// [ФИКС-РЫВОК / ФИКС-СКВОЗЬ / ФИКС-НОГИ-НИЖЕ-КАЛИТКИ]
// Регрессионные тесты доводки потока пешеходов:
//  1) на стыке crossing -> moving_away скорость пешехода НЕ обнуляется
//     (обнуление ставило анимацию ходьбы на паузу — видимый «дёрганчик»
//     в точке останова после калитки);
//  2) посадка в цель точная, без перескока (шаг кадра не длиннее остатка);
//  3) встречные пешеходы на одной линии расходятся в стороны (мягкое
//     «уступи дорогу»), а не проходят сквозь друг друга;
//  4) приходящие из города подходят к калитке с уровнем ног не ниже
//     нижней линии калитки (клэмп Y линии подхода).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
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
  id, fio: `Проходящий ${id}`, gender: 'male', location: 'inside',
})

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

const buildScene = (people: any[]) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const fixedXPerson = ref(795)
  const fixedYPerson = ref(187)
  const fixedXCar = ref(635)
  const fixedYCar = ref(180)

  const integration = useSimulatorIntegration({ people })

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
  return { simElements, aiAgents, spawn, physics, sceneSize }
}

const spawnEnterPerson = async (scene: ReturnType<typeof buildScene>) => {
  // первый пешеход enter спавнится через nextSpawnTimePersonEnter = 10с
  for (let i = 0; i < 12; i++) scene.spawn.updateSpawnLogic(1, cfg, true, 6)
  await nextTick()
  await new Promise(r => setTimeout(r, 0))
  return scene.aiAgents.value.find((a: any) => a.direction === 'enter')
}

describe('доводка потока пешеходов', () => {
  beforeEach(() => {
    // 0.5: группы не образуются (>= 0.15), машины без пассажиров
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => vi.restoreAllMocks())

  it('стык crossing -> moving_away: скорость пешехода не обнуляется (нет рывка)', async () => {
    const scene = buildScene([makePerson(1)])
    // выходящий спавнится через 14с
    for (let i = 0; i < 20; i++) scene.spawn.updateSpawnLogic(1, cfg, true, 6)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    const agent = scene.aiAgents.value[0]
    expect(agent.direction).toBe('exit')

    // доходим до калитки и открываем её
    for (let i = 0; i < 600; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (agent.state === 'waiting_before') break
    }
    expect(agent.state).toBe('waiting_before')
    const wicket = scene.simElements.value[0]
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = false

    // ловим кадр перехода crossing -> moving_away
    let velocityAtFlip = -1
    for (let i = 0; i < 600; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (agent.state !== 'crossing' && velocityAtFlip >= 0) break
      if (agent.state === 'crossing') velocityAtFlip = agent.element.velocity
      if (agent.state === 'moving_away') break
    }
    // [ФИКС-РЫВОК] скорость в момент перехода >= нижнего порога торможения (12):
    // раньше здесь стоял el.velocity = 0 — анимация ходьбы замерла на 1-2 кадра
    expect(velocityAtFlip).toBeGreaterThanOrEqual(11.5)
  })

  it('посадка в точку останова точная: позиция совпадает с exitPoint', async () => {
    const scene = buildScene([makePerson(1)])
    for (let i = 0; i < 20; i++) scene.spawn.updateSpawnLogic(1, cfg, true, 6)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    const agent = scene.aiAgents.value[0]

    for (let i = 0; i < 600; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (agent.state === 'waiting_before') break
    }
    const wicket = scene.simElements.value[0]
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = false

    for (let i = 0; i < 600; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      if (agent.state === 'moving_away') break
    }
    expect(agent.state).toBe('moving_away')
    const el = agent.element
    // [СХЕМА-ТРАЕКТОРИЙ] точная посадка в выведенную точку выхода:
    // калитка (760,100,80,120) -> crossExit: ноги на 26px выше её верха
    // (feet = 100 - 26 = 74 -> y = 74 - 55 + 2 = 21), X — центр калитки (800)
    expect(Math.abs(el.x + el.width / 2 - 800)).toBeLessThan(0.02)
    expect(Math.abs(el.y + el.height / 2 - (21 + PERSON_HEIGHT / 2))).toBeLessThan(0.02)
  })

  it('встречные на одной линии расходятся в стороны, а не проходят сквозь', () => {
    const scene = buildScene([])
    scene.simElements.value = []
    const mk = (id: string, x: number, dirX: number, direction: 'enter' | 'exit') => ({
      id, element: {
        id, x: x - PERSON_WIDTH / 2, y: 200 - PERSON_HEIGHT / 2,
        width: PERSON_WIDTH, height: PERSON_HEIGHT, rotation: 0, velocity: 40,
        category: 'human', type: 'actor', direction,
      },
      state: 'moving_away',
      target: { x: x + dirX * 900, y: 200, width: 0, height: 0 },
      afterTarget: { x: x + dirX * 900, y: 200, width: 0, height: 0 },
      exitPoint: { x: x, y: 200, width: 0, height: 0 },
      speed: 40, type: 'person', direction, travelMode: 'walk',
    })
    // A идёт вправо, B навстречу влево — ровно по одной линии y=200
    scene.aiAgents.value = [mk('a', 400, 1, 'enter'), mk('b', 600, -1, 'exit')]

    let minDist = Infinity
    let crossed = false
    for (let i = 0; i < 800; i++) {
      scene.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      const [a, b] = scene.aiAgents.value
      if (!a || !b) break
      const ax = a.element.x + a.element.width / 2
      const bx = b.element.x + b.element.width / 2
      const ay = a.element.y + a.element.height / 2
      const by = b.element.y + b.element.height / 2
      if (ax > bx) crossed = true
      minDist = Math.min(minDist, Math.hypot(ax - bx, ay - by))
      if (crossed && minDist < Infinity && i > 100) break
    }
    expect(crossed).toBe(true)
    // [ФИКС-УСТУПИ-ДОРОГУ] без расхождения центры сближались до ~0-5px
    // (проход насквозь); теперь боковая составляющая разводит их в стороны
    expect(minDist).toBeGreaterThan(20)
  })

  it('приходящий спавнится за верхним краем и подходит ногами к верхней линии калитки', async () => {
    // для направления enter нужен человек «В городе» (isOutsideLocation)
    const scene = buildScene([makePerson(1), { id: 2, fio: 'Городской 2', gender: 'male', location: 'В городе' }])
    const agent = await spawnEnterPerson(scene)
    expect(agent).toBeTruthy()
    expect(agent.direction).toBe('enter')

    const wicket = scene.simElements.value[0]
    const gateTop = wicket.y // 100
    const gateBottom = wicket.y + wicket.height // 220
    const el = agent.element
    // [СХЕМА-ТРАЕКТОРИЙ] спавн — за ВЕРХНИМ краем сцены (выходит сверху вниз)
    expect(el.y + PERSON_HEIGHT).toBeLessThanOrEqual(0)
    // стоп-точка (ЦЕНТР агента): визуальные ноги чуть выше верхней линии
    // калитки (centerY + h/2 - pad2 = gateTop - 10), и не ниже низа калитки
    expect(agent.target.y + PERSON_HEIGHT / 2 - 2).toBeCloseTo(gateTop - 10, 0)
    expect(agent.target.y + PERSON_HEIGHT / 2).toBeLessThanOrEqual(gateBottom + 0.01)
    // X выровнен по центру калитки (760 + 80/2 = 800)
    expect(agent.target.x).toBeCloseTo(800, 5)
  })
})
