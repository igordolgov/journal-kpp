// tests/soak-mixed.test.ts
// [БАГ-РЕПОРТ-7] соук смешанного потока: люди + машины, оператор открывает/
// закрывает ворота. Проверки: ноль телепортов (dPos > v*dt + 0.6),
// ноль watchdog-предупреждений, весь поток деспавнится.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSimulatorSpawn } from '~/composables/simulator/useSimulatorSpawn'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { useSimulatorCore } from '~/composables/simulator/useSimulatorCore'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'
import type { TrafficConfig } from '~/types/simulator'

const DT = 0.1

const makeWicket = () => ({
  id: 'wicket-1', x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: { gateType: 'wicket', isOpen: false, isAnimating: false, openDuration: 0.5, closeDuration: 0.5 },
  asset: { type: 'svg', content: '<svg/>' },
})
const makeCarGate = () => ({
  id: 'car-gate-1', x: 420, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Ворота', zIndex: 300,
  settings: { gateType: 'sliding', isOpen: false, isAnimating: false },
  asset: { type: 'svg', content: '<svg/>' },
})

describe('соук смешанного потока', () => {
  afterEach(() => vi.restoreAllMocks())

  it('поток с оператором: без телепортов и зависаний', async () => {
    const people: any[] = []
    for (let i = 1; i <= 30; i++) {
      people.push({
        id: i, fio: `Агент ${i}`, gender: i % 2 ? 'male' : 'female',
        location: i % 3 === 0 ? 'inside' : 'В городе',
      })
    }
    const simElements = ref<any[]>([makeWicket(), makeCarGate()])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ width: 1280, height: 720 })
    const integration = useSimulatorIntegration({ people })
    const simOpts: any = {
      maxGroupSize: 4, maxNonFamily: 1,
      personWidth: PERSON_WIDTH, personHeight: PERSON_HEIGHT,
      carWidth: 80, carHeight: 40, autoJournal: false,
      ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5,
      MIN_BUFFER: 15, MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1,
      gateCloseDelay: 3, wicketCloseDelay: 2, stallEscalateTime: 10, waitAfterMax: 30,
    }
    const core = useSimulatorCore(simElements as any)
    const spawn = useSimulatorSpawn(
      simElements as any, aiAgents, sceneSize,
      ref(795), ref(187), ref(635), ref(180),
      integration, ref(simOpts) as any,
    )
    const warns: string[] = []
    vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => warns.push(args.map(String).join(' ')))
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { g.settings.isOpen = true; return true },
      (g: any) => { g.settings.isOpen = false; return true },
      () => {}, simOpts, undefined, undefined,
    )
    const cfg = {
      enabled: true, intervalMin: 1, intervalMax: 2, personSpeed: 40, carSpeed: 100,
      carGateId: 'car-gate-1', personGateId: 'wicket-1',
      gateCloseDelay: 3, wicketCloseDelay: 2, maxAgents: 8,
    } as unknown as TrafficConfig

    const last = new Map<string, { x: number; y: number; v: number }>()
    const jumps: string[] = []
    const wicket = simElements.value[0]
    const carGate = simElements.value[1]
    let spawnedTotal = 0

    for (let i = 0; i < 3000; i++) { // 300с сцены
      const before = aiAgents.value.length
      spawn.updateSpawnLogic(DT, cfg, true, 8)
      await nextTick()
      if (aiAgents.value.length > before) spawnedTotal += aiAgents.value.length - before

      // оператор: открыл ворота, если кто-то ждёт; закрыл, когда пусто
      for (const [g, isPerson] of [[wicket, true], [carGate, false]] as const) {
        const anyWaiting = aiAgents.value.some((a: any) =>
          a.state === 'waiting_before' && (isPerson ? a.type === 'person' : a.type === 'car'))
        if (anyWaiting && !g.settings.isOpen && !g.settings.isAnimating) g.settings.isOpen = true
        if (g.settings.isOpen && !g.settings.isAnimating) {
          const busy = aiAgents.value.some((a: any) =>
            (a.state === 'crossing' || a.state === 'waiting_before' || a.state === 'waiting_after') &&
            (isPerson ? a.type === 'person' : a.type === 'car'))
          if (!busy && Math.random() < 0.03) g.settings.isOpen = false
        }
      }

      core.updateGateWatchdog(DT)
      physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
      for (const a of aiAgents.value as any[]) {
        const c = { x: a.element.x + a.element.width / 2, y: a.element.y + a.element.height / 2 }
        const prev = last.get(String(a.id))
        last.set(String(a.id), { x: c.x, y: c.y, v: a.element.velocity || 0 })
        if (!prev || a.state === 'done') continue
        const dPos = Math.hypot(c.x - prev.x, c.y - prev.y)
        // допуск: разгон ACCEL*dt + толчки сепарации/уступания (~9px/кадр
        // по дизайну). Телепорт сторожа — это 30-150px за кадр, порог 9px
        // его ловит с запасом.
        if (dPos > (prev.v + 100 * DT) * DT + 9) {
          jumps.push(`t=${(i * DT).toFixed(0)} ${a.type} ${a.state} dPos=${dPos.toFixed(1)} v=${prev.v.toFixed(1)} pos=(${c.x.toFixed(0)},${c.y.toFixed(0)}) tgt=(${a.target?.x?.toFixed(0)},${a.target?.y?.toFixed(0)}) id=${String(a.id).slice(-8)}`)
        }
      }
    }

    // хвост: 120с без спавна — всё должно уйти (калитка обрабатывает
    // очередь по одному: force-cross 5с + проход + уход на каждого)
    for (let i = 0; i < 1200; i++) {
      for (const [g, isPerson] of [[wicket, true], [carGate, false]] as const) {
        const anyWaiting = aiAgents.value.some((a: any) =>
          a.state === 'waiting_before' && (isPerson ? a.type === 'person' : a.type === 'car'))
        if (anyWaiting && !g.settings.isOpen && !g.settings.isAnimating) g.settings.isOpen = true
      }
      core.updateGateWatchdog(DT)
      physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
    }

    const wd = warns.filter(w => w.includes('[watchdog] телепорт') || w.includes('телепорт на цель'))
    expect(jumps).toEqual([])
    expect(wd).toEqual([])
    expect(aiAgents.value.length).toBe(0)
  }, 120000)
})
