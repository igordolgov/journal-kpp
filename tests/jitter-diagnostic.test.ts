// tests/jitter-diagnostic.test.ts
// [БАГ-РЕПОРТ-8-ДЁРГАНИЕ] диагностика остаточного «дёргания» людей и машин:
// прогон типовых сцен на 60 fps (DT = 1/60) с метриками плавности на агента:
//  • sinuosity = длина пути / сетка перемещения (1.0 = идеально прямая линия);
//  • реверсы: смены знака осевой скорости движения (зигзаг);
//  • stop-go: циклы «стоишь (<0.5) — поехал (>2) — стоишь» в движущейся фазе.
// Тест печатает таблицу в stdout (диагностика) и asserts пороги — после
// устранения причин они остаются регрессионными.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { CAR_STOP_OFFSET, PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'
import { CAR_EXIT_PULL_PAST } from '~/utils/simulatorTraffic'

const DT = 1 / 60
const SCENE = { width: 1280, height: 720 }
const CAR = { width: 80, height: 40 }

const buildPhysics = (gates: any[], simOpts: any = {}) => {
  const simElements = ref<any[]>(gates)
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ ...SCENE })
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
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
  return { simElements, aiAgents, sceneSize, physics, spy }
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

const makeCarGate = (isOpen = false) => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

const makeWicket = (isOpen = false) => ({
  id: 'w1', x: 600, y: 100, width: 50, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate',
  name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

// геометрия (как в antiteleport): ворота (420,100,320,120) -> центр X=580, дорога F=220
const ROAD_Y = 220 - CAR.height / 2 // 200
const ENTER_STOP = { x: 580, y: ROAD_Y }
const ENTER_CROSS = { x: 580, y: ROAD_Y + CAR_STOP_OFFSET }
const EXIT_CROSS = { x: 580, y: ROAD_Y - CAR_EXIT_PULL_PAST }
// калитка (600,100,50,120): низ 220
const W_ROAD_Y = 220 - PERSON_HEIGHT / 2 // 192.5

interface MotionStat {
  path: number
  net: number
  reversals: number
  stopGo: number
  maxJump: number
  vOsc: number          // число раз, когда |Δv| за кадр > 25 px/с (рывки скорости)
  samples: number
}

const trackMotion = (agents: any[], traceEvery = 0) => {
  const last = new Map<string, { x: number; y: number; v: number; mvx: number; mvy: number; wasMoving: boolean; stopped: boolean }>()
  // метрики ПО ФАЗАМ состояния: L-образный маршрут (подход -> проход -> уход)
  // по определению не прямая, поэтому путь/сеть считаем внутри каждой фазы
  const stats = new Map<string, MotionStat>()
  const phaseStart = new Map<string, { st: string; x: number; y: number }>()
  const perPhase = new Map<string, Record<string, { path: number; sx: number; sy: number }>>()
  for (const a of agents) stats.set(a.id, { path: 0, net: 0, reversals: 0, stopGo: 0, maxJump: 0, vOsc: 0, samples: 0 })
  let frame = 0
  const trace: string[] = []
  return {
    step() {
      frame++
      const doTrace = traceEvery > 0 && frame % traceEvery === 0
      for (const a of agents) {
        if (!a.element) continue
        const s = stats.get(a.id)!
        const cx = a.element.x + a.element.width / 2
        const cy = a.element.y + a.element.height / 2
        const v = Math.abs(a.element.velocity || 0)
        // смена фазы -> закрываем предыдущий отрезок
        const ph = phaseStart.get(a.id)
        if (!ph || ph.st !== a.state) {
          if (ph) {
            const acc = perPhase.get(a.id) ?? {}
            const prev = acc[ph.st] ?? { path: 0, sx: ph.x, sy: ph.y }
            prev.path = s.path // накоплено до смены — приближение, точность достаточна
            acc[ph.st] = prev
            perPhase.set(a.id, acc)
          }
          phaseStart.set(a.id, { st: a.state, x: cx, y: cy })
        }
        const prev = last.get(a.id)
        if (prev) {
          const dx = cx - prev.x, dy = cy - prev.y
          const d = Math.hypot(dx, dy)
          s.path += d
          s.maxJump = Math.max(s.maxJump, d)
          const moving = v > 0.5 && d > 0.01
          if (moving) {
            if (prev.wasMoving) {
              // [№25] реверс осевой составляющей, СУЩЕСТВЕННОЙ для шага:
              // переворот компоненты считается зигзагом, только если она
              // несёт >= 12% длины шага. Субпиксельные переходы через ноль
              // (0.03px при шаге 0.35px почти горизонтального хода) — это
              // гладкая дуга/баланс дрейфа и курса, а не видимое дёргание;
              // раньше они засчитывались и маскировали настоящие зигзаги.
              if (Math.abs(dx) > Math.max(0.03, d * 0.12) && prev.mvx !== 0 && Math.sign(dx) !== Math.sign(prev.mvx)) s.reversals++
              if (Math.abs(dy) > Math.max(0.03, d * 0.12) && prev.mvy !== 0 && Math.sign(dy) !== Math.sign(prev.mvy)) s.reversals++
            }
            prev.mvx = dx; prev.mvy = dy
          }
          if (v - prev.v > 25) s.vOsc++
          // stop-go в движущихся фазах
          const st = a.state
          if (st === 'to_gate' || st === 'crossing' || st === 'moving_away') {
            const nowStopped = v < 0.5
            if (nowStopped && !prev.stopped && prev.v > 2) s.stopGo++
            prev.stopped = nowStopped
          }
        }
        s.samples++
        if (doTrace) trace.push(`t=${(frame * DT).toFixed(1).padStart(5)} ${String(a.id).padEnd(8)} ${a.state.padEnd(13)} x=${cx.toFixed(1).padStart(6)} y=${cy.toFixed(1).padStart(6)} v=${v.toFixed(1).padStart(5)}`)
        last.set(a.id, { x: cx, y: cy, v, mvx: prev?.mvx ?? 0, mvy: prev?.mvy ?? 0, wasMoving: (Math.abs(a.element.velocity || 0) > 0.5), stopped: (Math.abs(a.element.velocity || 0) < 0.5) })
      }
    },
    traceText: () => trace.join('\n'),
    report(): string {
      const rows: string[] = []
      for (const a of agents) {
        const s = stats.get(a.id)!
        rows.push(`${a.id.padEnd(10)} state=${a.state.padEnd(14)} path=${s.path.toFixed(0).padStart(5)} rev=${s.reversals} stopgo=${s.stopGo} vOsc=${s.vOsc} maxJump=${s.maxJump.toFixed(1)}`)
        const ph = perPhase.get(a.id)
        if (ph) {
          for (const [st, p] of Object.entries(ph)) {
            const end = phaseStart.get(a.id)
            const net = st === end?.st
              ? Math.hypot((a.element.x + a.element.width / 2) - p.sx, (a.element.y + a.element.height / 2) - p.sy)
              : NaN
            const sin = Number.isFinite(net) && p.path > 1 ? p.path / Math.max(net, 0.01) : NaN
            rows.push(`   [${st.padEnd(12)}] phaseNet=${Number.isFinite(net) ? net.toFixed(0) : '  ?'} sin=${Number.isFinite(sin) ? sin.toFixed(2) : '?'}`)
          }
        }
      }
      return rows.join('\n')
    },
    stat(id: string): MotionStat & { sinuosity: number } {
      const s = stats.get(id)!
      const agent = agents.find(a => a.id === id)!
      const ph = phaseStart.get(id)
      const start = { x: agent.element.x + agent.element.width / 2, y: agent.element.y + agent.element.height / 2 }
      const net = ph ? Math.hypot(start.x - ph.x, start.y - ph.y) : 0
      return { ...s, net, sinuosity: s.path > 1 && net > 1 ? s.path / net : 1 }
    },
  }
}

describe('диагностика дёргания ([БАГ-РЕПОРТ-8])', () => {
  afterEach(() => vi.restoreAllMocks())

  it('S1: одиночная машина подъезжает к закрытым воротам — плавный разгон/торможение', () => {
    const h = buildPhysics([makeCarGate(false)])
    const car = mkCar('car-e', 'enter', 'to_gate', 1100, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [car]
    const m = trackMotion([car])
    for (let i = 0; i < 20 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      m.step()
      if (car.state === 'waiting_before') break
    }
    console.log('[S1 car->gate]\n' + m.report())
    const s = m.stat('car-e')
    expect(s.sinuosity).toBeLessThan(1.05)
    expect(s.reversals).toBeLessThanOrEqual(1)
    expect(s.stopGo).toBeLessThanOrEqual(1)
  })

  it('S2: встреча машин у ворот (въезд + выезд) — без пилообразных циклов', () => {
    const h = buildPhysics([makeCarGate(false)])
    const exit = mkCar('car-x', 'exit', 'waiting_before',
      580, ROAD_Y + CAR_STOP_OFFSET, { x: 580, y: ROAD_Y + CAR_STOP_OFFSET },
      EXIT_CROSS, { x: 1300, y: EXIT_CROSS.y }, false)
    const enter = mkCar('car-e', 'enter', 'to_gate', 1100, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [enter, exit]
    const m = trackMotion([enter, exit])
    for (let i = 0; i < 30 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      m.step()
    }
    console.log('[S2 meet]\n' + m.report())
    const se = m.stat('car-e')
    expect(se.reversals).toBeLessThanOrEqual(3)
    expect(se.stopGo).toBeLessThanOrEqual(3)
  })

  it('S3: человек подходит к закрытой калитке, калитку открывают — полный цикл', () => {
    const wicket = makeWicket(false)
    const h = buildPhysics([wicket])
    const p = mkPerson('p-in', 'enter', 'to_gate',
      1100, W_ROAD_Y, { x: 625, y: W_ROAD_Y }, { x: 625, y: W_ROAD_Y + 30 }, { x: 625, y: 900 })
    h.aiAgents.value = [p]
    const m = trackMotion([p])
    let opened = false
    for (let i = 0; i < 40 * 60; i++) {
      if (!opened && p.state === 'waiting_before' && i > 5 * 60) {
        wicket.settings.isOpen = true
        opened = true
      }
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      m.step()
      if (p.state === 'done') break
    }
    console.log('[S3 person cycle]\n' + m.report())
    const s = m.stat('p-in')
    expect(s.sinuosity).toBeLessThan(1.12)
    expect(s.reversals).toBeLessThanOrEqual(2)
    expect(s.stopGo).toBeLessThanOrEqual(2)
  })

  it('S4: встреча людей у калитки (вход + выход) — расхождение без дрожи', () => {
    const wicket = makeWicket(true)
    const h = buildPhysics([wicket])
    const pin = mkPerson('p-in', 'enter', 'to_gate',
      1100, W_ROAD_Y, { x: 625, y: W_ROAD_Y }, { x: 625, y: W_ROAD_Y + 30 }, { x: 625, y: 900 })
    const pout = mkPerson('p-out', 'exit', 'to_gate',
      625, 500, { x: 625, y: W_ROAD_Y + 58 }, { x: 625, y: W_ROAD_Y }, { x: 1300, y: W_ROAD_Y })
    h.aiAgents.value = [pin, pout]
    const m = trackMotion([pin, pout], 30)
    for (let i = 0; i < 30 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      m.step()
    }
    console.log('[S4 people meet]\n' + m.report())
    console.log('[S4 trace]\n' + m.traceText())
    const si = m.stat('p-in')
    const so = m.stat('p-out')
    // [БАГ-РЕПОРТ-8] фиксация устранения дёргания: в crossing больше нет
    // бокового танца (дрейф «держись правее» + радиальный толчок давали
    // зигзаг ±2-4px в дверном проёме, 5 реверсов за проход). Проход — по
    // прямой, допускаем не более 1 реверса на стыках фаз.
    expect(si.reversals).toBeLessThanOrEqual(2)
    expect(so.reversals).toBeLessThanOrEqual(1)
  })

  it('S6: машина-последователь за стоящей у ворот — один плавный подъезд без серий старт-стоп', () => {
    const h = buildPhysics([makeCarGate(false)])
    // лидер уже стоит на своей остановке (waiting_before), последователь едет по дороге
    const leader = mkCar('car-lead', 'enter', 'waiting_before',
      580, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    const follower = mkCar('car-fol', 'enter', 'to_gate', 1000, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [leader, follower]
    const m = trackMotion([leader, follower], 30)
    for (let i = 0; i < 20 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      m.step()
      if ((follower.element.velocity || 0) === 0 && follower.state === 'to_gate' && i > 6 * 60) break
    }
    console.log('[S6 car follow]\n' + m.report())
    console.log('[S6 trace]\n' + m.traceText())
    const s = m.stat('car-fol')
    // одна остановка за подъезд: серия разгонов/торможений = дёргание
    expect(s.stopGo).toBeLessThanOrEqual(1)
    expect(s.reversals).toBe(0)
  })

  it('S7: второй человек подходит к стоящему у закрытой калитки — плавный подъезд', () => {
    const wicket = makeWicket(false)
    const h = buildPhysics([wicket])
    const first = mkPerson('p-1', 'enter', 'waiting_before',
      625, W_ROAD_Y, { x: 625, y: W_ROAD_Y }, { x: 625, y: W_ROAD_Y + 30 }, { x: 625, y: 900 })
    const second = mkPerson('p-2', 'enter', 'to_gate',
      1000, W_ROAD_Y, { x: 625, y: W_ROAD_Y }, { x: 625, y: W_ROAD_Y + 30 }, { x: 625, y: 900 })
    h.aiAgents.value = [first, second]
    const m = trackMotion([first, second], 30)
    for (let i = 0; i < 25 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      m.step()
      if ((second.element.velocity || 0) === 0 && i > 10 * 60) break
    }
    console.log('[S7 person queue]\n' + m.report())
    console.log('[S7 trace]\n' + m.traceText())
    const s = m.stat('p-2')
    expect(s.stopGo).toBeLessThanOrEqual(1)
    expect(s.reversals).toBeLessThanOrEqual(1)
  })

  it('S5: колонна из 3 человек к закрытой калитке — следование без старт-стопа', () => {
    const wicket = makeWicket(false)
    const h = buildPhysics([wicket])
    const mk = (i: number) => mkPerson(`p-${i}`, 'enter', 'to_gate',
      1100 + i * 70, W_ROAD_Y, { x: 625 + i * 46, y: W_ROAD_Y }, { x: 625 + i * 46, y: W_ROAD_Y + 30 }, { x: 625 + i * 46, y: 900 })
    const people = [mk(0), mk(1), mk(2)]
    h.aiAgents.value = people
    const m = trackMotion(people)
    for (let i = 0; i < 25 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      m.step()
    }
    console.log('[S5 column]\n' + m.report())
    for (const p of people) {
      const s = m.stat(p.id)
      expect(s.stopGo).toBeLessThanOrEqual(2)
      expect(s.reversals).toBeLessThanOrEqual(2)
    }
  })

  // [№10-РЫВОК-ДОТЯГИВАНИЯ] заказчик локализовал остаточное дёргание на
  // финальном дотягивании к точке останова. Регрессия профиля торможения:
  //  • скорость в тормозном окне (dist < 80) монотонно НЕ растёт;
  //  • изменение скорости за кадр не больше физического торможения
  //    (DECEL*2 = 200 px/с^2 -> ~3.4 px/с за кадр при 60 fps);
  //  • шаг позиции за кадр не длиннее velocity*dt (нет прыжков);
  //  • в окне дотягивания нет старт-стопа (скорость > 0 до самой посадки).
  it('S8: дотягивание машины к остановке — монотонный профиль без скачков', () => {
    const h = buildPhysics([makeCarGate(false)])
    const car = mkCar('car-e', 'enter', 'to_gate', 1100, ROAD_Y, ENTER_STOP, ENTER_CROSS, { x: 580, y: 900 }, true)
    h.aiAgents.value = [car]
    let maxDv = 0
    let vIncrease = 0
    let maxStepExcess = 0
    let prevV = Infinity
    let prevPos = { x: car.element.x + 40, y: car.element.y + 20 }
    let brakingFrames = 0
    for (let i = 0; i < 30 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: '' })
      const cx = car.element.x + 40
      const cy = car.element.y + 20
      const t = car.target
      const dist = Math.hypot(t.x - cx, t.y - cy)
      const v = car.element.velocity || 0
      if (dist < 80 && car.state === 'to_gate') {
        brakingFrames++
        if (prevV !== Infinity) {
          maxDv = Math.max(maxDv, Math.abs(v - prevV))
          if (v > prevV + 0.6) vIncrease++
        }
        maxStepExcess = Math.max(maxStepExcess, Math.hypot(cx - prevPos.x, cy - prevPos.y) - v * DT)
      }
      prevV = v
      prevPos = { x: cx, y: cy }
      if (car.state !== 'to_gate') break
    }
    console.log(`[S8 car] brakingFrames=${brakingFrames} maxDv=${maxDv.toFixed(2)} vIncrease=${vIncrease} stepExcess=${maxStepExcess.toFixed(4)}`)
    expect(brakingFrames).toBeGreaterThan(10)
    expect(maxDv).toBeLessThanOrEqual(200 * DT + 1.5)
    expect(vIncrease).toBe(0)
    expect(maxStepExcess).toBeLessThanOrEqual(0.01)
  })

  it('S9: дотягивание человека к калитке — монотонный профиль без скачков', () => {
    const wicket = makeWicket(false)
    const h = buildPhysics([wicket])
    const p = mkPerson('p-in', 'enter', 'to_gate',
      1100, W_ROAD_Y, { x: 625, y: W_ROAD_Y }, { x: 625, y: W_ROAD_Y + 30 }, { x: 625, y: 900 })
    h.aiAgents.value = [p]
    let maxDv = 0
    let vIncrease = 0
    let maxStepExcess = 0
    let prevV = Infinity
    let prevPos = { x: p.element.x + 20, y: p.element.y + 27.5 }
    let brakingFrames = 0
    for (let i = 0; i < 30 * 60; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w1' })
      const cx = p.element.x + 20
      const cy = p.element.y + 27.5
      const t = p.target
      const dist = Math.hypot(t.x - cx, t.y - cy)
      const v = p.element.velocity || 0
      if (dist < 80 && p.state === 'to_gate') {
        brakingFrames++
        if (prevV !== Infinity) {
          maxDv = Math.max(maxDv, Math.abs(v - prevV))
          if (v > prevV + 0.6) vIncrease++
        }
        maxStepExcess = Math.max(maxStepExcess, Math.hypot(cx - prevPos.x, cy - prevPos.y) - v * DT)
      }
      prevV = v
      prevPos = { x: cx, y: cy }
      if (p.state !== 'to_gate') break
    }
    console.log(`[S9 person] brakingFrames=${brakingFrames} maxDv=${maxDv.toFixed(2)} vIncrease=${vIncrease} stepExcess=${maxStepExcess.toFixed(4)}`)
    expect(brakingFrames).toBeGreaterThan(10)
    expect(maxDv).toBeLessThanOrEqual(200 * DT + 1.5)
    expect(vIncrease).toBe(0)
    expect(maxStepExcess).toBeLessThanOrEqual(0.01)
  })
})
