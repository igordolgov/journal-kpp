// tests/exit-pullback.test.ts
// [№23-ВЫЕЗД-ЗАКРЫТИЕ] выезжающая машина после вежливой паузы 0.8с обязана
// дождаться ПОЛНОГО закрытия ворот, если у ворот нет другой машины (репорт
// №23: «машины обязательно должны ждать закрытия ворот после
// въезда/выезда»). Исключение — другая машина у ворот (стоит/подъезжает:
// корпус или цель в коридоре оси, exitLaneBusy): тогда уезд СРАЗУ в
// свободную от встречных сторону — не задерживаем очередь у створа
// (репорты №20-4/№21-7). История: №19 вводил отъезд на линию ожидания,
// №20 — корректор точки, №21 — уезд при свободной дороге, №23 возвращает
// ожидание закрытия при пустых воротах, №27 запрещал уезд при открытом
// шлагбауме, [№34] возвращает ранний уезд ПРИ ЛЮБОМ шлагбауме, когда
// въезжающая претендует на ось (репорт: «уступила — но не уехала сразу,
// а ждала закрытия»): створ уже пройден, посадка линию F не перекрывает.
//  • уезд — вбок по ФАКТИЧЕСКОЙ полосе (afterTarget.y = текущий центр);
//  • уезд только корпусом ВЫШЕ полосы въезда (низ на посадке F - 46);
//  • корпус на линии ожидания не перекрывает линию шлагбаума F (низ корпуса
//    в 6px над F) — свип закрывает ворота за спиной уехавшей.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_STOP_OFFSET } from '~/utils/simulatorConstants'
import { CAR_EXIT_PULL_PAST, STOP_STANDOFF_ENTER } from '~/utils/simulatorTraffic'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }

const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const ROAD_Y = 220 - CAR.height / 2            // 200
const ENTER_STOP_Y = ROAD_Y - 6                // 194 — линия ожидания въезжающих
const ENTER_CROSS_Y = ROAD_Y + CAR_STOP_OFFSET // 258
const EXIT_STOP_Y = ROAD_Y + CAR.height + 10   // 250
const EXIT_CROSS_Y = ROAD_Y - CAR_EXIT_PULL_PAST // глубокая посадка (без №19)

const buildHarness = (opts: Record<string, unknown> = {}) => {
  const gate: any = makeCarGate()
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
    ...opts,
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
  return { gate, simElements, aiAgents, physics, warns }
}

const mkCar = (id: string, direction: 'enter' | 'exit', state: string, cx: number, cy: number, target: { x: number; y: number }, after: { x: number; y: number }) => ({
  id,
  element: {
    id, x: cx - CAR.width / 2, y: cy - CAR.height / 2, width: CAR.width, height: CAR.height,
    rotation: 0, velocity: 0, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: direction === 'enter' },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'car-gate-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + CAR.width / 2,
  y: a.element.y + CAR.height / 2,
})

const tick = (h: ReturnType<typeof buildHarness>, n: number, cfg = { carGateId: 'car-gate-1', personGateId: '' }) => {
  for (let i = 0; i < n; i++) h.physics.updateAiMovement(DT, cfg)
}

describe('уезд выезжающей ([№23-ВЫЕЗД-ЗАКРЫТИЕ])', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('одиночная выезжающая при пустых воротах ждёт ПОЛНОГО закрытия, уезд после него ([№23])', () => {
    const h = buildHarness()
    const exit = mkCar('car-x', 'exit', 'waiting_after',
      580, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 1300, y: ENTER_STOP_Y })
    h.aiAgents.value = [exit as any]

    // вежливая пауза 0.8с — ещё ждёт
    tick(h, 7)
    expect(exit.state).toBe('waiting_after')

    // пауза прошла, ворота открыты, у ворот никого — ждёт закрытия ([№23])
    tick(h, 10)
    expect(exit.state).toBe('waiting_after')
    expect(h.gate.settings.isOpen).toBe(true)

    // оператор закрыл ворота — уезд вбок по фактической полосе (направо:
    // afterTarget был справа, встречных на дороге нет)
    h.gate.settings.isOpen = false
    h.gate.settings.isAnimating = false
    tick(h, 3)
    expect(['moving_away', 'done']).toContain(exit.state)
    expect(exit.afterTarget.y).toBeCloseTo(ENTER_STOP_Y, 0)
    expect(exit.afterTarget.x).toBeGreaterThan(SCENE.width)
  })

  it('встречная подъезжает справа (цель на линии) — уезд СРАЗУ при открытом шлагбауме ([№34])', () => {
    const h = buildHarness()
    const enter = mkCar('car-e', 'enter', 'to_gate',
      1000, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    const exit = mkCar('car-x', 'exit', 'waiting_after',
      580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y }, { x: 1300, y: EXIT_CROSS_Y })
    h.aiAgents.value = [enter, exit as any]

    // [№34] репорт: «выхавшая машина уступила подъезжающей, но не уехала
    // сразу, а ждала пока закроются ворота». Теперь после вежливой паузы
    // выезжающая уезжает СРАЗУ при ЛЮБОМ шлагбауме (створ пройден, посадка
    // линию F не перекрывает), освобождая ось подъезжающей. Сторона —
    // свободная: справа встречная — уезд налево.
    tick(h, 10) // ~1с
    expect(exit.state).toBe('moving_away')
    expect(h.gate.settings.isOpen).toBe(true) // уезд БЕЗ ожидания закрытия
    expect(exit.afterTarget.x).toBeLessThan(0)
    expect(exit.afterTarget.y).toBeCloseTo(EXIT_CROSS_Y, 0)

    // подъезжающая свободно доезжает и проезжает (ось освобождена; 420px
    // с мягким разгоном и тормозным профилем М3/М4 — ~8с). Важно: она НЕ
    // застряла в to_gate — ничто не запирает ей подход к открытому створу
    tick(h, 100)
    expect(enter.state).not.toBe('to_gate')
    expect(['waiting_before', 'crossing', 'waiting_after', 'moving_away']).toContain(enter.state)
  })

  it('у ворот машина, но обе стороны дороги заняты встречными — корректор + ожидание закрытия ([№23])', () => {
    const h = buildHarness()
    // встречные на дороге слева и справа (корпуса вне осевого коридора ±70,
    // поэтому ось свободна и корректор держит её на линии ожидания)
    const enterL = mkCar('car-l', 'enter', 'to_gate',
      200, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    const enterR = mkCar('car-r', 'enter', 'to_gate',
      1000, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 580, y: 900 })
    const exit = mkCar('car-x', 'exit', 'waiting_after',
      580, EXIT_CROSS_Y, { x: 580, y: EXIT_CROSS_Y }, { x: 1300, y: EXIT_CROSS_Y })
    h.aiAgents.value = [enterL, enterR, exit as any]

    tick(h, 12) // ~1.2с: стороны заняты — НЕ уезжает
    expect(exit.state).toBe('waiting_after')

    // оператор закрыл ворота — уезд (свободных сторон нет — уезд по исходной)
    h.gate.settings.isOpen = false
    h.gate.settings.isAnimating = false
    tick(h, 3)
    expect(['moving_away', 'done']).toContain(exit.state)
    expect(Math.abs(exit.afterTarget.y - centerOf(exit).y)).toBeLessThanOrEqual(2)
  })

  it('выехавшая на линии ожидания не перекрывает линию шлагбаума (свип закрывает за спиной)', () => {
    const h = buildHarness()
    const exit = mkCar('car-x', 'exit', 'waiting_after',
      580, ENTER_STOP_Y, { x: 580, y: ENTER_STOP_Y }, { x: 1300, y: ENTER_STOP_Y })
    h.aiAgents.value = [exit as any]
    tick(h, 7)
    expect(centerOf(exit).y + CAR.height / 2).toBeLessThanOrEqual(220 - 4)
  })
})
