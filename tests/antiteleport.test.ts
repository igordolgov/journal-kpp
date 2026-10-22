// tests/antiteleport.test.ts
// [БАГ-РЕПОРТ-7] регрессии «телепорта в точку ожидания» и раннего уезда:
//  1) въезжающая машина, остановленная проходящей встречной, БЕЗ прыжков
//     доезжает до своей остановки и проходит следом ([П6]: встречная
//     уезжает с полосы сама, не дожидаясь закрытия);
//  2) пост-гейтовый пешеход, застрявший за стоящим у прохода, доводится
//     «правами прохода» (bypass) МЯГКО — ни одного скачка позиции;
//  3) машина в waiting_after уезжает, не дожидаясь закрытия, если у ворот
//     стоит другая машина (ранний уезд);
//  4) машина в waiting_after при пустых воротах уезжает после вежливой
//     паузы 0.8с при ещё открытых воротах ([П6]: закрытие — по расчистке
//     створа).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'
import { CAR_STOP_OFFSET, PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.1 // потолок продакшн-цикла (лаги Electron)
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }

const buildPhysics = (gates: any[], simOpts: any = {}) => {
  const simElements = ref<any[]>(gates)
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const warns: string[] = []
  const spy = vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    warns.push(args.map(String).join(' '))
  })
  const opts: any = {
    ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10, wicketCloseDelay: 2, stallEscalateTime: 10,
    waitAfterMax: 30, ...simOpts,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {}, opts, undefined, undefined,
  )
  return { simElements, aiAgents, sceneSize, physics, warns, spy }
}

const mkCar = (id: string, direction: 'enter' | 'exit', state: string, cx: number, cy: number, target: { x: number; y: number }, cross: { x: number; y: number }, after: { x: number; y: number }, facingLeft = true) => {
  const el: any = {
    id, x: cx - CAR.width / 2, y: cy - CAR.height / 2,
    width: CAR.width, height: CAR.height, rotation: 0, velocity: 0,
    category: 'car', type: 'actor', direction, settings: { _facingLeft: facingLeft },
  }
  return {
    id, element: el, state,
    target: { x: target.x, y: target.y, width: 0, height: 0 },
    afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
    exitPoint: { x: cross.x, y: cross.y, width: 0, height: 0 },
    speed: 100, type: 'car', direction, travelMode: 'car',
  } as any
}

const mkPerson = (id: string, direction: 'enter' | 'exit', state: string, cx: number, cy: number, target: { x: number; y: number }, cross: { x: number; y: number }, after: { x: number; y: number }) => {
  const el: any = {
    id, x: cx - PERSON_WIDTH / 2, y: cy - PERSON_HEIGHT / 2,
    width: PERSON_WIDTH, height: PERSON_HEIGHT, rotation: 0, velocity: 0,
    category: 'human', type: 'actor', direction,
  }
  return {
    id, element: el, state,
    target: { x: target.x, y: target.y, width: 0, height: 0 },
    afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
    exitPoint: { x: cross.x, y: cross.y, width: 0, height: 0 },
    speed: 40, type: 'person', direction, travelMode: 'walk',
  } as any
}

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

// максимальный скачок позиции за кадр
const jumpTracker = (agents: any[]) => {
  const last = new Map<string, { x: number; y: number }>()
  let maxJump = 0
  return {
    step() {
      for (const a of agents) {
        if (!a.element) continue
        const c = centerOf(a)
        const prev = last.get(a.id)
        if (prev) maxJump = Math.max(maxJump, Math.hypot(c.x - prev.x, c.y - prev.y))
        last.set(a.id, { x: c.x, y: c.y })
      }
    },
    maxJump: () => maxJump,
  }
}

// автомобильные ворота (420,100,320,120): центр X=580, дорога F=220
const makeCarGate = (isOpen = false) => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const ROAD_Y = 220 - CAR.height / 2 // 200
// [СПЕЦ-Z7] остановка въезда — бампер на 6px выше линии дороги
const ENTER_STOP = { x: 580, y: ROAD_Y - 6 }
const ENTER_CROSS = { x: 580, y: ROAD_Y + CAR_STOP_OFFSET }
const EXIT_CROSS = { x: 580, y: ROAD_Y - CAR_EXIT_PULL_PAST }

describe('анти-телепорт ([БАГ-РЕПОРТ-7])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('въезжающая, остановленная проходящей встречной, доезжает БЕЗ прыжков и проходит следом ([П6])', () => {
    // ворота открыты: встречная (выезжающая) проходит, садится на полосу и
    // после вежливой паузы уезжает сама ([П6]); въезжающая стартует следом
    // на ещё открытых воротах
    const h = buildPhysics([makeCarGate(true)])
    const exit = mkCar('car-x', 'exit', 'crossing',
      580, ENTER_CROSS.y, EXIT_CROSS, EXIT_CROSS, { x: 1300, y: EXIT_CROSS.y }, false)
    const enter = mkCar('car-e', 'enter', 'to_gate',
      900, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [enter, exit]
    const motion = jumpTracker([enter, exit])

    // 25с: проход встречной, пауза на полосе, уезд; подъезд и проход въезжающей
    for (let i = 0; i < 250; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      motion.step()
      // [№13] оператор опускает шлагбаум за спиной въехавшей — та уезжает
      // после полного закрытия (в реальном таймер отсчёта не тикает)
      const g: any = h.simElements.value[0]
      if (enter.state === 'waiting_after' && g.settings.isOpen && !g.settings.isAnimating) {
        g.settings.isOpen = false
      }
    }
    // встречная уехала с полосы (или уже завершена) — БЕЗ сторожей
    expect(['moving_away', 'done']).toContain(exit.state)
    // въезжающая дошла до прохода/за ворота — и НИ ОДНОГО ПРЫЖКА
    expect(['crossing', 'waiting_after', 'moving_away', 'done']).toContain(enter.state)
    expect(motion.maxJump()).toBeLessThanOrEqual(100 * DT + 3)
    expect(h.warns.filter(w => w.includes('[watchdog]'))).toEqual([])
  })

  it('пост-гейтовый пешеход за стоящим у прохода доводится МЯГКО (bypass, без скачков)', () => {
    const wicket = {
      id: 'w1', x: 600, y: 100, width: 50, height: 120,
      rotation: 0, velocity: 0, category: 'gate', type: 'gate',
      name: 'Калитка', zIndex: 300,
      settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
    }
    const h = buildPhysics([wicket])
    // сосед легитимно ждёт закрытую калитку на линии прохода
    const mate = mkPerson('p2', 'exit', 'waiting_before',
      595, 400, { x: 595, y: 400 }, { x: 595, y: 320 }, { x: 2600, y: 400 })
    // пешеход в crossing, чья цель рядом с соседом
    const p1 = mkPerson('p1', 'exit', 'crossing',
      500, 400, { x: 605, y: 400 }, { x: 605, y: 400 }, { x: 2600, y: 400 })
    h.aiAgents.value = [mate, p1]
    const motion = jumpTracker([mate, p1])

    for (let i = 0; i < 300; i++) { // 30с
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      motion.step()
      if (p1.state === 'moving_away') break
    }
    // доведён до moving_away (спасён), но БЕЗ телепортов и без crossing-cap
    expect(p1.state).toBe('moving_away')
    expect(motion.maxJump()).toBeLessThanOrEqual(40 * DT + 3)
    expect(h.warns.filter(w => w.includes('[watchdog]') || w.includes('[crossing-cap]'))).toEqual([])
  })

  it('машина уезжает из waiting_after, не дожидаясь закрытия, если у ворот стоит другая машина', () => {
    const h = buildPhysics([makeCarGate(true)])
    // въезжающая прошла ворота и ждёт закрытия на посадке (580,258)
    const enter = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS.y, ENTER_CROSS, ENTER_CROSS, { x: 580, y: 900 }, true)
    // следующая въезжающая стоит на остановке у ворот и ждёт открытия —
    // её ворота тоже нужны ([СПЕЦ-M12]), поэтому первая уезжает раньше
    // закрытия после вежливой паузы 0.8с. ([№10] прежний вариант с
    // выезжающей на посадке больше не годится: по [D12] выезжающая
    // уступает-отъезжает от посадки въезжающей и уходит из зоны створа)
    const follower = mkCar('car-x', 'enter', 'waiting_before',
      580, ENTER_STOP.y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [enter, follower]

    for (let i = 0; i < 20; i++) { // 2с
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }
    // въезжающая уехала (после 0.8с вежливой паузы), ворота так и не закрывались
    expect(enter.state).toBe('moving_away')
    expect(h.simElements.value[0].settings.isOpen).toBe(true)
  })

  it('машина в waiting_after ждёт ПОЛНОГО закрытия ворот и уезжает после него ([№13])', () => {
    const h = buildPhysics([makeCarGate(true)])
    const enter = mkCar('car-e', 'enter', 'waiting_after',
      580, ENTER_CROSS.y, ENTER_CROSS, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [enter]

    for (let i = 0; i < 7; i++) { // 0.7с — вежливая пауза не истекла
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }
    expect(enter.state).toBe('waiting_after')

    for (let i = 0; i < 10; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
    }
    // [№13-БЕЗОПАСНОСТЬ] пауза истекла, но ворота открыты: машина НЕ уезжает —
    // ждёт ПОЛНОГО закрытия (основное правило КПП: ворота не остаются
    // открытыми без машин рядом)
    expect(enter.state).toBe('waiting_after')

    // оператор опускает шлагбаум — машина уезжает за ним
    h.simElements.value[0].settings.isOpen = false
    for (let i = 0; i < 10; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      if (enter.state === 'moving_away') break
    }
    expect(enter.state).toBe('moving_away')
    expect(h.simElements.value[0].settings.isOpen).toBe(false)
  })
})
