// tests/no51-exit-crossing-depth.test.ts
// [№51-ПРОЕЗД-БЕЗ-ВЫСОТЫ] репорт: «опять выезжающая машина проезжает слишком
// высоко за ворота, когда пропускает въезжающую, хотя по виду им места
// хватило бы, даже для двух грузовиков».
//
// Причина: №48 сделал адаптивной только ПОСАДКУ ПОСЛЕ прохода (корректор
// waiting_after), а САМ ПРОЕЗД (цель crossing) при занятой полосе шёл на
// гарантийный коридор F − 71 (agent.exitPoint): против легковой машина
// visibly перелезала выше нужного и потом спускалась корректором.
//
// Решение: цель crossing выезжающей машины теперь тоже адаптивная —
// нос самого высокого встречного + стендофф (gateFlow.exitPullPastFor):
//   • против легковой — F − (h + 6);
//   • против грузовика — F − 71 (разъезд двух грузовиков как в №46/№48);
//   • свободная линия — линия ожидания въезжающих (F − 6, [№20]).
//
// [№52-ГРУЗ-НЕ-ВЫШЕ-ДОРОГИ] у выезжающего ГРУЗОВИКА глубина — по ВИДИМОЙ
// геометрии спрайтов (колёса над видимой крышей встречного): репорт
// «легковые поднимаются как надо — не выше уровня дороги, а грузовые
// все-таки выше». Легковая выезжающая — без изменений.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { CAR_EXIT_PULL_PAST, STOP_STANDOFF_ENTER, STOP_STANDOFF_EXIT } from '~/utils/simulatorTraffic'
import { exitPullPastFor } from '~/utils/gateFlow'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

// ─── Геометрия сценария (как в no48-comfortable-exit.test.ts) ───────────────
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const TRUCK = { width: 120, height: 65 }
const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})
const F = 220                       // линия дороги (низ ворот)
const ROAD_Y = F - CAR.height / 2   // 200
const LINE_Y = ROAD_Y - STOP_STANDOFF_ENTER // 194 — линия ожидания въезжающих
// стоп выезжающей [СПЕЦ-Z8]: центр ниже ворот на высоту корпуса + 10
const EXIT_STOP_Y = ROAD_Y + CAR.height + STOP_STANDOFF_EXIT // 250

const buildHarness = () => {
  const gate: any = makeCarGate()
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined,
  )
  return { gate, aiAgents, physics }
}

const mkAgent = (
  id: string, direction: 'enter' | 'exit', state: string,
  size: { width: number; height: number }, cx: number, cy: number,
  target: { x: number; y: number },
) => ({
  id,
  element: {
    id, x: cx - size.width / 2, y: cy - size.height / 2, width: size.width, height: size.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: direction === 'enter' },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: direction === 'exit' ? SCENE.width + 100 : target.x, y: cy, width: 0, height: 0 },
  exitPoint: { x: cx, y: direction === 'exit' ? cy : target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'car-gate-1',
})

// Встречная — корпус ВНЕ коридора створа (не блокирует очередь направлений),
// но ЦЕЛЬ на линии ожидания: легально претендует на стоп-точку, поэтому
// enterLaneOpponentHeight видит её (см. тест «цель на линии» в №48).
const runExitCrossing = (
  oppSize: { width: number; height: number },
  withOpponent: boolean,
  exitSize: { width: number; height: number } = CAR, // [№52] выезжающая может быть грузовиком
) => {
  const h = buildHarness()
  const agents: any[] = []
  if (withOpponent) {
    agents.push(mkAgent('opp', 'enter', 'to_gate', oppSize, 700, 100, { x: 580, y: LINE_Y }))
  }
  const exit = mkAgent('exit', 'exit', 'waiting_before', exitSize, 580, EXIT_STOP_Y, { x: 580, y: EXIT_STOP_Y })
  ;(exit.element.settings as any)._isTruck = exitSize.height > CAR.height // [№52] флаг спавна
  agents.push(exit as any)
  h.aiAgents.value = agents

  for (let i = 0; i < 30 && exit.state === 'waiting_before'; i++) {
    h.physics.updateAiMovement(0.1, { carGateId: 'car-gate-1', personGateId: '' })
  }
  expect(exit.state).toBe('crossing')
  return exit
}

describe('[№51] цель crossing выезда — адаптивная глубина (было всегда F − 71)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('против легковой проезд заканчивается на F − 46, а не на гарантийном F − 71', () => {
    const exit = runExitCrossing(CAR, true)
    const adaptiveY = F - CAR.height / 2 - exitPullPastFor(CAR.height) // 220 - 20 - 46 = 154
    expect(exit.target.y).toBeCloseTo(adaptiveY, 0)
    // и это заведомо ниже (ближе к воротам) старого гарантийного коридора
    expect(exit.target.y).toBeGreaterThan(F - CAR.height / 2 - CAR_EXIT_PULL_PAST + 1)
  })

  it('против грузовика — гарантийный коридор F − 71 (разъезд двух грузовиков сохранён)', () => {
    const exit = runExitCrossing(TRUCK, true)
    const adaptiveY = F - CAR.height / 2 - exitPullPastFor(TRUCK.height) // 220 - 20 - 71 = 129
    expect(adaptiveY).toBe(F - CAR.height / 2 - CAR_EXIT_PULL_PAST)
    expect(exit.target.y).toBeCloseTo(adaptiveY, 0)
  })

  it('свободная линия — проезд до линии ожидания въезжающих F − 6 ([№20] без изменений)', () => {
    const exit = runExitCrossing(CAR, false)
    expect(exit.target.y).toBeCloseTo(LINE_Y, 0)
  })

  // ── [№52-ГРУЗ-НЕ-ВЫШЕ-ДОРОГИ] выезжающий ГРУЗОВИК ────────────────────────

  it('[№52] выезжающий грузовик против легковой — видимая геометрия, крыша не вылезает из зоны ворот', () => {
    const exit = runExitCrossing(CAR, true, TRUCK)
    const pull = exitPullPastFor(CAR.height, true, false, TRUCK.height)
    const adaptiveY = F - TRUCK.height / 2 - pull
    expect(exit.target.y).toBeCloseTo(adaptiveY, 0)
    // посадка заведомо НИЖЕ гарантийного коридора F − 71 (крыша ближе к воротам)
    expect(exit.target.y).toBeGreaterThan(F - TRUCK.height / 2 - CAR_EXIT_PULL_PAST + 1)
    // видимые колёса грузовика — не ниже видимой крыши встречной легковой:
    // низ элемента (target.y + h/2) + мёртвый зазор грунта (2) ≤ верх элемента
    // встречной (F − 6 − 40) + её мёртвая зона крыши (14) + 1px касания
    expect(exit.target.y + TRUCK.height / 2).toBeLessThanOrEqual(F - 6 - CAR.height + 14 + 1 + 2)
  })

  it('[№52] выезжающий грузовик против грузовика — касание видимых силуэтов без гарантийного коридора', () => {
    const exit = runExitCrossing(TRUCK, true, TRUCK)
    const pull = exitPullPastFor(TRUCK.height, true, true, TRUCK.height) // 65 + 7 − 12 − 2 = 58
    const adaptiveY = F - TRUCK.height / 2 - pull
    expect(exit.target.y).toBeCloseTo(adaptiveY, 0)
    // 58 < 71: посадка ниже прежней гарантийной (крыша грузовика опустилась)
    expect(pull).toBeLessThan(CAR_EXIT_PULL_PAST)
    expect(exit.target.y).toBeGreaterThan(F - TRUCK.height / 2 - CAR_EXIT_PULL_PAST)
  })
})
