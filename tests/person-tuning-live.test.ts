// tests/person-tuning-live.test.ts
// [№28-ЖИВАЯ-ПАНЕЛЬ] настройки людей применяются НА ХОДУ: физика перечитывает
// simOpts.personTuning (и значения, и саму ссылку) в начале каждого тика —
// компактная панель в окне симулятора и карточка «Движение и логика людей»
// в настройках действуют без перезапуска симуляции.
//
// Проверяется:
//  1) правка ЗНАЧЕНИЯ на ходу: pForceCross 30 -> 1 запускает принудительный
//     проход сразу после правки (без пересоздания физики);
//  2) полная ЗАМЕНА объекта personTuning (мерж конфига при загрузке сейва)
//     подхватывается со следующего тика;
//  3) тумблер на ходу: pAccelOn=false после первого тика даёт мгновенный
//     разгон на втором.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.05
const PERSON = { width: PERSON_WIDTH, height: PERSON_HEIGHT }
const SCENE = { width: 1280, height: 720 }

const mkPerson = (id: string, state: string, pos: { x: number; y: number }, target: { x: number; y: number }, direction: 'enter' | 'exit', velocity = 0) => ({
  id,
  element: {
    id, x: pos.x - PERSON.width / 2, y: pos.y - PERSON.height / 2,
    width: PERSON.width, height: PERSON.height,
    rotation: 0, velocity, category: 'human', type: 'actor', direction,
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: target.x, y: target.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 40, type: 'person', direction, travelMode: 'walk',
})

const buildHarness = (tuning: Record<string, unknown>) => {
  const simElements = ref<any[]>([])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    personTuning: tuning,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (gate: any) => { gate.settings.isOpen = true; return true },
    (gate: any) => { gate.settings.isOpen = false; return true },
    () => {},
    simOpts,
  )
  return { simOpts, aiAgents, physics }
}

describe('настройки людей применяются на ходу [№28-ЖИВАЯ-ПАНЕЛЬ]', () => {
  afterEach(() => vi.restoreAllMocks())

  it('правка значения на ходу: pForceCross 30 -> 1 запускает проход сразу', () => {
    const tuning: Record<string, unknown> = { pForceCross: 30, pForceCrossGroup: 30 }
    const h = buildHarness(tuning)
    const p = mkPerson('p1', 'waiting_before', { x: 1000, y: 194.5 }, { x: 1000, y: 194.5 }, 'enter')
    h.aiAgents.value = [p as any]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'missing-gate' })

    // 1.5с с большим порогом — проход не начинается
    for (let i = 0; i < 30; i++) tick()
    expect(h.aiAgents.value[0]?.state).toBe('waiting_before')

    // «пользователь двинул ползунок в панели» — порог 30 -> 3 (мин реестра;
    // в замороженной физике прохода не было бы вовсе: порог 30 > 3.5с ожидания)
    tuning.pForceCross = 3
    let crossedAt: number | null = null
    for (let i = 0; i < 40; i++) {
      tick()
      if (h.aiAgents.value[0]?.state === 'crossing') { crossedAt = i * DT; break }
    }
    expect(crossedAt).not.toBeNull()
    expect(crossedAt!).toBeLessThan(2.0)
  })

  it('полная замена объекта personTuning подхватывается со следующего тика', () => {
    const tuning: Record<string, unknown> = { pForceCross: 30, pForceCrossGroup: 30 }
    const h = buildHarness(tuning)
    const p = mkPerson('p1', 'waiting_before', { x: 1000, y: 194.5 }, { x: 1000, y: 194.5 }, 'enter')
    h.aiAgents.value = [p as any]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'missing-gate' })

    for (let i = 0; i < 30; i++) tick()
    expect(h.aiAgents.value[0]?.state).toBe('waiting_before')

    // мерж конфига при загрузке сейва заменяет объект ЦЕЛИКОМ (3 = мин реестра)
    h.simOpts.personTuning = { pForceCross: 3, pForceCrossGroup: 6 }
    let crossedAt: number | null = null
    for (let i = 0; i < 40; i++) {
      tick()
      if (h.aiAgents.value[0]?.state === 'crossing') { crossedAt = i * DT; break }
    }
    expect(crossedAt).not.toBeNull()
    expect(crossedAt!).toBeLessThan(2.0)
  })

  it('тумблер на ходу: pAccelOn=false — мгновенный разгон со следующего тика', () => {
    const tuning: Record<string, unknown> = {}
    const h = buildHarness(tuning)
    const walker = mkPerson('w', 'moving_away', { x: 1000, y: 300 }, { x: 200, y: 300 }, 'exit')
    h.aiAgents.value = [walker as any]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })

    // рампа разгона (pAccel 110 по умолчанию): за тик всего ~5.5 px/с
    tick()
    expect(walker.element.velocity).toBeLessThan(20)

    // тумблер панели выключает плавный разгон
    tuning.pAccelOn = false
    tick()
    expect(walker.element.velocity).toBeGreaterThan(35)
  })
})
