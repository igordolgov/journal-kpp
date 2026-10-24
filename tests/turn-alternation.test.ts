// tests/turn-alternation.test.ts
// [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] Регрессионные тесты очерёдности у прохода:
//  1) выходящий ждёт, пока входящий не пройдёт калитку и не освободит зону;
//  2) взаимная блокировка двух направлений разрешается по FCFS (первым идёт
//     пришедший раньше) — нет вечного стояния обоих;
//  3) предохранитель DIR_BLOCK_MAX: встречный поток, зависший в проходе,
//     не блокирует агента дольше 25с;
//  4) машина: въезжающая проходит через ворота раньше выезжающей; при [П6]
//     ворота НЕ закрываются, пока выезжающая ждёт в створе/очереди (створ
//     чист + нет очереди — условие закрытия), въехавшая уезжает со двора,
//     выезжающая проходит на ещё открытых воротах.
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { PERSON_WIDTH, PERSON_HEIGHT, CAR_WIDTH, CAR_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.05

const makeWicket = (isOpen: boolean) => ({
  id: 'wicket-1',
  x: 760, y: 100, width: 80, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Калитка',
  zIndex: 300,
  settings: {
    gateType: 'wicket',
    isOpen,
    isAnimating: false,
    openDuration: 0.5,
    closeDuration: 0.5,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

const makeCarGate = (isOpen: boolean) => ({
  id: 'car-gate-1',
  x: 600, y: 100, width: 320, height: 120,
  rotation: 0, velocity: 0,
  category: 'gate', type: 'gate', name: 'Ворота',
  zIndex: 300,
  settings: {
    gateType: 'sliding',
    isOpen,
    isAnimating: false,
    openDuration: 0.5,
    closeDuration: 0.5,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

// Агенты конструируются вручную: физике не нужен спавн, нужны element/state/
// target/afterTarget/exitPoint. Позиции подобраны вокруг калитки (центр 800,160).
const mkPerson = (id: string, direction: 'enter' | 'exit', x: number, y: number, extra: any = {}) => ({
  id,
  element: { id, x, y, width: PERSON_WIDTH, height: PERSON_HEIGHT, rotation: 0, velocity: 0, zIndex: 100, asset: { type: 'person', svg: '<svg/>' }, name: id },
  state: 'to_gate',
  target: { x, y, width: 0, height: 0 },
  afterTarget: direction === 'enter' ? { x: 800, y: 20, width: 0, height: 0 } : { x: 800, y: 340, width: 0, height: 0 },
  exitPoint: direction === 'enter' ? { x: 800, y: 140, width: 0, height: 0 } : { x: 800, y: 200, width: 0, height: 0 },
  speed: 40,
  type: 'person',
  direction,
  travelMode: 'walk',
  gateId: 'wicket-1',
  ...extra,
})

const mkCar = (id: string, direction: 'enter' | 'exit', x: number, y: number, extra: any = {}) => ({
  id,
  element: { id, x, y, width: CAR_WIDTH, height: CAR_HEIGHT, rotation: 0, velocity: 0, zIndex: 100, asset: { type: 'car', svg: '<svg/>' }, name: id },
  state: 'to_gate',
  target: { x, y, width: 0, height: 0 },
  afterTarget: direction === 'enter' ? { x: 300, y: 400, width: 0, height: 0 } : { x: 950, y: 400, width: 0, height: 0 },
  exitPoint: direction === 'enter' ? { x: 780, y: 200, width: 0, height: 0 } : { x: 820, y: 120, width: 0, height: 0 },
  speed: 60,
  type: 'car',
  direction,
  travelMode: 'car',
  gateId: 'car-gate-1',
  ...extra,
})

interface Scene {
  simElements: ReturnType<typeof ref>
  aiAgents: ReturnType<typeof ref>
  physics: ReturnType<typeof useSimulatorPhysics>
  gate: any
  gateId: string
}

const buildScene = (gate: any, gateId: string): Scene => {
  const simElements = ref<any[]>([gate])
  const aiAgents = ref<any[]>([])
  const sceneSize = ref({ width: 1280, height: 720 })
  const simOpts = {
    ACCEL: 100,
    DECEL: 100,
    REACTION_TIME: 1.5,
    MIN_BUFFER: 15,
    MAX_LOOKAHEAD: 220,
    ARRIVE_THRESHOLD: 1,
    gateCloseDelay: 0,
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
  return { simElements, aiAgents, physics, gate, gateId }
}

const run = (scene: Scene, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    scene.physics.updateAiMovement(DT, { carGateId: 'car-gate-1', personGateId: 'wicket-1' })
  }
}

describe('очерёдность направлений у прохода', () => {
  it('выходящий ждёт, пока входящий не пройдёт и не освободит зону', () => {
    const scene = buildScene(makeWicket(true), 'wicket-1')
    // входящий приходит первым: сразу кладём его в waiting_before на остановке
    const enter = mkPerson('p-enter', 'enter', 800, 235)
    enter.state = 'waiting_before'
    enter.target = { x: 800, y: 235, width: 0, height: 0 }
    const exit = mkPerson('p-exit', 'exit', 800, 90)
    exit.state = 'waiting_before'
    exit.target = { x: 800, y: 90, width: 0, height: 0 }
    scene.aiAgents.value.push(enter)
    // входящий успел постоять ДО прихода выходящего (FCFS): 1с ожидания
    run(scene, 1)
    scene.aiAgents.value.push(exit)

    run(scene, 0.3)
    // входящий первым начал проход, выходящий ждёт
    expect(enter.state).toBe('crossing')
    expect(exit.state).toBe('waiting_before')

    // входящий ещё пересекает калитку — выходящий продолжает ждать
    run(scene, 1)
    expect(exit.state).toBe('waiting_before')

    // входящий пересёк калитку, освободил зону и деспавнится,
    // выходящий получает свой проход
    // [№23-ДУГА] путь прохода смещённого человека стал дугой (чуть длиннее
    // прямого выравнивания) — окно расширено 10 -> 12с, смысл теста неизменен
    run(scene, 12)
    expect(enter.state).toBe('done')
    expect(['crossing', 'moving_away', 'done']).toContain(exit.state)
    expect(exit.state).not.toBe('waiting_before')
  })

  it('оба направления ждут у закрытой калитки — FCFS пропускает пришедшего раньше', () => {
    const scene = buildScene(makeWicket(false), 'wicket-1')
    // выходящий приходит первым
    const exit = mkPerson('p-exit', 'exit', 800, 90)
    exit.state = 'waiting_before'
    exit.target = { x: 800, y: 90, width: 0, height: 0 }
    scene.aiAgents.value.push(exit)
    run(scene, 1)
    expect(exit.state).toBe('waiting_before') // калитка закрыта — стоит
    // затем приходит входящий
    const enter = mkPerson('p-enter', 'enter', 800, 235)
    enter.state = 'waiting_before'
    enter.target = { x: 800, y: 235, width: 0, height: 0 }
    scene.aiAgents.value.push(enter)
    run(scene, 1)
    expect(enter.state).toBe('waiting_before')

    // охранник открывает калитку
    scene.gate.settings.isOpen = true
    run(scene, 0.5)
    // первым идёт ВЫХОДЯЩИЙ (пришёл раньше), входящий ждёт
    expect(exit.state).toBe('crossing')
    expect(enter.state).toBe('waiting_before')

    // после прохода выходящего входящий тоже проходит
    run(scene, 15)
    expect(['moving_away', 'done']).toContain(exit.state)
    expect(['crossing', 'moving_away', 'done']).toContain(enter.state)
  })

  it('зависший встречный поток не блокирует дольше DIR_BLOCK_MAX (25с)', () => {
    const scene = buildScene(makeWicket(true), 'wicket-1')
    // входящий «завис» в crossing: скорость 0, цель далеко — не прибывает
    const enter = mkPerson('p-enter', 'enter', 800, 180)
    enter.state = 'crossing'
    enter.speed = 0
    enter.target = { x: 800, y: 140, width: 0, height: 0 }
    const exit = mkPerson('p-exit', 'exit', 800, 90)
    exit.state = 'waiting_before'
    exit.target = { x: 800, y: 90, width: 0, height: 0 }
    scene.aiAgents.value.push(enter, exit)

    // пока входящий занимает проход, выходящий ждёт
    run(scene, 5)
    expect(exit.state).toBe('waiting_before')

    // предохранитель: после 25с блокировки выходящий проходит принудительно
    run(scene, 25)
    expect(['crossing', 'moving_away', 'done']).toContain(exit.state)
  })

  it('машины: въезжающая проходит первым и уезжает после закрытия; выезжающая проходит следом ([№13])', () => {
    const scene = buildScene(makeCarGate(true), 'car-gate-1')
    // Каноническая геометрия ворот (600,100,320,120): ось 760, линия дороги
    // F=220, дорога 200. Стоп въезда (760,194), посадка въезда (760,258),
    // стоп выезда (760,250), посадка выезда (760,154).
    // въезжающая машина на остановке у ворот
    const enter = mkCar('c-enter', 'enter', 720, 174)
    enter.state = 'waiting_before'
    enter.target = { x: 760, y: 194, width: 0, height: 0 }
    enter.exitPoint = { x: 760, y: 258, width: 0, height: 0 }
    enter.afterTarget = { x: 760, y: 900, width: 0, height: 0 }
    scene.aiAgents.value.push(enter)
    run(scene, 0.5) // начинает проход первой (встречных пока нет)
    expect(enter.state).toBe('crossing')

    // выезжающая машина в глубине базы идёт к своей остановке
    const exit = mkCar('c-exit', 'exit', 720, 380)
    exit.state = 'to_gate'
    exit.target = { x: 760, y: 250, width: 0, height: 0 }
    exit.exitPoint = { x: 760, y: 154, width: 0, height: 0 }
    exit.afterTarget = { x: 1300, y: 154, width: 0, height: 0 }
    scene.aiAgents.value.push(exit)

    run(scene, 0.5)
    // въезжающая ещё в проходе/за воротами — выезжающая держится в стороне
    expect(['crossing', 'waiting_after']).toContain(enter.state)
    expect(['to_gate', 'waiting_before']).toContain(exit.state)

    // [№13] въехавшая уезжает: ворота закрывает свип (delay=0, корпус
    // выезжающей в 100px от остановки линию не перекрывает), уезд — по
    // [№12] налево (коридор вниз занят выезжающей)
    run(scene, 6)
    expect(['moving_away', 'done']).toContain(enter.state)
    // выезжающая идёт к остановке / вернулась на неё / ждёт открытия
    expect(['waiting_before', 'to_gate']).toContain(exit.state)

    // Охранник держит ворота открытыми, пока выезжающая идёт к остановке
    // ([G1]); как только она начала проход — больше не открывает: свип
    // [№13] закроет ворота за её спиной, и она уедет после ПОЛНОГО
    // закрытия.
    for (let i = 0; i < 300; i++) { // 15с
      if (!scene.gate.settings.isOpen && !scene.gate.settings.isAnimating &&
          ['to_gate', 'waiting_before'].includes(exit.state)) {
        scene.gate.settings.isOpen = true
        scene.gate.settings.isAnimating = false
      }
      run(scene, DT)
    }
    expect(['crossing', 'moving_away', 'done']).toContain(exit.state)
  })
})
