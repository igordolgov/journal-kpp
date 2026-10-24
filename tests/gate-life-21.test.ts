// tests/gate-life-21.test.ts
// [№21] Живая логика у ворот и потоков — шесть пунктов репорта:
//  1) выезжающая машина не ждёт после выезда, если путь свободен (см. также
//     exit-pullback / gate-flow);
//  2) входящий человек после уступания проходит строго по оси проёма
//     калитки: сначала выравнивание на своей стороне, затем прямой проход
//     (косяк не задевается);
//  3) финальное торможение у точки ожидания отключается настройкой
//     finalBrake (эксперимент заказчика с рывками);
//  4) калитка как в жизни: охранник отпирает (приоткрыта), люди открывают
//     сами, приоткрытая захлопывается по таймауту;
//  5) встречные люди расходятся «каждый правее» на ходу, без торможения;
//  6) старт потоков спавна рандомизирован (initialSpawnDelay).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import { initialSpawnDelay } from '~/utils/simTuning'
import { PERSON_WIDTH, PERSON_HEIGHT, PERSON_STOP_OFFSET } from '~/utils/simulatorConstants'
import type { TrafficConfig } from '~/types/simulator'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }
const PERSON = { width: PERSON_WIDTH, height: PERSON_HEIGHT }

const makeWicket = (isOpen = false) => ({
  id: 'wicket-1', x: 550, y: 100, width: 60, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const F = 220                       // линия дороги/забора
const ROAD_Y = F - PERSON.height / 2 + 2 // 194.5 — центр человека на дороге (footPad 2)
const CX = 580

const buildHarness = (elements: any[] = [], opts: Record<string, unknown> = {}) => {
  const simElements = ref<any[]>([...elements])
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
    // заглушка закрытия повторяет ядро: флаги состояния сбрасываются по
    // завершении анимации закрытия (animateWicketTo kind='closed')
    (g: any) => { g.settings.isOpen = false; g.settings.wicketAjar = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined,
    opts.pushWicketFn as any,
  )
  return { simElements, aiAgents, sceneSize, physics, warns, simOpts }
}

const mkPerson = (id: string, state: string, cx: number, cy: number, target: { x: number; y: number }, direction: 'enter' | 'exit' = 'enter') => ({
  id,
  element: {
    id, x: cx - PERSON.width / 2, y: cy - PERSON.height / 2, width: PERSON.width, height: PERSON.height,
    rotation: direction === 'enter' ? Math.PI : 0, velocity: 0, category: 'person', type: 'actor', direction,
    settings: {},
  },
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: target.x, y: direction === 'enter' ? 900 : -80, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y + 78, width: 0, height: 0 },
  speed: 40, type: 'person', direction, travelMode: 'walk',
  gateId: 'wicket-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

const tick = (h: ReturnType<typeof buildHarness>, n: number, cfg = { carGateId: '', personGateId: 'wicket-1' }) => {
  for (let i = 0; i < n; i++) h.physics.updateAiMovement(DT, cfg)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// 2) [№21-СТВОР] проход строго через проём после уступания
// ---------------------------------------------------------------------------
describe('[№21-СТВОР] входящий проходит строго через проём калитки', () => {
  it('человек сбоку от оси: короткий отход от забора, затем плавная дуга в створ [№23-ДУГА]', () => {
    const h = buildHarness([makeWicket(true)])
    // ждущий у калитки после уступания: стоит СБОКУ от оси (cx 520, ось 580),
    // визуальный низ — на линии забора
    const p = mkPerson('p-1', 'waiting_before', 520, ROAD_Y, { x: 520, y: ROAD_Y })
    p.exitPoint = { x: CX, y: ROAD_Y + PERSON_STOP_OFFSET }
    p.afterTarget = { x: CX, y: 900, width: 0, height: 0 }
    h.aiAgents.value = [p as any]

    tick(h, 1)
    expect(p.state).toBe('crossing')
    // [№23-ДУГА] двухфазное выравнивание заменено дугой: первая цель — НЕ
    // скачок на ось, а короткий отход от линии забора (кромка была на линии)
    expect((p.element.settings as any)._alignStage).toBeUndefined()
    expect(p.target.x).toBeLessThan(CX)
    expect(p.target.y).toBeLessThan(ROAD_Y - 3)

    // дожимаем: проход сходится к оси проёма и уходит строго по ней
    tick(h, 140)
    expect(p.state).toBe('moving_away')
    expect(Math.abs(centerOf(p).x - CX)).toBeLessThan(0.02)
    expect((p.element.settings as any)._alignStage).toBeUndefined()
  })

  it('человек ровно на оси — проход без этапа выравнивания', () => {
    const h = buildHarness([makeWicket(true)])
    const p = mkPerson('p-2', 'waiting_before', CX, ROAD_Y, { x: CX, y: ROAD_Y })
    p.exitPoint = { x: CX, y: ROAD_Y + PERSON_STOP_OFFSET }
    h.aiAgents.value = [p as any]
    tick(h, 1)
    expect(p.state).toBe('crossing')
    expect((p.element.settings as any)._alignStage).toBeUndefined()
    expect(p.target.y).toBe(ROAD_Y + PERSON_STOP_OFFSET)
  })
})

// ---------------------------------------------------------------------------
// 3) [№21-РЫВКИ] финальное торможение отключается настройкой finalBrake
// ---------------------------------------------------------------------------
describe('[№21-РЫВКИ] экспериментальный выключатель финального торможения', () => {
  const speedAtDist40 = (arrivalBrake: boolean | undefined): number => {
    const h = buildHarness([makeWicket(true)], { arrivalBrake })
    const p = mkPerson('p-fb', 'to_gate', CX + 220, ROAD_Y, { x: CX, y: ROAD_Y })
    h.aiAgents.value = [p as any]
    // минимум скорости в полосе dist (15..40]: с finalBrake профиль монотонно
    // гасит ход (cap = dist*0.6), без — ход остаётся крейсерским
    let vMin = Infinity
    for (let i = 0; i < 200; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      const dist = Math.abs(centerOf(p).x - CX)
      if (dist <= 40 && dist > 15) vMin = Math.min(vMin, p.element.velocity || 0)
      if (p.state !== 'to_gate' || dist <= 15) break
    }
    return vMin
  }

  it('arrivalBrake: false — торможение dist<80 не применяется, скорость у точки остаётся ходовой', () => {
    const vOff = speedAtDist40(false)
    const vOn = speedAtDist40(true)
    expect(vOff).toBeGreaterThan(vOn + 8)
    expect(vOn).toBeLessThanOrEqual(16) // cap = dist*0.6 в полосе замера
    expect(vOff).toBeGreaterThanOrEqual(38) // крейсерская без гашения
  })
})

// ---------------------------------------------------------------------------
// 4) [№21-КАЛИТКА] калитка как в жизни
// ---------------------------------------------------------------------------
describe('[№21-КАЛИТКА] охранник отпирает — люди открывают — таймаут захлопывания', () => {
  it('разблокированная калитка полотно сама не открывает: человек ждёт полного открытия [№24-РУЧКА]', () => {
    const h = buildHarness([makeWicket(false)])
    const w = h.simElements.value[0]
    // охранник щёлкнул замком: ключ ajar стоит, ПОЛОТНО закрыто —
    // приоткрытия-твина больше нет (замок показывает только ручка)
    w.settings.wicketAjar = true
    const p = mkPerson('p-w', 'waiting_before', CX, ROAD_Y, { x: CX, y: ROAD_Y })
    p.exitPoint = { x: CX, y: ROAD_Y + PERSON_STOP_OFFSET }
    h.aiAgents.value = [p as any]

    tick(h, 3)
    // полотно не открылось само, человек не стартовал проход
    expect(w.settings.isOpen).toBe(false)
    expect(w.settings.wicketAjar).toBe(true)
    expect(p.state).toBe('waiting_before')

    // калитку открыли (кнопка/клик/подошедшие люди) — человек пошёл сразу
    w.settings.isOpen = true
    tick(h, 2)
    expect(p.state).toBe('crossing')
  })

  it('запертая калитка: человек ждёт охранника (никаких авто-проходов)', () => {
    const h = buildHarness([makeWicket(false)])
    const p = mkPerson('p-locked', 'waiting_before', CX, ROAD_Y, { x: CX, y: ROAD_Y })
    h.aiAgents.value = [p as any]
    tick(h, 60) // 6с — force-cross лимит одиночки превышен
    expect(p.state).toBe('waiting_before')
    expect(h.simElements.value[0].settings.isOpen).toBe(false)
  })

  // [№24-РУЧКА] таймаут захлопывания приоткрытой калитки и его отмена
  // человеком в зоне — семантика ЯДРА (useSimulatorCore.wicketAjarTimers),
  // покрыта tests/wicket-life.test.ts («никто не открыл — запирается сама
  // по таймауту», «человек в зоне отменяет таймер») — здесь не дублируется.
})

// ---------------------------------------------------------------------------
// 5) [№21-ВСТРЕЧНЫЕ] расходятся правее на ходу, без торможения
// ---------------------------------------------------------------------------
describe('[№21-ВСТРЕЧНЫЕ] встречные расходятся правее на ходу', () => {
  const mkWalker = (id: string, x: number, dirX: number) => ({
    id, element: {
      id, x: x - PERSON.width / 2, y: 200 - PERSON.height / 2,
      width: PERSON.width, height: PERSON.height, rotation: dirX > 0 ? 0 : Math.PI, velocity: 0,
      category: 'human', type: 'actor',
      direction: dirX > 0 ? 'enter' : 'exit',
    },
    state: 'moving_away',
    target: { x: x + dirX * 900, y: 200, width: 0, height: 0 },
    afterTarget: { x: x + dirX * 900, y: 200, width: 0, height: 0 },
    exitPoint: { x, y: 200 },
    speed: 40, type: 'person', travelMode: 'walk',
  })

  it('встречная пара не останавливается: у обоих ход сохраняется, расходятся правее', () => {
    const h = buildHarness([])
    const a = mkWalker('a', 400, 1)
    const b = mkWalker('b', 600, -1)
    h.aiAgents.value = [a as any, b as any]

    let minV = Infinity
    let minDist = Infinity
    let crossed = false
    for (let i = 0; i < 500; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
      const ax = centerOf(a).x
      const bx = centerOf(b).x
      if (ax > bx) crossed = true
      if (!crossed && i > 20) minV = Math.min(minV, a.element.velocity || 0, b.element.velocity || 0)
      minDist = Math.min(minDist, Math.hypot(ax - bx, centerOf(a).y - centerOf(b).y))
      if (crossed && i > 100) break
    }
    expect(crossed).toBe(true)
    // разошлись без прохода сквозь
    expect(minDist).toBeGreaterThanOrEqual(24)
    // [№21] торможение не обязательно: ход не падал ниже половины крейсерской
    expect(minV).toBeGreaterThanOrEqual(20)
  })
})

// ---------------------------------------------------------------------------
// 6) [№21-РАНДОМ] случайный старт потоков
// ---------------------------------------------------------------------------
describe('[№21-РАНДОМ] рандомизация старта спавна', () => {
  it('initialSpawnDelay: случайная доля минимального интервала в границах [4, 45]', () => {
    for (let i = 0; i < 200; i++) {
      const d = initialSpawnDelay(60)
      expect(d).toBeGreaterThanOrEqual(12)   // 60*0.2
      expect(d).toBeLessThanOrEqual(36)      // 60*0.6
    }
    expect(initialSpawnDelay(5)).toBeGreaterThanOrEqual(4)
    expect(initialSpawnDelay(500)).toBeLessThanOrEqual(45)
  })

  const spawnHarness = (randomize: boolean) => {
    const simElements = ref<any[]>([makeWicket(false)])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ ...SCENE })
    const integration = useSimulatorIntegration({
      people: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, fio: `Чел ${i}`, gender: 'male', location: 'В городе' })),
    })
    const simOpts: any = {
      maxGroupSize: 4, maxNonFamily: 1,
      personWidth: PERSON.width, personHeight: PERSON.height,
      carWidth: 80, carHeight: 40,
      carSpawnIntervalMin: 999, carSpawnIntervalMax: 1000,
      autoJournal: false,
      randomizeSpawnStart: randomize,
    }
    const spawn = useSimulatorSpawn(
      simElements as any, aiAgents, sceneSize,
      ref(795), ref(187), ref(635), ref(180),
      integration, ref(simOpts) as any,
    )
    const cfg = {
      enabled: true, intervalMin: 60, intervalMax: 120,
      personSpeed: 40, carSpeed: 100,
      carGateId: '', personGateId: 'wicket-1',
      gateCloseDelay: 10, wicketCloseDelay: 2, maxAgents: 6,
    } as TrafficConfig
    return { spawn, aiAgents, cfg }
  }

  it('randomizeSpawnStart: true — первый пешеход позже 12с и раньше 37с', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // середина диапазона -> 24с
    const s = spawnHarness(true)
    for (let i = 0; i < 23; i++) s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await nextTick()
    expect(s.aiAgents.value.filter((a: any) => a.type === 'person')).toHaveLength(0)
    for (let i = 0; i < 8; i++) s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(s.aiAgents.value.filter((a: any) => a.type === 'person').length).toBeGreaterThan(0)
  })

  it('randomizeSpawnStart: false — прежний детерминизм (первый спавн на 10-й секунде)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const s = spawnHarness(false)
    for (let i = 0; i < 9; i++) s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await nextTick()
    expect(s.aiAgents.value.filter((a: any) => a.type === 'person')).toHaveLength(0)
    s.spawn.updateSpawnLogic(1, s.cfg, true, 6)
    await nextTick()
    await new Promise(r => setTimeout(r, 0))
    expect(s.aiAgents.value.filter((a: any) => a.type === 'person').length).toBeGreaterThan(0)
  })
})
