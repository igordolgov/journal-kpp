// tests/return-direct.test.ts
// [№29-НАПРЯМУЮ] Репорт №29: «когда человек уступил дорогу (отошел вправо),
// он слишком резко возвращается на свой путь вместо того чтобы идти к
// следующей точке без разгона и напрямую. я не нашел этого параметра в
// новых настройках».
//
// Проверяется:
//  1) РЕЕСТР: в настройках людей есть тумблер pReturnOn и ползунок
//     pReturnArc «Возврат после уступания — дуга» (группа «Плавность хода»);
//  2) ГЕОМЕТРИЯ: дуга прохода начинается ходом К СКВОЗНОЙ точке выхода —
//     первый сегмент преимущественно ПЕРЕДНИЙ (к следующей точке), а не
//     боковой рывок к оси, как у прежней квадратичной дуги №23;
//  3) ГАРАНТИИ №23 сохранены: кривая не переваливает за границу чистого
//     корпуса (2px допуска внутри запаса APERTURE_INSET), заканчивается
//     строго на оси прохода, движение вперёд без отката;
//  4) ПОЛЗУНОК: pReturnArc=0 — курс на выход держится дольше (выравнивание
//     на ось позже), pReturnArc=100 — выравнивание раньше;
//  5) ТУМБЛЕР: pReturnOn=false — выравнивания на ось нет вовсе, цель
//     прохода = сквозная точка выхода;
//  6) ФИЗИКА: человек, отошедший вправо уступанием, после старта прохода
//     идёт к следующей точке (передняя составляющая хода больше боковой).

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { buildWicketArcPoints } from '~/utils/gateFlow'
import {
  PERSON_TUNING_FIELDS, defaultPersonTuning, tuneNumber, tuneBool,
} from '~/utils/personTuning'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.05
const AXIS_X = 800
const FENCE_Y = 220
const RADIUS = PERSON_HEIGHT / 2
// стандартный сценарий: человек уступанием отошёл на 30px вправо от оси,
// стоит в 60px перед линией забора, сквозная точка выхода — в 60px за ней
const START_X = AXIS_X + 30
const START_Y = FENCE_Y - 60
const EXIT_Y = FENCE_Y + 60

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay)

describe('реестр: настройка «Возврат после уступания» [№29]', () => {
  it('ползунок pReturnArc с тумблером pReturnOn есть в реестре', () => {
    const f = PERSON_TUNING_FIELDS.find(x => x.key === 'pReturnArc')
    expect(f).toBeDefined()
    expect(f!.toggleKey).toBe('pReturnOn')
    expect(f!.group).toBe('Плавность хода')
    expect(f!.min).toBe(0)
    expect(f!.max).toBe(100)
    expect(f!.step).toBeLessThanOrEqual(5)
    expect(f!.def).toBe(30)
    const d = defaultPersonTuning()
    expect(d.pReturnArc).toBe(30)
    expect(d.pReturnOn).toBe(true)
  })

  it('tuneNumber/tuneBool клампят значения ползунка и тумблера', () => {
    expect(tuneNumber({ pReturnArc: 999 }, 'pReturnArc')).toBe(100)
    expect(tuneNumber({ pReturnArc: -5 }, 'pReturnArc')).toBe(0)
    expect(tuneNumber({ pReturnArc: 55 }, 'pReturnArc')).toBe(55)
    expect(tuneNumber({}, 'pReturnArc')).toBe(30)
    expect(tuneBool({ pReturnOn: false }, 'pReturnOn')).toBe(false)
    expect(tuneBool({}, 'pReturnOn')).toBe(true)
  })
})

describe('геометрия дуги: ход к следующей точке, а не рывок к оси [№29]', () => {
  it('первый сегмент дуги — преимущественно передний (к точке выхода)', () => {
    const pts = buildWicketArcPoints(START_X, START_Y, AXIS_X, EXIT_Y, FENCE_Y, RADIUS, 0.3)
    expect(pts.length).toBeGreaterThanOrEqual(8)
    const first = pts[0]!
    const mx = first.x - START_X
    const my = first.y - START_Y
    // прежняя дуга №23: первый сегмент почти ГОРИЗОНТАЛЬНЫЙ к оси
    // (|mx| >> |my| — боковой рывок). Новая: ход к следующей точке —
    // передняя составляющая больше боковой.
    expect(Math.abs(my)).toBeGreaterThan(Math.abs(mx))
    // курс первого сегмента близок к направлению «старт -> точка выхода»
    const uLen = dist(START_X, START_Y, AXIS_X, EXIT_Y)
    const dot = (mx * (AXIS_X - START_X) + my * (EXIT_Y - START_Y)) /
      (Math.hypot(mx, my) * uLen)
    expect(dot).toBeGreaterThan(0.9)
  })

  it('гарантии №23 сохранены: без перевала за чистый корпус, финиш на оси, без отката', () => {
    const clearY = FENCE_Y - RADIUS - 6
    for (const curve of [0, 0.3, 0.7, 1]) {
      const pts = buildWicketArcPoints(START_X, START_Y, AXIS_X, EXIT_Y, FENCE_Y, RADIUS, curve)
      expect(pts.length).toBeGreaterThan(0)
      let prevY = START_Y
      for (const p of pts) {
        // не глубже границы чистого корпуса + 2px допуска (запас APERTURE_INSET)
        expect(p.y).toBeLessThanOrEqual(clearY + 2.5)
        // движение вперёд (вниз) без отката
        expect(p.y).toBeGreaterThanOrEqual(prevY - 0.5)
        prevY = p.y
      }
      const last = pts[pts.length - 1]!
      // финиш строго на оси прохода, у границы чистого корпуса
      expect(Math.abs(last.x - AXIS_X)).toBeLessThan(1)
      expect(Math.abs(last.y - clearY)).toBeLessThan(1)
    }
  })

  it('человек у самой линии забора: короткий отход, затем ход к оси (pastBoundary)', () => {
    const clearY = FENCE_Y - RADIUS - 6
    const pts = buildWicketArcPoints(START_X, clearY + 6, AXIS_X, EXIT_Y, FENCE_Y, RADIUS, 0.3)
    const first = pts[0]!
    // первая точка — отход ОТ линии забора (вверх при ходе вниз)
    expect(first.y).toBeLessThan(clearY + 6)
    const last = pts[pts.length - 1]!
    expect(Math.abs(last.x - AXIS_X)).toBeLessThan(1)
  })

  it('ползунок: 0% — позже выравнивается на ось, 100% — раньше', () => {
    const direct = buildWicketArcPoints(START_X, START_Y, AXIS_X, EXIT_Y, FENCE_Y, RADIUS, 0)
    const curved = buildWicketArcPoints(START_X, START_Y, AXIS_X, EXIT_Y, FENCE_Y, RADIUS, 1)
    // сравниваем на равной ПРОЙДЕННОЙ дистанции от старта (t кривых несопоставим)
    const walked = (points: { x: number; y: number }[], target: number) => {
      let acc = 0
      let px = START_X
      let py = START_Y
      for (const p of points) {
        acc += dist(px, py, p.x, p.y)
        px = p.x
        py = p.y
        if (acc >= target) return p
      }
      return points[points.length - 1]!
    }
    const pDirect = walked(direct, 20)
    const pCurved = walked(curved, 20)
    // на 20px хода «напрямую» человек ещё дальше от оси, чем при 100%
    expect(Math.abs(pDirect.x - AXIS_X)).toBeGreaterThan(Math.abs(pCurved.x - AXIS_X))
  })
})

// --- физика: человек после уступания идёт к следующей точке ---

const makeWicket = () => ({
  id: 'wicket-1', x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: true, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const buildHarness = (tuning: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([makeWicket()])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
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
    undefined,
    undefined,
  )
  return { simElements, aiAgents, physics }
}

const mkYieldedPerson = () => ({
  id: 'p1',
  element: {
    id: 'p1', x: START_X - PERSON_WIDTH / 2, y: START_Y - PERSON_HEIGHT / 2,
    width: PERSON_WIDTH, height: PERSON_HEIGHT,
    rotation: Math.PI / 2, velocity: 0, category: 'human', type: 'actor', direction: 'enter',
  },
  state: 'waiting_before',
  target: { x: START_X, y: START_Y, width: 0, height: 0 },
  afterTarget: { x: 900, y: 420, width: 0, height: 0 },
  exitPoint: { x: AXIS_X, y: EXIT_Y, width: 0, height: 0 },
  speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
})

describe('физика: возврат после уступания без рывка к оси [№29]', () => {
  it('после старта прохода ход направлен к следующей точке (передний > бокового)', () => {
    const h = buildHarness({})
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    const tick = () => h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })

    tick()
    expect(p.state).toBe('crossing')
    // первая цель — точка дуги СМЕЩЁННОГО старта: строго между стартом
    // и осью (не сама ось — выравнивание идёт плавно, не рывком)
    expect(p.target.x).toBeGreaterThan(AXIS_X + 1)
    expect(p.target.x).toBeLessThan(START_X - 1)

    const startX = p.element.x + PERSON_WIDTH / 2
    const startY = p.element.y + PERSON_HEIGHT / 2
    for (let i = 0; i < 10; i++) tick()
    const mx = (p.element.x + PERSON_WIDTH / 2) - startX
    const my = (p.element.y + PERSON_HEIGHT / 2) - startY
    // человек реально пошёл к проходу: вперёд больше, чем вбок
    expect(my).toBeGreaterThan(Math.abs(mx) * 1.5)
    expect(my).toBeGreaterThan(0)
  })

  it('тумблер pReturnOn=false — выравнивания на ось нет, цель = точка выхода', () => {
    const h = buildHarness({ pReturnOn: false })
    const p = mkYieldedPerson() as any
    h.aiAgents.value = [p]
    h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    expect(p.state).toBe('crossing')
    expect(p.target.x).toBeCloseTo(AXIS_X, 5)
    expect(p.target.y).toBeCloseTo(EXIT_Y, 5)
  })
})
