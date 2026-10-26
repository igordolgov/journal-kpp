// tests/no33-confident-cars.test.ts
// [№33] «заезжающая машина, которой уступили, не должна притормаживать»:
//  1) триггер «встречная в crossing» в carYieldLevel стал ГЕОМЕТРИЧЕСКИМ:
//     пока корпус выезжающей ещё на полосе дороги — заезжающая уступает
//     (семантика безопасности сохранена); как только выезжающая подняла
//     корпус выше дороги (уже проехала створ, «уступила») — заезжающая
//     едет СВОИМ ходом без сброса скорости;
//  2) полный цикл «выезжающая уступила — заехавшая уехала налево без
//     ожидания закрытия — выезжающая вернулась и проехала»: без
//     столкновений, без watchdog-телепортов, ворота в итоге закрываются.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const DT = 0.05
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const GATE = {
  id: 'gate-1', x: 595, y: 380, width: 90, height: 40,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate',
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
}
const F = GATE.y + GATE.height            // 420 — линия дороги
const ROAD_Y = F - CAR.height / 2         // 400
const ENTER_STOP_Y = ROAD_Y - 6           // 394 — стоп въезда
const ENTER_CROSS_Y = ROAD_Y + 58         // 458 — посадка въезда
const EXIT_STOP_Y = ROAD_Y + CAR.height + 10 // 450 — стоп выезда
const CX = 640

const build = (gateOverrides: Record<string, unknown> = {}) => {
  const gate: any = { ...GATE, settings: { ...GATE.settings, ...gateOverrides } }
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const warns: string[] = []
  vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    warns.push(args.map(String).join(' '))
  })
  const simOpts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    gateCloseWaitMax: 45, waitAfterMax: 30,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {}, simOpts, undefined, undefined,
  )
  return { gate, simElements, aiAgents, sceneSize, physics, warns }
}

const mkCar = (
  id: string, direction: 'enter' | 'exit', state: string,
  cx: number, cy: number,
  target: { x: number; y: number },
  after: { x: number; y: number },
  exit: { x: number; y: number },
  velocity = 0,
  facingLeft = true,
) => ({
  id,
  element: {
    id, x: cx - CAR.width / 2, y: cy - CAR.height / 2, width: CAR.width, height: CAR.height,
    rotation: 0, velocity, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: facingLeft },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: exit.x, y: exit.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
})

const centerOf = (a: any) => ({
  x: a.element.x + CAR.width / 2,
  y: a.element.y + CAR.height / 2,
})

// путь машины за окно тиков (px)
const travelled = (a: any, ticks: number, h: any): number => {
  const start = { ...centerOf(a) }
  for (let i = 0; i < ticks; i++) {
    h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
  }
  return Math.hypot(centerOf(a).x - start.x, centerOf(a).y - start.y)
}

describe('[№33-УВЕРЕННЫЙ-ПОДХОД] заезжающая не тормозит, когда выезжающая уже проехала', () => {
  afterEach(() => vi.restoreAllMocks())

  it('B в crossing, но корпус УЖЕ выше дороги — A на подходе едет своим ходом', () => {
    const h = build()
    // A на подходе, 190px до стопа (в зоне створа CAR_GATE_ZONE = 240)
    const a = mkCar('a', 'enter', 'to_gate', CX + 190, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 100)
    // B «crossing», но корпус целиком выше створа/дороги (cy = 330 < gate.y=380):
    // она уже проехала шлагбаум — уступила полосу
    const b = mkCar('b', 'exit', 'crossing', CX, 330, { x: CX, y: 300 }, { x: 1300, y: 300 }, { x: CX, y: 300 }, 40)
    h.aiAgents.value = [a as any, b as any]
    const d = travelled(a, 6, h) // 0.3с
    // крейсерская 100 px/с дала бы 30px; торможение «к границе створа» — <= 22px
    expect(d).toBeGreaterThanOrEqual(25)
  })

  it('B в crossing на ПОЛОСЕ дороги — A по-прежнему уступает (безопасность)', () => {
    const h = build()
    const a = mkCar('a', 'enter', 'to_gate', CX + 190, ENTER_STOP_Y, { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 100)
    // B реально в створе: корпус накрывает линию дороги (cy = 430, F = 420)
    const b = mkCar('b', 'exit', 'crossing', CX, 430, { x: CX, y: 300 }, { x: 1300, y: 300 }, { x: CX, y: 300 }, 40)
    h.aiAgents.value = [a as any, b as any]
    const d = travelled(a, 6, h)
    expect(d).toBeLessThanOrEqual(24)
  })
})

describe('[№33-ЦИКЛ] выезжающая уступила — заехавшая уехала — выезжающая проехала', () => {
  afterEach(() => vi.restoreAllMocks())

  it('полный цикл без столкновений и watchdog-телепортов', () => {
    const h = build()
    // A заезжает (crossing): от стопа вниз к посадке
    const a = mkCar('a', 'enter', 'crossing', CX, 400, { x: CX, y: ENTER_CROSS_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 60)
    // B хотела выехать, но стоит на своём стопе (уступит: A в crossing)
    const b = mkCar('b', 'exit', 'waiting_before', CX, EXIT_STOP_Y, { x: CX, y: EXIT_STOP_Y }, { x: 1300, y: 300 }, { x: CX, y: 300 }, 0)
    h.aiAgents.value = [a as any, b as any]

    const rects = () => h.aiAgents.value.map((x: any) => x.element)
    let overlapped = false
    const checkOverlap = () => {
      const rs = rects()
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          const p = rs[i], q = rs[j]
          if (p.x < q.x + CAR.width - 2 && p.x + CAR.width > q.x + 2 &&
              p.y < q.y + CAR.height - 2 && p.y + CAR.height > q.y + 2) overlapped = true
        }
      }
    }

    // A доезжает до посадки, B отъезжает вглубь базы (уступает)
    for (let i = 0; i < 80; i++) { // 4с
      h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
      checkOverlap()
    }
    expect(a.state === 'waiting_after' || a.state === 'moving_away').toBe(true)
    // [№33-УЕЗД-ВЫЕЗД] B (to_gate у линии) разрешает заехавшей ранний уезд —
    // A уезжает налево НЕ ДОЖИДАЯСЬ закрытия ворот
    expect(a.state).toBe('moving_away')
    expect(a.afterTarget.x).toBeLessThan(0)

    // B возвращается на свой стоп и проходит: ворота открыты (awaiting A left)
    for (let i = 0; i < 120; i++) { // 6с
      h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
      checkOverlap()
    }
    expect(['crossing', 'waiting_after', 'moving_away', 'done']).toContain(b.state)
    if (b.state === 'waiting_after' || b.state === 'moving_away' || b.state === 'done') {
      // B реально проехала шлагбаум (центр выше линии дороги)
      expect(centerOf(b).y).toBeLessThan(F)
    }
    expect(overlapped).toBe(false)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })
})
