// tests/post-gate-cap.test.ts
// [ФИКС-висяки-3] Регрессии остаточных зависаний ПОСЛЕ прохода:
//  1) взаимная блокировка: два СТОЯЩИХ агента одного направления стоят
//     в конусах друг друга (пересекающиеся цели) — раньше каждый был
//     «очередью за своим» и сторож не спасал никого вечно; теперь
//     законное ожидание — только за движущимся или ждущим у прохода;
//  2) предохранитель post-gate: агент в moving_away, которого сторож
//     не спасает из-за легитимной очереди (waiting_before в конусе),
//     принудительно завершается по лимиту суммарного времени
//     crossing + moving_away (simOpts.postGateMax).

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import type { AiAgent } from '~/types/simulator'

const DT = 0.1

const buildPhysics = (gates: any[], opts: any = {}) => {
  const simElements = ref<any[]>(gates)
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const simOpts = {
    ACCEL: 100,
    DECEL: 100,
    REACTION_TIME: 1.5,
    MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220,
    ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 10,
    wicketCloseDelay: 2,
    stallEscalateTime: opts.stallEscalateTime ?? 10,
    postGateMax: opts.postGateMax,
  }
  const physics = useSimulatorPhysics(
    simElements as any, aiAgents, sceneSize,
    (g: any) => { g.settings.isOpen = true; return true },
    (g: any) => { g.settings.isOpen = false; return true },
    () => {},
    simOpts,
    undefined,
    undefined
  )
  return { simElements, aiAgents, sceneSize, physics }
}

const runFrames = (p: ReturnType<typeof buildPhysics>['physics'], seconds: number, cfg: any) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    p.updateAiMovement(DT, cfg)
  }
}

const makePersonAgent = (id: string, el: { x: number; y: number }, state: any, target: { x: number; y: number }, after: { x: number; y: number }, direction: 'enter' | 'exit' = 'enter'): AiAgent => ({
  id,
  element: {
    id, x: el.x, y: el.y, width: 40, height: 55,
    rotation: 0, velocity: 0, category: 'human', type: 'actor',
    name: 'тест', direction,
  } as any,
  state,
  target: { x: target.x, y: target.y, width: 0, height: 0 },
  afterTarget: { x: after.x, y: after.y, width: 0, height: 0 },
  exitPoint: { x: target.x, y: target.y, width: 0, height: 0 },
  speed: 0, // стоит на месте: взаимный стак / легитимная очередь
  type: 'person', direction, travelMode: 'walk',
})

describe('остаточные зависания после ворот ([ФИКС-висяки-3])', () => {
  it('два стоящих агента в конусах друг друга взаимно спасаются и деспавнятся', () => {
    const { aiAgents, physics } = buildPhysics([])
    // A: центр (500,500), цель (700,500) — направление +x
    const a = makePersonAgent('a', { x: 480, y: 473 }, 'crossing', { x: 700, y: 500 }, { x: 900, y: 500 })
    // B: центр (560,500) — впереди A в конусе (f=60<80, |cross|=0),
    // цель (400,500) — направление -x, A впереди B в его конусе
    const b = makePersonAgent('b', { x: 540, y: 473 }, 'crossing', { x: 400, y: 500 }, { x: 100, y: 500 })
    aiAgents.value.push(a, b)

    runFrames(physics, 60, { carGateId: '', personGateId: '' })

    // Оба спасены сторожем (стоящий напарник больше не «законная очередь»):
    // телепорт на цель -> moving_away -> телепорт на afterTarget -> done
    expect(aiAgents.value.length).toBe(0)
  })

  it('очередь за ждущим у закрытых ворот не толкается, но post-gate лимит завершает стоящего', () => {
    const closedWicket = {
      id: 'wicket-1', x: 760, y: 100, width: 80, height: 120,
      rotation: 0, velocity: 0, category: 'gate', type: 'gate',
      name: 'Калитка', zIndex: 300,
      settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
    }
    // postGateMax=5с — ускоренный лимит для теста (по умолчанию 90с)
    const { aiAgents, physics } = buildPhysics([closedWicket], { postGateMax: 5 })
    // A: moving_away, стоит (speed 0), цель (700,500); в его конусе — B
    const a = makePersonAgent('a', { x: 600, y: 473 }, 'moving_away', { x: 700, y: 500 }, { x: 900, y: 500 })
    // B: waiting_before у ЗАКРЫТОЙ калитки — легитимное вечное ожидание,
    // для A это «законная очередь» — сторож его не телепортирует
    const b = makePersonAgent('b', { x: 640, y: 473 }, 'waiting_before', { x: 660, y: 500 }, { x: 660, y: 500 })
    aiAgents.value.push(a, b)

    runFrames(physics, 30, { carGateId: '', personGateId: 'wicket-1' })

    // A завершён предохранителем post-gate (5с) и деспавнен,
    // B остался ждать открытия калитки
    expect(aiAgents.value.length).toBe(1)
    expect(aiAgents.value[0]!.id).toBe('b')
    expect(aiAgents.value[0]!.state).toBe('waiting_before')
  })
})
