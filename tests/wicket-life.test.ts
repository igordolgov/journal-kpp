// tests/wicket-life.test.ts
// [№21-КАЛИТКА-В-ЖИЗНИ] логика калитки как в жизни (репорт №21) с правкой
// [№24-РУЧКА] (замок показывает только ручка, полотно не приоткрывается):
//  1) кнопка «КАЛИТКА ОТКРЫТЬ» / клик по калитке = РАЗБЛОКИРОВКА: звук
//     щелчка замка, флаг isAjar/wicketAjar; ПОЛОТНО НЕ ДВИГАЕТСЯ —
//     индикатор замка это ручка (поворот + цвет, CSS .gate-unlocked);
//  2) полностью калитку открывают подошедшие люди (физика вызывает
//     openGateFn, когда человек встал в waiting_before у разблокированной);
//  3) если за WICKET_AJAR_TIMEOUT_S её никто не открыл — ЗАПИРАЕТСЯ сама
//     (без твина и удара — полотно не двигалось);
//  4) открытую кликом калитку закрываем (как раньше); повторный клик по
//     разблокированной (не открытой) — ЗАПИРАНИЕ;
//  5) к кнопке «wicket-open» подключена разблокировка, а не полное открытие.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSimulatorCore } from '~/composables/simulator/useSimulatorCore'
import { useSimulatorPhysics } from '~/composables/simulator/useSimulatorPhysics'
import { useSimulatorUI } from '~/composables/simulator/useSimulatorUI'
import { generateWicketSVG } from '~/constants/library'
import { WICKET_AJAR_TIMEOUT_S } from '~/utils/gateFlow'
import { PERSON_WIDTH, PERSON_HEIGHT } from '~/utils/simulatorConstants'

const DT = 0.1

const makeWicket = (overrides: Record<string, unknown> = {}) => ({
  id: 'w-1', x: 550, y: 100, width: 60, height: 120,
  rotation: 0, velocity: 0, category: 'gate', type: 'gate', name: 'Калитка', zIndex: 300,
  settings: {
    gateType: 'wicket', isOpen: false, isAnimating: false,
    openDuration: 0.5, closeDuration: 0.5,
    ...overrides,
  },
  asset: { type: 'svg', content: '<svg/>' },
})

const buildCore = (overrides: Record<string, unknown> = {}) => {
  const wicket: any = makeWicket(overrides)
  const simElements = ref<any[]>([wicket])
  const core = useSimulatorCore(simElements as any)
  return { wicket, simElements, core }
}

describe('[№24-РУЧКА] разблокировка: замок на ручке, полотно на месте', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('unlockWicket: снимает замок (isAjar+wicketAjar), НЕ открывает, БЕЗ анимации полотна', () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(core.unlockWicket(wicket as any)).toBe(true)
    expect(wicket.settings.isAjar).toBe(true)
    expect(wicket.settings.wicketAjar).toBe(true)       // дубль-ключ локальной физики
    expect(wicket.settings.isOpen).toBe(false)          // пройти ещё нельзя
    expect(wicket.settings.isAnimating).toBe(false)     // полотно НЕ приоткрывается [№24]
    expect((wicket.settings as any)._animScaleX ?? 1).toBe(1) // полотно на месте
  })

  it('повторная разблокировка приоткрытой калитки безопасна', () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.unlockWicket(wicket as any)
    expect(core.unlockWicket(wicket as any)).toBe(true)
    expect(wicket.settings.isAjar).toBe(true)
  })

  it('открытую калитку разблокировка не трогает, створчатую возвращает false', () => {
    const open = buildCore({ isOpen: true })
    expect(open.core.unlockWicket(open.wicket as any)).toBe(true)
    expect(open.wicket.settings.isOpen).toBe(true)
    expect(open.wicket.settings.isAjar).toBeFalsy()

    const sliding = buildCore({ gateType: 'sliding' })
    sliding.wicket.width = 320
    expect(sliding.core.unlockWicket(sliding.wicket as any)).toBe(false)
  })

  it('клик по калитке = разблокировка; клик по открытой = закрытие; клик по разблокированной = ЗАПИРАНИЕ [№24]', () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.handleGateClick(wicket as any)
    expect(wicket.settings.isAjar).toBe(true)
    expect(wicket.settings.isOpen).toBe(false)
    // повторный клик: разблокирована и не открыта — запираем, ручка назад
    core.handleGateClick(wicket as any)
    expect(wicket.settings.isAjar).toBe(false)
    expect(wicket.settings.wicketAjar).toBe(false)
    expect(wicket.settings.isAnimating).toBe(false)     // без холостого твина

    // [№32] для НАСТОЯЩЕГО закрытия полотно должно быть открыто: флаг
    // isOpen=true при полотне scale 1 — холостое состояние (анимации нет)
    const opened = buildCore({ isOpen: true, _animScaleX: 0.1 })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    opened.core.handleGateClick(opened.wicket as any)
    // закрытие запущено (твин в узловой среде не тикает — isOpen снимет
    // onComplete, как в живом приложении)
    expect(opened.wicket.settings.isAnimating).toBe(true)
    expect(opened.wicket.settings.isAjar).toBeFalsy()
  })

  it('«ЗАКРЫТЬ» на разблокированной (полотно не открыто) = запирание без твина и удара [№24]', () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.unlockWicket(wicket as any)
    expect(core.closeGate(wicket as any)).toBe(true)
    expect(wicket.settings.isAjar).toBe(false)
    expect(wicket.settings.wicketAjar).toBe(false)
    expect(wicket.settings.isOpen).toBe(false)
    expect(wicket.settings.isAnimating).toBe(false)
  })

  it('полное открытие снимает разблокировку и её таймер', () => {
    vi.useFakeTimers()
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.unlockWicket(wicket as any)
    // [№24] твина приоткрытия больше нет — полотно ждёт людей на месте
    // человек толкнул: полное открытие
    expect(core.openGate(wicket as any)).toBe(true)
    expect(wicket.settings.isAjar).toBe(false)
    // открытие завершилось
    wicket.settings.isOpen = true
    wicket.settings.isAnimating = false
    // таймер захлопывания снят (и в любом случае обезврежен isAjar=false):
    // через 20с калитка всё ещё открыта
    vi.advanceTimersByTime((WICKET_AJAR_TIMEOUT_S + 5) * 1000)
    expect(wicket.settings.isOpen).toBe(true)
    expect(wicket.settings.isAjar).toBe(false)
  })

  it('никто не открыл — калитка ЗАПИРАЕТСЯ сама по таймауту (без твина и удара) [№24]', () => {
    vi.useFakeTimers()
    const { wicket, core } = buildCore()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    core.unlockWicket(wicket as any)
    vi.advanceTimersByTime(WICKET_AJAR_TIMEOUT_S * 1000 - 100)
    expect(wicket.settings.isAjar).toBe(true)           // ещё разблокирована
    vi.advanceTimersByTime(200)
    // [№24] полотно не двигалось — таймаут просто ЗАПИРАЕТ: ручка назад,
    // красная; ни закрытого твина, ни звука удара
    expect(wicket.settings.isOpen).toBe(false)
    expect(wicket.settings.isAjar).toBe(false)
    expect(wicket.settings.wicketAjar).toBe(false)
    expect(wicket.settings.isAnimating).toBe(false)
    expect(warnSpy.mock.calls.some(c => String(c[0]).includes('wicket-ajar'))).toBe(true)
  })

  it('SVG калитки: ручка ГОРИЗОНТАЛЬНАЯ (закрыто), вращается от нижней точки, красная [№24][№26]', () => {
    const svg = generateWicketSVG(60, 120)
    expect(svg).toContain('class="wicket-handle"')
    // [№26] закрыто = ГОРИЗОНТАЛЬНАЯ ручка: брусок 16x8 (длина = max(8,16),
    // толщина = min(8,16)); handleX = 60 - 16 - 2 - 4 = 38;
    // handleY = (120 - 8)/2 = 56; нижняя точка: (38 + 16/2, 56 + 8) = (46, 64).
    // CSS .gate-unlocked поворачивает её на -90° -> открыто = ВЕРТИКАЛЬНАЯ.
    expect(svg).toContain('transform-origin: 46px 64px')
    expect(svg).toContain('width="16" height="8"')       // брусок поперёк полотна
    expect(svg).toContain('fill="#dc2626"')              // красная = заперто
  })
})

describe('[№21-КАЛИТКА-В-ЖИЗНИ] люди открывают приоткрытую калитку', () => {
  const buildPhysics = () => {
    const wicket: any = makeWicket()
    const simElements = ref<any[]>([wicket])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ width: 1280, height: 720 })
    const openCalls: string[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { openCalls.push(String(g.id)); g.settings.isOpen = true; return true },
      (g: any) => { g.settings.isOpen = false; return true },
      () => {},
      { ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
        MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1, gateCloseDelay: 10,
        wicketCloseDelay: 1, stallEscalateTime: 10 },
      undefined,
      undefined,
    )
    return { wicket, simElements, aiAgents, physics, openCalls }
  }

  const mkPerson = (id: string, cx: number, cy: number, target: { x: number; y: number }) => ({
    id,
    element: {
      id, x: cx - PERSON_WIDTH / 2, y: cy - PERSON_HEIGHT / 2,
      width: PERSON_WIDTH, height: PERSON_HEIGHT,
      rotation: 0, velocity: 0, category: 'person', type: 'actor', direction: 'enter',
      settings: {},
    },
    state: 'waiting_before',
    target: { x: target.x, y: target.y, width: 0, height: 0 },
    afterTarget: { x: target.x, y: 900, width: 0, height: 0 },
    exitPoint: { x: target.x, y: target.y + 78, width: 0, height: 0 },
    speed: 40, type: 'person', direction: 'enter', travelMode: 'walk',
    gateId: 'w-1',
  })

  it('подошедший человек толкает ПРИОТКРЫТУЮ калитку до полного открытия', () => {
    const h = buildPhysics()
    h.wicket.settings.isAjar = true
    const p = mkPerson('p-1', 580, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]
    for (let i = 0; i < 3; i++) h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w-1' })
    expect(h.openCalls).toContain('w-1')
    expect(h.wicket.settings.isOpen).toBe(true)
  })

  it('ЗАБЛОКИРОВАННУЮ калитку человек не толкает — ждёт охранника', () => {
    const h = buildPhysics()
    const p = mkPerson('p-1', 580, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]
    for (let i = 0; i < 5; i++) h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w-1' })
    expect(h.openCalls.length).toBe(0)
    expect(p.state).toBe('waiting_before')
  })

  it('[№26-РУЧКА] пуш полотна отложен, пока ручка доигрывает (_handleAt свежий)', () => {
    const h = buildPhysics()
    // разблокировка «как из core»: isAjar + СВЕЖАЯ метка старта анимации ручки
    h.wicket.settings.isAjar = true
    h.wicket.settings._handleAt = Date.now()
    const p = mkPerson('p-1', 580, 148, { x: 580, y: 148 })
    h.aiAgents.value = [p as any]
    for (let i = 0; i < 4; i++) h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w-1' })
    // 0.4с < WICKET_HANDLE_S (0.45с) — ручка ещё поворачивается, полотно ждёт
    expect(h.openCalls.length).toBe(0)
    expect(p.state).toBe('waiting_before')
    // прошло 0.6с с разблокировки — ручка доиграла, человек толкает полотно
    h.wicket.settings._handleAt = Date.now() - 600
    for (let i = 0; i < 2; i++) h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w-1' })
    expect(h.openCalls).toContain('w-1')
    expect(h.wicket.settings.isOpen).toBe(true)
  })
})

describe('[№21-КАЛИТКА-В-ЖИЗНИ] кнопка wicket-open => разблокировка', () => {
  it('onControlClick wicket-open вызывает unlockWicket, а не полное открытие', () => {
    const wicket: any = makeWicket()
    const simElements = ref<any[]>([wicket])
    const unlockSpy = vi.fn(() => true)
    const ui = useSimulatorUI(
      simElements as any,
      vi.fn(() => true), vi.fn(() => true), vi.fn(),
      ref(new Set()) as any, ref(null) as any,
      unlockSpy,
    )
    ui.onControlClick(
      { settings: { actionType: 'wicket-open' } },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    )
    expect(unlockSpy).toHaveBeenCalledWith(wicket)
    expect(wicket.settings.isOpen).toBe(false)
  })
})

// ======================================================================
// [№22-КНОПКИ] кнопки калитки обязаны работать В ЛЮБОЙ фазе анимации.
// Раньше isAnimating глушил их ранними выходами: нажатие «КАЛИТКА
// ОТКРЫТЬ» на закрывающейся и «КАЛИТКА ЗАКРЫТЬ» на открывающейся
// молча ничего не делали (окно 1-2с на каждый цикл закрытия — заказчик
// попадал в него постоянно).
// ======================================================================
describe('[№22-КНОПКИ] кнопки работают в любой фазе анимации', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const stageClosing = () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // реалистичное «открытое» состояние: флаг И полотно у открытой стенки.
    // [№32] флаг isOpen=true при полотне scale 1 (закрыто) — холостое
    // состояние: анимации нет, честный closed-стейдж требует открытого полотна.
    wicket.settings.isOpen = true
    ;(wicket.settings as any)._animScaleX = 0.1
    wicket.settings.isAnimating = false
    expect(core.closeGate(wicket as any)).toBe(true) // запустили закрытие
    expect(wicket.settings.isAnimating).toBe(true)
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: false })
    return { wicket, core }
  }

  const stageOpening = () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(core.openGate(wicket as any)).toBe(true) // люди толкают
    expect(wicket.settings.isAnimating).toBe(true)
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: true })
    return { wicket, core }
  }

  it('unlock перехватывает ЗАКРЫВАЮЩУЮСЯ калитку (как схватить дверь) [№24]', () => {
    const { wicket, core } = stageClosing()
    expect(core.unlockWicket(wicket as any)).toBe(true)
    // твин перехвачен: полотно распахивается обратно В ОТКРЫТОЕ
    // (приоткрытия больше нет, [№24]); замок снят — ручка зелёная
    expect(wicket.settings.isAnimating).toBe(true)
    expect(wicket.settings.isAjar).toBe(true)
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: true, ajar: false })
  })

  it('unlock при открывающейся — no-op: не сбивает толчок людьми', () => {
    const { wicket, core } = stageOpening()
    expect(wicket.settings.isAjar).toBe(false) // openGate снял разблокировку
    expect(core.unlockWicket(wicket as any)).toBe(true)
    expect(wicket.settings.isAjar).toBe(false)               // не вернул
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: true, ajar: false })
  })

  it('close перехватывает ОТКРЫВАЮЩУЮСЯ калитку (охранник захлопнул)', () => {
    const { wicket, core } = stageOpening()
    expect(core.closeGate(wicket as any)).toBe(true)
    expect(wicket.settings.isAnimating).toBe(true)           // закрытие идёт
    expect(wicket.settings.isAjar).toBe(false)
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: false })
  })

  it('close при уже закрывающейся — короткое замыкание, твин не перезапускается', () => {
    const { wicket, core } = stageClosing()
    const tween1 = core.gateTweens.get('w-1')
    expect(core.closeGate(wicket as any)).toBe(true)
    expect(core.gateTweens.get('w-1')).toBe(tween1)          // тот же твин
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: false })
  })

  it('close по ЗАКРЫТОЙ калитке — холостого твина и слампа нет', () => {
    const { wicket, core } = buildCore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(wicket.settings.isOpen).toBe(false)
    expect(core.closeGate(wicket as any)).toBe(true)
    expect(wicket.settings.isAnimating).toBe(false)          // анимации нет
    expect(core.gateTweens.has('w-1')).toBe(false)           // твин не создан
  })

  it('клик по закрывающейся калитке перехватывает её (unlock) [№24]', () => {
    const { wicket, core } = stageClosing()
    core.handleGateClick(wicket as any)
    expect(wicket.settings.isAjar).toBe(true)
    expect(core.gateTweenTarget.get('w-1')).toMatchObject({ open: true, ajar: false })
  })
})

// ======================================================================
// [№22-ТОЛПА] очередь калитки держит её открытой: встречные ждущие
// (dirBlock) — легальная очередь (очерёдность направлений), калитка
// НЕ должна закрываться у них перед носом между сменами направления.
// Раньше hasOtherWaiting игнорировал dirBlock-людей, толпа по обе
// стороны стопорилась до повторной разблокировки охранником.
// ======================================================================
describe('[№22-ТОЛПА] очередь держит калитку открытой', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const buildCrowd = () => {
    const wicket: any = makeWicket()
    const simElements = ref<any[]>([wicket])
    const aiAgents = ref<any[]>([])
    const sceneSize = ref({ width: 1280, height: 720 })
    const openCalls: string[] = []
    const closeCalls: string[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const physics = useSimulatorPhysics(
      simElements as any, aiAgents, sceneSize,
      (g: any) => { openCalls.push(String(g.id)); g.settings.isOpen = true; return true },
      (g: any) => { closeCalls.push(String(g.id)); g.settings.isOpen = false; return true },
      () => {},
      { ACCEL: 100, DECEL: 100, REACTION_TIME: 1.5, MIN_BUFFER: 15,
        MAX_LOOKAHEAD: 220, ARRIVE_THRESHOLD: 1, gateCloseDelay: 10,
        wicketCloseDelay: 1, stallEscalateTime: 10 },
      undefined,
      undefined,
    )
    return { wicket, simElements, aiAgents, physics, openCalls, closeCalls }
  }

  // Человек стоит ровно на оси (580) — фаза выравнивания не включается,
  // проход детерминированно вертикальный. Стейдж сразу в waiting_before:
  // для одиночек to_gate цель перезаписывается trafficPointsFor каждый тик.
  // waitStart недоступен снаружи — оба получают fallback Date.now(),
  // при равенстве FCFS отдаёт приоритет enter — детерминированно.
  const mkWalker = (id: string, direction: 'enter' | 'exit', stopY: number, exitY: number, away: { x: number; y: number }) => ({
    id,
    element: {
      id, x: 580 - PERSON_WIDTH / 2, y: stopY - PERSON_HEIGHT / 2,
      width: PERSON_WIDTH, height: PERSON_HEIGHT,
      rotation: 0, velocity: 0, category: 'person', type: 'actor', direction,
      settings: {},
    },
    state: 'waiting_before',
    target: { x: 580, y: stopY, width: 0, height: 0 },
    afterTarget: { x: away.x, y: away.y, width: 0, height: 0 },
    exitPoint: { x: 580, y: exitY, width: 0, height: 0 },
    speed: 40, type: 'person', direction, travelMode: 'walk',
    gateId: 'w-1',
  })

  const runFrames = (h: ReturnType<typeof buildCrowd>, seconds: number) => {
    const steps = Math.round(seconds / DT)
    for (let i = 0; i < steps; i++) {
      h.physics.updateAiMovement(DT, { carGateId: '', personGateId: 'w-1' })
    }
  }

  it('калитка не закрывается между сменами направления; закрытие — когда ушли все', () => {
    vi.useFakeTimers()
    const h = buildCrowd()
    // A (exit) ждёт ниже забора, B (enter) — выше; оба на оси, расстояние
    // между ними 170px — не толкаются
    const a = mkWalker('a-exit', 'exit', 250, 180, { x: 400, y: 520 }) as any
    const b = mkWalker('b-enter', 'enter', 80, 150, { x: 820, y: -80 }) as any
    h.aiAgents.value = [a, b]
    runFrames(h, 0.3)
    expect(a.state).toBe('waiting_before')
    expect(b.state).toBe('waiting_before')
    // охранник разблокировал, кто-то толкнул: калитка открыта и простаивает
    h.wicket.settings.isOpen = true
    h.wicket.settings.isAjar = false
    h.wicket.settings.isAnimating = false

    // FCFS: первым идёт b (при равном waitStart приоритет enter)…
    // [№30] проход без торможений — быстрее прежнего: ловим момент
    // crossing пошагово, а не фиксированным окном
    let crosser: any = undefined
    for (let i = 0; i < 40 && !crosser; i++) {
      runFrames(h, 0.1)
      crosser = [a, b].find(x => x.state === 'crossing')
    }
    expect(crosser).toBeTruthy()
    const waiter = [a, b].find(x => x.state === 'waiting_before')
    expect(waiter).toBeTruthy()
    // …прошёл: moving_away, поставлен таймер закрытия (1с)
    runFrames(h, 3)
    expect(crosser!.state).toBe('moving_away')
    // [№22] таймер сработал — НО встречный ждёт: закрытия НЕТ
    vi.advanceTimersByTime(1200)
    runFrames(h, 0.1)
    expect(h.closeCalls).toEqual([])
    expect(h.wicket.settings.isOpen).toBe(true)
    // встречный дождался освобождения створа и проходит по той же ОТКРЫТОЙ
    // калитке (закройся она — он застрял бы waiting_before навсегда);
    // за 4с успевает и пройти, поэтому промежуточный crossing не проверяем
    runFrames(h, 4)
    expect(waiter!.state).toBe('moving_away')
    expect(h.closeCalls).toEqual([])
    expect(h.wicket.settings.isOpen).toBe(true)
    // оба ушли, ждать некому: свип [G2] отменяет отложенное закрытие, пока
    // корпус последнего прошедшего в зоне створа (70px) — даём выйти и
    // закрываться; таймер срабатывает в течение пары секунд
    let closed = false
    for (let i = 0; i < 20 && !closed; i++) {
      vi.advanceTimersByTime(300)
      runFrames(h, 0.5)
      closed = h.closeCalls.length > 0
    }
    expect(h.closeCalls).toEqual(['w-1'])
  })

  it('порожняя калитка закрывается по таймеру как раньше (контроль)', () => {
    vi.useFakeTimers()
    const h = buildCrowd()
    const a = mkWalker('a-exit', 'exit', 250, 180, { x: 400, y: 520 }) as any
    h.aiAgents.value = [a]
    runFrames(h, 0.3)
    h.wicket.settings.isOpen = true
    h.wicket.settings.isAjar = false
    h.wicket.settings.isAnimating = false
    // [№30] проход без торможений: через ~2с человек уже за проёмом —
    // ждём перехода в moving_away, а не фиксированного окна
    let passed = false
    for (let i = 0; i < 60 && !passed; i++) {
      runFrames(h, 0.1)
      passed = a.state === 'moving_away'
    }
    expect(passed).toBe(true)
    // дать человеку уйти из зоны створа (70px), иначе таймер закрытия
    // увидит «занято» и не закроет
    runFrames(h, 3)
    vi.advanceTimersByTime(1200)
    runFrames(h, 0.1)
    expect(h.closeCalls).toEqual(['w-1'])
  })
})
