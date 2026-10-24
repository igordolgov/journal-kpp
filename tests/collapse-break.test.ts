// tests/collapse-break.test.ts
// [№23-КОЛЛАПС] репорт №23: «люди всегда должны пропускать встречных людей
// отходя правее, если это не создаёт ситуацию коллапса» + «люди должны
// быстрее разбираться с коллапсом».
//
// Механика: пара/толпа взаимно замерших (взаимное standingAhead, скорость
// ~0, дрейф «держись правее» отключён его же условием velocity > 0.5)
// копит окна затора (1.2с, нет прогресса <5px); после 2с один из участников
// получает «право прорыва» на 2.5с — идёт своим курсом без уступаний,
// остальные уступают ему штатно (для них он движущийся встречный, №21).
// Затор разрешается за секунды, БЕЗ сторожа-телепорта (10с) и без прохода
// сквозь забор.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'

const DT = 0.1
const SCENE = { width: 1280, height: 720 }
const PERSON = { width: 40, height: 55 }

const makeWicket = () => ({
  id: 'wicket-1', x: 550, y: 100, width: 60, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: true, isAnimating: false, isStopping: false },
  asset: { type: 'svg', content: '<svg/>' },
})

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
    (g: any) => { g.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined,
  )
  return { simElements, aiAgents, sceneSize, physics, warns }
}

const mkWalker = (id: string, cx: number, cy: number, target: { x: number; y: number }, direction: 'enter' | 'exit') => ({
  id,
  element: {
    id, x: cx - PERSON.width / 2, y: cy - PERSON.height / 2, width: PERSON.width, height: PERSON.height,
    rotation: direction === 'enter' ? Math.PI : 0, velocity: 0,
    category: 'human', type: 'actor', direction, settings: {},
  },
  state: 'to_gate',
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: target.x, y: direction === 'enter' ? 900 : 60, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 40, type: 'person', direction, travelMode: 'walk',
  gateId: 'wicket-1',
})

const centerOf = (a: any) => ({
  x: a.element.x + a.element.width / 2,
  y: a.element.y + a.element.height / 2,
})

describe('[№23-КОЛЛАПС] прорыв взаимного затора встречных', () => {
  afterEach(() => vi.restoreAllMocks())

  it('пара нос к носу замерла — прорыв разрешает затор за ~3-4с, без сторожа и без прохода друг сквозь друга', () => {
    const h = buildHarness([makeWicket()])
    // двое на дороге, курсы встречные по одной линии, дистанция 50px между
    // центрами (<54 — окно «стоящий на курсе»): оба стартуют с velocity 0,
    // поэтому каждый видит «стоящего на курсе» и замерзает. Чистый курс —
    // personGateId '' (иначе to_gate-цель каждый тик переписывается на
    // стоп-калитки и пара «размагничивается»).
    const a = mkWalker('p-a', 500, 300, { x: 700, y: 300 }, 'enter')
    const b = mkWalker('p-b', 550, 300, { x: 300, y: 300 }, 'exit')
    h.aiAgents.value = [a as any, b as any]

    // взаимный стоп: оба стоят (standingAhead, скорость 0)
    let frozen = false
    for (let i = 0; i < 10; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
    }
    frozen = (a.element.velocity || 0) < 1 && (b.element.velocity || 0) < 1
    expect(frozen).toBe(true)

    // прорыв: за 4.5с хотя бы один продвинулся к цели (>25px от точки затора)
    const aStart = centerOf(a as any)
    const bStart = centerOf(b as any)
    let minDist = Infinity
    for (let i = 0; i < 45; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: '' })
      const ca = centerOf(a as any)
      const cb = centerOf(b as any)
      minDist = Math.min(minDist, Math.hypot(ca.x - cb.x, ca.y - cb.y))
    }
    const progA = Math.hypot(centerOf(a as any).x - aStart.x, centerOf(a as any).y - aStart.y)
    const progB = Math.hypot(centerOf(b as any).x - bStart.x, centerOf(b as any).y - bStart.y)
    expect(Math.max(progA, progB)).toBeGreaterThan(25)
    expect(h.warns.some(w => w.includes('[collapse-break]'))).toBe(true)
    // корпуса не прошли друг сквозь друга
    expect(minDist).toBeGreaterThan(24)
    // сторож-телепорт не понадобился (разрешение ЗАДОЛОГО до его лимита 10с)
    expect(h.warns.filter(w => w.includes('[watchdog]'))).toEqual([])
  })

  it('закрытая калитка с очередью — НЕ коллапс: прорыв не выдаётся', () => {
    const h = buildHarness([makeWicket()])
    h.simElements.value[0].settings.isOpen = false
    // двое ждут ЗАКРЫТУЮ калитку друг за другом — легальная очередь
    const a = mkWalker('p-a', 580, 300, { x: 580, y: 248 }, 'enter')
    a.state = 'waiting_before'
    const b = mkWalker('p-b', 580, 360, { x: 580, y: 340 }, 'enter')
    b.state = 'waiting_before'
    h.aiAgents.value = [a as any, b as any]
    for (let i = 0; i < 60; i++) { // 6с — дольше порога затора
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'wicket-1' })
    }
    expect(h.warns.some(w => w.includes('[collapse-break]'))).toBe(false)
    expect(a.state).toBe('waiting_before')
    expect(b.state).toBe('waiting_before')
  })
})
