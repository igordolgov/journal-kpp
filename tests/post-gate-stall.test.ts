// tests/post-gate-stall.test.ts
// [ФИКС-застыл-калитка] регрессии 6-го витка зависаний «вошёл и замер
// после калитки»:
//  1) пешеход, застрявший в crossing ПОЗАДИ стоящего у закрытой калитки
//     «своего» (на старом коде легитимный mateAhead сбрасывал сторожа
//     вечно), доводится лимитом crossing (15с пешеход / 25с машина);
//  2) в moving_away исключение «очереди за своим» больше не действует —
//     стоящий после прохода агент спасается сторожем (10с), а не ждёт
//     вечно, пока «идущий впереди» не покинет конус.

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import type { AiAgent } from '~/types/simulator'

// Крупный шаг кадра — как при лагах Electron (кап gameLoop = 0.1с).
const DT = 0.1

const buildPhysics = () => {
  // Закрытая калитка: mate у неё штатно стоит в waiting_before вечно
  // (gateOpenIdle = false => force-cross не срабатывает), velocity 0.
  const closedWicket = {
    id: 'w1', x: 600, y: 100, width: 50, height: 120,
    rotation: 0, velocity: 0, category: 'gate', type: 'gate',
    name: 'Калитка', zIndex: 300,
    settings: { gateType: 'wicket', isOpen: false, isAnimating: false },
  }
  const simElements = ref<any[]>([closedWicket])
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
    wicketCloseDelay: 0,
    stallEscalateTime: 10,
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

const runFrames = (physics: ReturnType<typeof buildPhysics>['physics'], seconds: number, cfg: any) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    physics.updateAiMovement(DT, cfg)
  }
}

// «Сосед-очередь»: стоит в waiting_before у закрытой калитки внутри конуса
// движения тестируемого агента (на старом коде — легитимный mateAhead).
const makeBlockedMate = (id: string, cx: number, cy: number): AiAgent => {
  const el: any = {
    id, x: cx - 20, y: cy - 27, width: 40, height: 55,
    rotation: 0, velocity: 0, category: 'human', type: 'actor',
    name: 'сосед', direction: 'exit',
  }
  const agent: AiAgent = {
    id, element: el, state: 'waiting_before',
    target: { x: cx, y: cy, width: 0, height: 0 },
    afterTarget: { x: cx + 2000, y: cy, width: 0, height: 0 },
    exitPoint: { x: cx, y: cy - 80, width: 0, height: 0 },
    speed: 40, type: 'person', direction: 'exit', travelMode: 'walk',
  }
  return agent
}

describe('застыл после калитки ([ФИКС-застыл-калитка])', () => {
  it('пешеход, вставший в crossing позади ждущего у закрытой калитки, доводится за лимит crossing (15с)', () => {
    const { aiAgents, physics } = buildPhysics()
    // сосед в 60px впереди по ходу: агент подтянется и встанет за ним
    aiAgents.value.push(makeBlockedMate('p2', 595, 400))

    const el: any = {
      id: 'p1', x: 500, y: 373, width: 40, height: 55,
      rotation: 0, velocity: 0, category: 'human', type: 'actor',
      name: 'тест', direction: 'exit',
    }
    const agent: AiAgent = {
      id: 'p1', element: el, state: 'crossing',
      target: { x: 605, y: 400, width: 0, height: 0 },
      afterTarget: { x: 2600, y: 400, width: 0, height: 0 },
      exitPoint: { x: 605, y: 400, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'exit', travelMode: 'walk',
    }
    aiAgents.value.push(agent)

    const cfg = { carGateId: '', personGateId: 'w1' }
    // 5с: оба кода ещё в crossing (подход + стоянка за соседом)
    runFrames(physics, 5, cfg)
    expect(agent.state).toBe('crossing')

    // суммарно 30с. Новая логика: сторож (10с, без исключения post-gate)
    // или лимит crossing (15с) доводят агента до moving_away.
    // Старая логика: mateAhead сбрасывает сторожа, post-gate лимит (90с)
    // ещё далеко — агент всё ещё в crossing.
    runFrames(physics, 25, cfg)
    expect(agent.state).toBe('moving_away')
  })

  it('стоящий в moving_away позади ждущего у калитки спасается сторожем (исключение очереди — только to_gate)', () => {
    const { aiAgents, physics } = buildPhysics()
    aiAgents.value.push(makeBlockedMate('p2', 582, 400))

    const el: any = {
      id: 'p1', x: 500, y: 373, width: 40, height: 55,
      rotation: 0, velocity: 0, category: 'human', type: 'actor',
      name: 'тест', direction: 'exit',
    }
    const agent: AiAgent = {
      id: 'p1', element: el, state: 'moving_away',
      target: { x: 900, y: 400, width: 0, height: 0 },
      afterTarget: { x: 900, y: 400, width: 0, height: 0 },
      exitPoint: { x: 605, y: 400, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'exit', travelMode: 'walk',
    }
    aiAgents.value.push(agent)

    const cfg = { carGateId: '', personGateId: 'w1' }
    // Новая логика: агент подтягивается к соседу, встаёт, через 10с сторож
    // телепортирует его на target -> прибытие -> done -> деспавн.
    // Старая логика: waiting_before-сосед = легитимный mateAhead, сторож
    // сбрасывается вечно, post-gate лимит (90с) не истёк за 30с — агент жив.
    runFrames(physics, 30, cfg)
    expect(aiAgents.value.find(a => a.id === 'p1')).toBeUndefined()
  })
})
