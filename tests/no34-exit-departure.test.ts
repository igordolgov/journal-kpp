// tests/no34-exit-departure.test.ts
// [№34] Репорт: «выхавшая машина (в частности грузовик) увидела что к воротам
// подъезжает другая машина (легковая) и поднялась выше уступая последней
// место, но не уехала сразу а ждала пока закроются ворота. в это время
// легковая машина тоже не заехала в открывшиеся ворота а ждала пока закроются
// ворота».
//
// Диагноз: ранний уезд выезжающей требовал ПОЛНОГО закрытия ворот ([№27]) —
// подъезжающая (ещё не waiting_before) не разрешала уезд, а встать в очередь
// она не могла, пока выезжающая занимала створ (oppositeOccupies). Свип [G2]
// закрывал ворота только через gateCloseDelay — обе машины стояли всё это
// время («ждала пока закроются ворота»).
//
// Фикс: ранний уезд выезжающей разрешает и ПОДЪЕЗЖАЮЩАЯ въезжающая (корпус
// или цель в коридоре оси — exitLaneBusy) и при ЛЮБОМ шлагбауме; предохранители:
//  • уезд только корпусом выше полосы въезда (низ на посадке F-46): машина,
//    ещё стоящая на линии/в середине подъёма, сначала поднимается корректором;
//  • обе стороны дороги заняты встречными — уезда нет (репорт №27 сохранён);
//  • пустые ворота — ожидание закрытия ([№23] сохранён).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'

const DT = 0.05
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const TRUCK = { width: 96, height: 52 }
const GATE = {
  id: 'gate-1', x: 595, y: 380, width: 90, height: 40,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate',
  settings: { gateType: 'sliding', isOpen: true, isAnimating: false, isStopping: false },
}
const F = GATE.y + GATE.height                 // 420 — линия дороги/шлагбаума
const CX = 640
const ROAD_Y_ENTER = F - CAR.height / 2        // 400
const ENTER_STOP_Y = ROAD_Y_ENTER - 6          // 394 — стоп въезда
const ENTER_CROSS_Y = ROAD_Y_ENTER + 58        // 458 — посадка въезда
const ROAD_Y_TRUCK = F - TRUCK.height / 2      // 394
const EXIT_STOP_Y = ROAD_Y_TRUCK + TRUCK.height + 10 // 456 — стоп выезда
const EXIT_CROSS_Y = ROAD_Y_TRUCK - CAR_EXIT_PULL_PAST // 348 — посадка выезда

const build = () => {
  const gate: any = { ...GATE, settings: { ...GATE.settings } }
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

const mkVehicle = (
  id: string, direction: 'enter' | 'exit', state: string,
  cx: number, cy: number, size: { width: number; height: number },
  target: { x: number; y: number },
  after: { x: number; y: number },
  exit: { x: number; y: number },
  velocity = 0,
) => ({
  id,
  element: {
    id, x: cx - size.width / 2, y: cy - size.height / 2, width: size.width, height: size.height,
    rotation: 0, velocity, category: 'car', type: 'actor', direction,
    settings: { _facingLeft: true, _isTruck: size.height > 40 },
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: exit.x, y: exit.y, width: 0, height: 0 },
  speed: 100, type: 'car', direction, travelMode: 'car',
  gateId: 'gate-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + (a.element.width as number) / 2,
  y: a.element.y + (a.element.height as number) / 2,
})
const bottomOf = (a: any) => a.element.y + (a.element.height as number)

const rects = (agents: any[]) => agents.map((x: any) => x.element)
const hasOverlap = (agents: any[]): boolean => {
  const rs = rects(agents)
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const p = rs[i], q = rs[j]
      if (p.x < q.x + (q.width as number) - 2 && p.x + (p.width as number) > q.x + 2 &&
          p.y < q.y + (q.height as number) - 2 && p.y + (p.height as number) > q.y + 2) return true
    }
  }
  return false
}

describe('[№34-УЕЗД-СРАЗУ] выезжающая уезжает сразу, въезжающая заезжает в открытые ворота', () => {
  afterEach(() => vi.restoreAllMocks())

  it('грузовик на посадке + легковая на подходе: уезд через паузу при открытых воротах', () => {
    const h = build()
    // легковая на подходе, 260px правее стопа (вне осевого коридора)
    const a = mkVehicle('a', 'enter', 'to_gate', CX + 260, ROAD_Y_ENTER, CAR,
      { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 100)
    // грузовик уже проехал створ: waiting_after на посадке
    const b = mkVehicle('b', 'exit', 'waiting_after', CX, EXIT_CROSS_Y, TRUCK,
      { x: CX, y: EXIT_CROSS_Y }, { x: 1300, y: EXIT_CROSS_Y }, { x: CX, y: EXIT_CROSS_Y }, 0)
    h.aiAgents.value = [a as any, b as any]

    let departTick = -1
    for (let i = 0; i < 240; i++) { // 12 c
      h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
      if (b.state === 'moving_away' && departTick < 0) departTick = i
      expect(hasOverlap([a, b])).toBe(false)
    }
    // [№34] уезд сразу после вежливой паузы (<= 1.5с), БЕЗ ожидания закрытия
    expect(departTick).toBeGreaterThanOrEqual(0)
    expect(departTick * DT).toBeLessThanOrEqual(1.5)
    expect(h.gate.settings.isOpen).toBe(true)
    expect(b.afterTarget.y).toBeCloseTo(EXIT_CROSS_Y, 0)
    // легковая свободно доезжает и заезжает в ОТКРЫТЫЕ ворота
    expect(['crossing', 'waiting_after', 'moving_away']).toContain(a.state)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })

  it('полный цикл: грузовик от своего стопа проходит и уезжает, легковая заезжает следом', () => {
    const h = build()
    const a = mkVehicle('a', 'enter', 'to_gate', CX + 260, ROAD_Y_ENTER, CAR,
      { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 100)
    const b = mkVehicle('b', 'exit', 'waiting_before', CX, EXIT_STOP_Y, TRUCK,
      { x: CX, y: EXIT_STOP_Y }, { x: 1300, y: EXIT_CROSS_Y }, { x: CX, y: EXIT_CROSS_Y }, 0)
    h.aiAgents.value = [a as any, b as any]

    let sawCrossing = false
    for (let i = 0; i < 360; i++) { // 18 c
      h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
      if (b.state === 'crossing') sawCrossing = true
      expect(hasOverlap([a, b])).toBe(false)
    }
    // грузовик прошёл створ и уехал; весь цикл — при открытом шлагбауме
    expect(sawCrossing).toBe(true)
    expect(['moving_away', 'done']).toContain(b.state)
    expect(h.gate.settings.isOpen).toBe(true)
    // легковая заехала следом (проход вниз начался без цикла закрытия)
    expect(['crossing', 'waiting_after', 'moving_away']).toContain(a.state)
    if (a.state !== 'crossing') expect(centerOf(a).y).toBeGreaterThan(F)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })
})

describe('[№34-БЕЗОПАСНОСТЬ] уезд только корпусом выше полосы въезда', () => {
  afterEach(() => vi.restoreAllMocks())

  it('грузовик ещё на линии ожидания — сначала подъём корректором, уезд с посадки', () => {
    const h = build()
    const a = mkVehicle('a', 'enter', 'to_gate', CX + 260, ROAD_Y_ENTER, CAR,
      { x: CX, y: ENTER_STOP_Y }, { x: CX, y: 900 }, { x: CX, y: ENTER_CROSS_Y }, 100)
    // грузовик стоит НА ЛИНИИ ОЖИДАНИЯ (низ корпуса ниже F-44 — в полосе въезда)
    const b = mkVehicle('b', 'exit', 'waiting_after', CX, ROAD_Y_TRUCK - 6, TRUCK,
      { x: CX, y: ROAD_Y_TRUCK - 6 }, { x: 1300, y: EXIT_CROSS_Y }, { x: CX, y: EXIT_CROSS_Y }, 0)
    h.aiAgents.value = [a as any, b as any]

    let departBottom = NaN
    let movedSidewaysInLane = false
    for (let i = 0; i < 240; i++) { // 12 c
      h.physics.updateAiMovement(DT, { carGateId: 'gate-1', personGateId: '' })
      if (b.state === 'moving_away') {
        if (!Number.isFinite(departBottom)) departBottom = bottomOf(b)
      } else if (Math.abs(centerOf(b).x - CX) > 3 && bottomOf(b) > F - CAR_EXIT_PULL_PAST + 2) {
        movedSidewaysInLane = true
      }
      expect(hasOverlap([a, b])).toBe(false)
    }
    // уезд случился, но только с посадки (низ корпуса выше полосы въезда)
    expect(Number.isFinite(departBottom)).toBe(true)
    expect(departBottom).toBeLessThanOrEqual(F - CAR_EXIT_PULL_PAST + 2.5)
    expect(movedSidewaysInLane).toBe(false)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })
})
