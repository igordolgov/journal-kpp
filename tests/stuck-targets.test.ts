// tests/stuck-targets.test.ts
// [ФИКС-висяки-2] Регрессии застревания ПОСЛЕ прохода через ворота:
//  1) осцилляция вокруг цели crossing (шаг кадра > ARRIVE_THRESHOLD):
//     агент обязан прибыть, а не дрожать вечно — на старом коде дистанция
//     циклится (5 -> 3 -> 1 -> 1 -> ...) и никогда не опускается ниже 1px;
//  2) машина в waiting_after при НИКОГДА не закрывающихся воротах —
//     уезжает по страховочному таймауту (closeDelay + 15с);
//  3) waiting_before при исчезнувших воротах — принудительный проход (5с);
//  4) NaN-цель в moving_away — watchdog восстанавливает цель из afterTarget.

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import type { AiAgent } from '~/types/simulator'

// Крупный шаг кадра — как при лагах Electron (кап gameLoop = 0.1с).
const DT = 0.1

const buildPhysics = (gates: any[], opts: any = {}) => {
  const simElements = ref<any[]>(gates)
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const simOpts = {
    ACCEL: opts.ACCEL ?? 100,
    DECEL: opts.DECEL ?? 100,
    REACTION_TIME: 1.5,
    MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220,
    ARRIVE_THRESHOLD: 1,
    gateCloseDelay: opts.gateCloseDelay ?? 10,
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

const runFrames = (p: ReturnType<typeof buildPhysics>['physics'], seconds: number, cfg: any) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    p.updateAiMovement(DT, cfg)
  }
}

describe('застревания после ворот ([ФИКС-висяки-2])', () => {
  it('агент прибывает к цели crossing, а не дрожит вокруг неё (шаг кадра > порога)', () => {
    // ACCEL/DECEL = 0: скорость строго постоянна => шаг s = 20 * 0.1 = 2px
    // (в float точно 2). Дистанция до цели 5: 5 -> 3 -> 1 -> |1-2| = 1 ...
    // на старом коде dist навсегда застревает в цикле {1} — дист < 1 никогда.
    const { aiAgents, physics } = buildPhysics([], { ACCEL: 0, DECEL: 0 })
    const el: any = {
      id: 'p1', x: 0, y: 100, width: 40, height: 55,
      rotation: 0, velocity: 20, category: 'human', type: 'actor',
      name: 'тест', direction: 'exit',
    }
    const agent: AiAgent = {
      id: 'p1', element: el, state: 'crossing',
      target: { x: 25, y: 100, width: 0, height: 0 },   // центр цели в 5px
      afterTarget: { x: 205, y: 100, width: 0, height: 0 },
      exitPoint: { x: 25, y: 100, width: 0, height: 0 },
      speed: 20, type: 'person', direction: 'exit', travelMode: 'walk',
    }
    aiAgents.value.push(agent)

    runFrames(physics, 12, { carGateId: '', personGateId: '' })

    // Прибыл -> moving_away -> дошёл до afterTarget -> done -> деспавн
    expect(aiAgents.value.length).toBe(0)
  })

  it('машина уезжает из waiting_after, даже если ворота так и не закрылись', () => {
    const barrier = {
      id: 'barrier-1', x: 600, y: 100, width: 320, height: 120,
      rotation: 0, velocity: 0, category: 'barrier', type: 'gate',
      name: 'Шлагбаум', zIndex: 300,
      settings: { gateType: 'sliding', isOpen: true, isAnimating: false },
    }
    const { aiAgents, simElements, physics } = buildPhysics([barrier])
    const el: any = {
      id: 'c1', x: 635, y: 238, width: 80, height: 40,
      rotation: 0, velocity: 0, category: 'car', type: 'actor',
      name: 'а123вс', direction: 'enter',
    }
    simElements.value.push(el)
    const agent: AiAgent = {
      id: 'c1', element: el, state: 'waiting_after',
      target: { x: 635, y: 238, width: 0, height: 0 },
      afterTarget: { x: 635, y: 2720, width: 0, height: 0 },
      exitPoint: { x: 635, y: 238, width: 0, height: 0 },
      speed: 100, type: 'car', direction: 'enter', travelMode: 'car',
    }
    aiAgents.value.push(agent)

    // gateCloseDelay=10 => страховка на 25с; 40с хватает с запасом
    // (таймаут + проезд за край + деспавн)
    runFrames(physics, 40, { carGateId: 'barrier-1', personGateId: '' })

    expect(aiAgents.value.length).toBe(0)
  })

  it('waiting_before при исчезнувших воротах — принудительный проход через 5с', () => {
    const { aiAgents, simElements, physics } = buildPhysics([]) // ворот нет
    const el: any = {
      id: 'p1', x: 775, y: 187, width: 40, height: 55,
      rotation: 0, velocity: 0, category: 'human', type: 'actor',
      name: 'тест', direction: 'enter',
    }
    simElements.value.push(el)
    const agent: AiAgent = {
      id: 'p1', element: el, state: 'waiting_before',
      target: { x: 795, y: 187, width: 0, height: 0 },
      afterTarget: { x: 795, y: 1220, width: 0, height: 0 },
      exitPoint: { x: 795, y: 265, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
    }
    aiAgents.value.push(agent)

    runFrames(physics, 40, { carGateId: '', personGateId: 'wicket-missing' })

    expect(aiAgents.value.length).toBe(0)
  })

  it('watchdog восстанавливает NaN-цель — агент деспавнится', () => {
    const { aiAgents, physics } = buildPhysics([])
    const el: any = {
      id: 'p2', x: 500, y: 400, width: 40, height: 55,
      rotation: 0, velocity: 0, category: 'human', type: 'actor',
      name: 'тест', direction: 'enter',
    }
    const agent: AiAgent = {
      id: 'p2', element: el, state: 'moving_away',
      target: { x: NaN, y: NaN, width: 0, height: 0 },
      afterTarget: { x: 700, y: 400, width: 0, height: 0 },
      exitPoint: { x: 500, y: 400, width: 0, height: 0 },
      speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
    }
    aiAgents.value.push(agent)

    runFrames(physics, 20, { carGateId: '', personGateId: '' })

    expect(aiAgents.value.length).toBe(0)
  })
})
