// composables/simulator/useSimulatorPhysics.ts
// [PAYROLL] Физика — единственное место, где известны моменты «подошёл
// к шлагбауму» (waiting_before) и «начал проход» (crossing). Здесь они
// замеряются и отдаются хукам; смысл (начисления) остаётся в usePayroll.
import { type Ref, onScopeDispose } from 'vue'
import { useAudioEngine } from '~/composables/useAudioEngine'
import type { SceneElement, AiAgent } from '~/types/simulator'
import { DESPAWN_MARGIN } from '~/utils/simulatorConstants'
import { dot, cross, normalizeAngle } from '~/utils/simulatorMath'
// [СХЕМА-ТРАЕКТОРИЙ] единый с спавном пересчёт цели остановки из геометрии ворот
import { trafficPointsFor } from '~/utils/simulatorTraffic'

export function useSimulatorPhysics(
  simElements: Ref<SceneElement[]>,
  aiAgents: Ref<AiAgent[]>,
  sceneSize: Ref<{ width: number; height: number }>,
  openGateFn: (gate: SceneElement) => boolean,
  closeGateFn: (gate: SceneElement) => boolean,
  stopGateFn: (gate: SceneElement) => void,
  simOpts: any = {},
  onAgentDone?: (agent: AiAgent) => void,
  payrollHooks?: {
    onAgentArrive?: (agent: AiAgent) => void
    onAgentCrossing?: (agent: AiAgent, waitMs: number, gate?: SceneElement) => void
  }
) {
  // ✅ audio теперь внутри setup-контекста
  const audio = useAudioEngine()
  
  // ✅ gateCloseTimers теперь внутри функции, а не на уровне модуля
  const gateCloseTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // [PAYROLL] часы ожидания: agent.id -> момент прихода в waiting_before.
  // Map, а не поле агента: тип AiAgent остаётся нетронутым, мусор не копится
  // (чистится при деспавне и при старте перехода)
  const waitStartByAgentId = new Map<string, number>()

  // [ФИКС-ЗАСТРЯНИЕ] сколько секунд агент стоит у ОТКРЫТОЙ, неанимирующейся
  // калитки. Одиночка/лидер начинают проход в первый же такой кадр, член
  // группы — через 2-3с после предыдущего. Превышение лимитов означает
  // подвисший конечный автомат — принудительно начинаем проход.
  const waitOpenByAgentId = new Map<string, number>()
  // [ФИКС-висяки-2] сколько секунд машина стоит в waiting_after (после
  // проезда): страховка от вечного ожидания закрытия ворот
  const waitAfterByAgentId = new Map<string, number>()
  // [ФИКС-висяки-3] жёсткий предохранитель фазы ПОСЛЕ прохода: суммарное
  // время агента в crossing + moving_away. Штатно это секунды (плюс ~1 мин
  // хода за край у медленного пешехода); превышение лимита означает
  // зависание, которое не поймал сторож, — агент принудительно завершается
  // (телепорт на afterTarget/за край -> done -> штатный деспавн).
  const postGateTrack = new Map<string, number>()
  const POST_GATE_MAX = simOpts.postGateMax ?? 90   // сек
  // [ФИКС-застыл-калитка] предохранитель фазы crossing: проход штатно
  // занимает секунды, а застрявший ПОСЛЕ калитки агент — самый заметный
  // («вошёл и замер»). Лимит жёстче пост-гатового: по истечении агент
  // переносится в конец прохода, и штатный блок прибытия доводит цепочку
  // (moving_away / waiting_after -> done -> деспавн).
  const crossTrack = new Map<string, number>()
  const CROSS_MAX_PERSON = 15   // сек
  const CROSS_MAX_CAR = 25      // сек

  // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] один проход — одно направление: выходящие люди и
  // машины не выходят, пока не пройдут входящие, и наоборот. Противоположное
  // направление занимает проход, если оно в состоянии crossing/waiting_after
  // или ещё физически не освободило зону прохода (moving_away в радиусе).
  // Два ожидающих потока разводит FCFS: первым идёт тот, кто раньше подошёл
  // к проходу (ничья — за «enter»). DIR_BLOCK_MAX — жёсткий предохранитель
  // от взаимной блокировки на кривых сценах.
  const dirBlockByAgentId = new Map<string, number>()
  const DIR_BLOCK_MAX = 25        // сек
  const GATE_ZONE_PERSON = 70     // px: радиус зоны прохода для пешеходов
  const GATE_ZONE_CAR = 160       // px: радиус зоны прохода для машин
  // [ФИКС-УСТУПИ-ДОРОГУ] параметры мягкого расхождения пешеходов: ближе
  // PERSON_SEP_RADIUS движущиеся пешеходы плавно смещаются друг от друга
  // (встречные — каждый в свою сторону), вместо прохода «сквозь» друг друга
  const PERSON_SEP_RADIUS = 40   // px: дистанция начала расхождения
  const PERSON_SEP_SPEED = 34    // px/с: темп бокового смещения
  const PERSON_YIELD_SPEED = 22  // px/с: постоянный дрейф «держись правее» при соседе по курсу
  // [ФИКС-ЗАСТРЯЛ-ВНИЗУ] «тихая зона» прибытия: на последнем отрезке к точке
  // остановки расталкивание и дрейф отключены — именно они дёргали агента
  // перед остановкой (толчок вбок -> коррекция курса -> новый толчок)
  const ARRIVE_QUIET_ZONE = 34   // px
  // [ФИКС-ЗАСТРЯЛ-МАШИНЫ] машина после проезда ворот больше не ждёт их
  // закрытия: короткая пауза (шлагбаум закрывается параллельно своим
  // таймером) и дальше в путь. Прежнее ожидание closeDelay+15с (до 25с)
  // выглядело как «машина застряла после ворот».
  const CAR_LEAVE_DELAY = simOpts.carLeaveDelay ?? 1.6
  const FORCE_CROSS_AFTER = 5        // сек: одиночка / лидер группы
  const FORCE_CROSS_GROUP_AFTER = 12 // сек: член группы, даже если предыдущий не прошёл
  
  // [WATCHDOG] страховка от вечных зависаний на сценах с кривыми/старыми
  // оффсетами: агент в движущемся состоянии (to_gate/crossing/moving_away),
  // не сместившийся за STALL_LIMIT секунд, телепортируется на свою текущую
  // цель — штатный блок прибытия ниже сам доводит цепочку состояний
  // (waiting_before -> crossing -> moving_away -> done) и деспавнит его.
  // Очередь за своим же потоком (mateAhead) телепортации не получает.
  const stallTrack = new Map<string, { x: number; y: number; t: number }>()
  const STALL_LIMIT = simOpts.stallEscalateTime ?? 10
  
  // ✅ автоматическая очистка при размонтировании
  onScopeDispose(() => {
    clearAllTimers()
  })

  const updateAiMovement = (dt: number, cfg: { carGateId: string; personGateId: string }) => {
    const ACCEL = simOpts.ACCEL ?? 100
    const DECEL = simOpts.DECEL ?? 100
    const REACTION_TIME = simOpts.REACTION_TIME ?? 1.5
    const MIN_BUFFER = simOpts.MIN_BUFFER ?? 15
    const MAX_LOOKAHEAD = simOpts.MAX_LOOKAHEAD ?? 220
    const ARRIVE_THRESHOLD = simOpts.ARRIVE_THRESHOLD ?? 1
    const SPRITE_ORIENTATION_OFFSET = simOpts.SPRITE_ORIENTATION_OFFSET ?? 0
    const gateCloseDelay = simOpts.gateCloseDelay ?? 10
    // [ФИКС-калитка] пол 2с: мгновенное закрытие било по ещё идущим к
    // проходу — люди приходили к уже закрытой калитке
    const wicketCloseDelay = Math.max(2, Number(simOpts.wicketCloseDelay ?? 0) || 0)

    // Удаление завершённых агентов + вызов логирования
    aiAgents.value = aiAgents.value.filter(agent => {
      if (agent.state === 'done') {
        if (onAgentDone) {
          onAgentDone(agent)
        }
        waitStartByAgentId.delete(agent.id) // [PAYROLL] без утечек часов
        stallTrack.delete(agent.id) // [WATCHDOG] без утечек трекинга
        waitOpenByAgentId.delete(agent.id) // [ФИКС-ЗАСТРЯНИЕ] без утечек таймеров стояния
        dirBlockByAgentId.delete(agent.id) // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] без утечек
        waitAfterByAgentId.delete(agent.id) // [ФИКС-висяки-2] без утечек
        postGateTrack.delete(agent.id) // [ФИКС-висяки-3] без утечек
        crossTrack.delete(agent.id) // [ФИКС-застыл-калитка] без утечек
        if (agent.type === 'car') audio.disposePool(`car-${agent.id}`)
        simElements.value = simElements.value.filter(el => el.id !== agent.id)
        return false
      }
      return true
    })

    const sorted = [...aiAgents.value].sort((a, b) =>
      Math.hypot(a.element.x - a.target.x, a.element.y - a.target.y) -
      Math.hypot(b.element.x - b.target.x, b.element.y - b.target.y)
    )

    // [PAYROLL] единая точка старта прохода: замер ожидания + хук.
    // try/catch — fail-safe: сбой оплаты не должен ронять физику
    const startCrossing = (agent: AiAgent) => {
      const startedAt = waitStartByAgentId.get(agent.id)
      const waitMs = startedAt != null ? Date.now() - startedAt : 0
      waitStartByAgentId.delete(agent.id)
      agent.state = 'crossing'
      // [ФИКС-висяки] fallback (0,0) уводил агента в угол сцены; конечная
      // цель + штатный блок прибытия доводят состояние сами
      const crossTarget = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
        ? agent.exitPoint
        : (agent.afterTarget ?? { x: agent.element.x, y: agent.element.y })
      agent.target = { ...crossTarget, width: 0, height: 0 }
      const gateId = agent.type === 'car' ? cfg.carGateId : cfg.personGateId
      const gate = simElements.value.find(g => String(g.id) === gateId)
      try {
        payrollHooks?.onAgentCrossing?.(agent, waitMs, gate)
      } catch (e) {
        console.error('[physics] onAgentCrossing упал:', e)
      }
    }

    // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] занимает ли противоположное направление проход,
    // в котором хочет пройти agent
    const oppositeOccupies = (agent: AiAgent, gate: SceneElement | undefined): boolean => {
      if (!gate) return false
      const opp: 'enter' | 'exit' = agent.direction === 'enter' ? 'exit' : 'enter'
      const zoneR = agent.type === 'car' ? GATE_ZONE_CAR : GATE_ZONE_PERSON
      const gcx = gate.x + gate.width / 2
      const gcy = gate.y + gate.height / 2
      let myEarliest = Infinity
      for (const a of aiAgents.value) {
        if (a.type !== agent.type || a.direction !== agent.direction || a.state !== 'waiting_before') continue
        const t = waitStartByAgentId.get(a.id)
        if (t != null && t < myEarliest) myEarliest = t
      }
      for (const o of aiAgents.value) {
        if (o.id === agent.id || o.type !== agent.type || o.direction !== opp || o.state === 'done') continue
        // проход или стоянка сразу за проходом — занимают всегда
        if (o.state === 'crossing' || o.state === 'waiting_after') return true
        const ocx = o.element.x + o.element.width / 2
        const ocy = o.element.y + o.element.height / 2
        if (Math.hypot(ocx - gcx, ocy - gcy) >= zoneR) continue
        if (o.state === 'waiting_before') {
          // оба направления стоят у прохода — первым идёт пришедший раньше (FCFS)
          const t = waitStartByAgentId.get(o.id) ?? Date.now()
          if (t < myEarliest || (t === myEarliest && opp === 'enter')) return true
          continue
        }
        // moving_away в зоне — ещё физически не освободил проход
        return true
      }
      return false
    }

    // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] true = агент ждёт своей очереди. Пока ждёт, не
    // копит force-cross таймер стояния (иначе принудительный проход ломал бы
    // очерёдность); DIR_BLOCK_MAX — последний предохранитель.
    const blockedByDirection = (agent: AiAgent, gate: SceneElement | undefined, dt: number): boolean => {
      if (!oppositeOccupies(agent, gate)) {
        dirBlockByAgentId.delete(agent.id)
        return false
      }
      waitOpenByAgentId.delete(agent.id)
      const bt = (dirBlockByAgentId.get(agent.id) ?? 0) + dt
      dirBlockByAgentId.set(agent.id, bt)
      if (bt >= DIR_BLOCK_MAX) {
        console.warn('[direction-queue] предохранитель', DIR_BLOCK_MAX, 'с — проходим принудительно:', agent.id)
        dirBlockByAgentId.delete(agent.id)
        return false
      }
      return true
    }

    const tryActivateNextInGroup = (agent: AiAgent, gate?: SceneElement) => {
      if (!agent.groupId || !agent.isLeader) return
      const groupMembers = agent.groupMembers
      if (!groupMembers) return
      const currentIndex = agent.groupIndex ?? 0
      const nextIndex = currentIndex + 1
      const nextMember = groupMembers.find(m => (m.groupIndex ?? 0) === nextIndex)
      if (nextMember && nextMember.state === 'waiting_before') {
        // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] встречный поток в проходе — член группы
        // дождётся очереди (штатная ветка waiting_before разбудит его)
        if (!oppositeOccupies(nextMember, gate)) startCrossing(nextMember)
      }
    }

    for (const agent of sorted) {
      const el = agent.element
      // [ФИКС-ДЁРГАНИЕ] флаг is-paused с гистерезисом для анимации ходьбы.
      // Раньше шаблон вычислял его как velocity < 0.1: контроллер «стой/иди»
      // в очереди у прохода (0 <-> 0.8*leaderSpeed) гоняет скорость через
      // порог 0.1 туда-сюда, класс мигает, и CSS-анимации рук/ног/корпуса
      // замирают и возобновляются посреди цикла — видимое «подёргивание»
      // людей при проходе через калитку.
      // Пауза ниже 0.1, возобновление только выше 1.5; в полосе между
      // порогами флаг НЕ меняется. Считается на каждом кадре для всех
      // состояний, поэтому стоящие агенты тоже получают паузу.
      if ((el.velocity || 0) < 0.1) el.isPaused = true
      else if ((el.velocity || 0) > 1.5) el.isPaused = false
      // [WATCHDOG] учёт застоя: сместился — сброс счётчика; стоит на месте
      // в движущемся состоянии — копим время и телепортируем на цель
      if (agent.state === 'to_gate' || agent.state === 'crossing' || agent.state === 'moving_away') {
        const tr = stallTrack.get(agent.id)
        if (!tr) {
          stallTrack.set(agent.id, { x: el.x, y: el.y, t: 0 })
        } else if (Math.hypot(el.x - tr.x, el.y - tr.y) > 3) {
          tr.x = el.x
          tr.y = el.y
          tr.t = 0
        } else if (Number.isFinite(agent.target?.x) && Number.isFinite(agent.target?.y)) {
          tr.t += dt
          if (tr.t >= STALL_LIMIT) {
            // Очередь за своим же потоком — легитимное ожидание, не толкаем
            const cx0 = el.x + el.width / 2
            const cy0 = el.y + el.height / 2
            const tx0 = agent.target.x + (agent.target.width || 0) / 2
            const ty0 = agent.target.y + (agent.target.height || 0) / 2
            const dd = Math.hypot(tx0 - cx0, ty0 - cy0)
            const ux = dd > 0 ? (tx0 - cx0) / dd : 0
            const uy = dd > 0 ? (ty0 - cy0) / dd : 0
            // [ФИКС-застыл-калитка] исключение «очереди за своим» — только
            // для to_gate: у прохода ждать своего законно. В crossing/
            // moving_away стоячих мест нет: раньше застрявший в проходе
            // агент вечно «ждал» идущего впереди и не спасался сторожем.
            const mateAhead = agent.state === 'to_gate' && aiAgents.value.some(o => {
              if (o.id === agent.id || o.type !== agent.type || o.direction !== agent.direction || o.state === 'done') return false
              // [ФИКС-взаимная-блокировка] «свой» впереди — законная причина
              // ждать, только если он реально движется или стоит у прохода
              // (waiting_before). Два СТОЯЩИХ агента с пересекающимися целями
              // иначе спасают друг друга вечно: каждый в конусе другого.
              if (o.state !== 'waiting_before' && (o.element.velocity || 0) <= 0.5) return false
              const ox = o.element.x + o.element.width / 2 - cx0
              const oy = o.element.y + o.element.height / 2 - cy0
              const f = ox * ux + oy * uy
              return f > 0 && f < 80 && Math.abs(ox * uy - oy * ux) < 30
            })
            if (!mateAhead) {
              console.warn('[watchdog] агент стоял', STALL_LIMIT, 'с — телепорт на цель:', agent.state, agent.id)
              // [WATCHDOG] дистанция в физике считается центр-к-центру,
              // поэтому выравниваем ЦЕНТР элемента на центр цели,
              // иначе остаточная дистанция (h/2) не даст прибытию сработать
              el.x = agent.target.x - el.width / 2
              el.y = agent.target.y - el.height / 2
              el.velocity = 0
            }
            tr.t = 0
          }
        } else {
          // [ФИКС-висяки-2] мусорная/NaN-цель: раньше watchdog молчал вечно.
          // Восстанавливаем конечную цель из afterTarget или выталкиваем за
          // ближайший боковой край (штатный деспавн за границей сцены).
          console.warn('[watchdog] NaN-цель — восстановление из afterTarget:', agent.id)
          const at = agent.afterTarget
          if (Number.isFinite(at?.x) && Number.isFinite(at?.y)) {
            agent.target = { x: at.x, y: at.y, width: 0, height: 0 }
          } else {
            const edgeX = (el.x < sceneSize.value.width / 2)
              ? -DESPAWN_MARGIN - el.width
              : sceneSize.value.width + DESPAWN_MARGIN
            agent.target = { x: edgeX, y: el.y, width: 0, height: 0 }
          }
          tr.t = 0
        }
      } else {
        stallTrack.delete(agent.id)
      }
      const gateId = agent.type === 'car' ? cfg.carGateId : cfg.personGateId
      const gate = simElements.value.find(g => String(g.id) === gateId)
      const isWicket = gate?.settings?.gateType === 'wicket' || (gate?.width && gate.width <= 60)
      const closeDelay = isWicket ? wicketCloseDelay : gateCloseDelay

      if (agent.state === 'to_gate' && gate && !agent.groupId) {
        // [СХЕМА-ТРАЕКТОРИЙ] цель остановки пересчитывается из ТЕКУЩЕЙ
        // геометрии ворот (те же формулы, что у спавна): перетаскивание ворот
        // на живой сцене не ломает подход, а настроенные оффсеты применяются
        // только с правильной стороны — устаревшие больше не уводят агентов
        const pts = trafficPointsFor(gate as any, { width: el.width, height: el.height }, agent.direction, sceneSize.value)
        agent.target.x = pts.stop.x
        agent.target.y = pts.stop.y
      }

      if (agent.state === 'waiting_before') {
        el.velocity = 0
        if (!gate) {
          // [ФИКС-висяки-2] ворота исчезли (удалены/битый gateId) — раньше
          // агент стоял вечно. После паузы проходим «сквозь»: цель crossing
          // конечна, деспавн сработает штатно.
          const missingWait = (waitOpenByAgentId.get(agent.id) ?? 0) + dt
          waitOpenByAgentId.set(agent.id, missingWait)
          if (missingWait >= (agent.isLeader || !agent.groupId ? FORCE_CROSS_AFTER : FORCE_CROSS_GROUP_AFTER)) {
            console.warn('[gate-missing] ворот нет — принудительный проход:', agent.id)
            waitOpenByAgentId.delete(agent.id)
            startCrossing(agent)
          }
          continue
        }
        // [ФИКС-ЗАСТРЯНИЕ] копим время стояния у открытой, неанимирующейся калитки
        const gateOpenIdle = gate.settings.isOpen && !gate.settings.isAnimating
        if (!gateOpenIdle) {
          waitOpenByAgentId.delete(agent.id)
          continue
        }
        const waitedOpen = (waitOpenByAgentId.get(agent.id) ?? 0) + dt
        waitOpenByAgentId.set(agent.id, waitedOpen)

        if (agent.isLeader || !agent.groupId) {
          // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] ждём освобождения прохода встречным потоком
          if (blockedByDirection(agent, gate, dt)) continue
          if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
          startCrossing(agent)
          waitOpenByAgentId.delete(agent.id)
          continue
        }

        const prevMember = agent.groupMembers?.find(m => (m.groupIndex ?? 0) === (agent.groupIndex ?? 0) - 1)
        const prevPassed = !prevMember || prevMember.state === 'moving_away' || prevMember.state === 'done'
        if (prevPassed) {
          // [ОЧЕРЕДЬ-НАПРАВЛЕНИЙ] ждём освобождения прохода встречным потоком
          if (blockedByDirection(agent, gate, dt)) continue
          if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
          startCrossing(agent)
          waitOpenByAgentId.delete(agent.id)
        } else if (waitedOpen >= FORCE_CROSS_GROUP_AFTER) {
          // [ФИКС-ЗАСТРЯНИЕ] цепочка группы зависла — начинаем принудительно,
          // иначе группа стоит у открытой калитки вечно
          if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
          startCrossing(agent)
          waitOpenByAgentId.delete(agent.id)
        }
        continue
      }

      if (agent.state === 'waiting_after') {
        el.velocity = 0
        // [ФИКС-висяки-2] страховка от вечного ожидания: таймер закрытия
        // одноразовый и мог сгореть впустую (isAnimating в момент
        // срабатывания, gateCloseDelay=0, ворота удалены) — машина стояла
        // во дворе бесконечно, а следующая замирала в очереди за ней.
        const waitedAfter = (waitAfterByAgentId.get(agent.id) ?? 0) + dt
        waitAfterByAgentId.set(agent.id, waitedAfter)
        // [ФИКС-ЗАСТРЯЛ-МАШИНЫ] выход из waiting_after: раньше машина ждала
        // закрытия ворот (closeDelay 10с + страховка 15с — до 25с стойла
        // «застрявшей» машиной). Теперь: сосед приближается — уезжаем сразу;
        // ворота начали закрываться — уезжаем; иначе — короткая пауза
        // CAR_LEAVE_DELAY и уезжаем (ворота закрываются параллельно).
        const hasOtherCarNear = aiAgents.value.some(a =>
          a !== agent &&
          a.type === 'car' &&
          (a.state === 'waiting_before' || a.state === 'to_gate' || a.state === 'crossing') &&
          String(gate?.id) === cfg.carGateId
        )
        if (hasOtherCarNear) {
          agent.state = 'moving_away'
          agent.target = { ...agent.afterTarget, width: 0, height: 0 }
        } else if (gate && !gate.settings?.isOpen && !gate.settings?.isAnimating) {
          agent.state = 'moving_away'
          agent.target = { ...agent.afterTarget, width: 0, height: 0 }
        } else if (waitedAfter > CAR_LEAVE_DELAY) {
          // уезжаем, даже если ворота ещё открыты — их закроет свой таймер
          agent.state = 'moving_away'
          agent.target = { ...agent.afterTarget, width: 0, height: 0 }
        }
        if (agent.state !== 'waiting_after') waitAfterByAgentId.delete(agent.id)
        continue
      }

      // [ФИКС-висяки-3] предохранитель фазы после прохода: crossing и
      // moving_away суммарно дольше POST_GATE_MAX — принудительное
      // завершение (деспавн за краем освобождает слот лимита агентов)
      if (agent.state === 'crossing' || agent.state === 'moving_away') {
        const gateAge = (postGateTrack.get(agent.id) ?? 0) + dt
        postGateTrack.set(agent.id, gateAge)
        // [ФИКС-застыл-калитка] crossing дольше CROSS_MAX_* — принудительный
        // перенос в конец прохода (exitPoint, при мусорной цели — target);
        // штатный блок прибытия ниже доведёт состояние до moving_away /
        // waiting_after сам, без смены семантики прохода
        if (agent.state === 'crossing') {
          const crossAge = (crossTrack.get(agent.id) ?? 0) + dt
          crossTrack.set(agent.id, crossAge)
          const crossLimit = agent.type === 'car' ? CROSS_MAX_CAR : CROSS_MAX_PERSON
          if (crossAge >= crossLimit) {
            console.warn('[crossing-cap] crossing дольше', crossLimit, 'с — перенос в конец прохода:', agent.type, agent.id)
            const exitT = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
              ? agent.exitPoint
              : agent.target
            if (Number.isFinite(exitT?.x) && Number.isFinite(exitT?.y)) {
              el.x = exitT.x - el.width / 2
              el.y = exitT.y - el.height / 2
            }
            el.velocity = 0
            crossTrack.delete(agent.id)
          }
        } else {
          crossTrack.delete(agent.id)
        }
        if (gateAge >= POST_GATE_MAX) {
          console.warn('[post-gate-cap] агент завершён принудительно:', agent.state, agent.id)
          const atF = agent.afterTarget
          if (Number.isFinite(atF?.x) && Number.isFinite(atF?.y)) {
            el.x = atF.x - el.width / 2
            el.y = atF.y - el.height / 2
          } else {
            el.x = (el.x < sceneSize.value.width / 2)
              ? -DESPAWN_MARGIN - el.width
              : sceneSize.value.width + DESPAWN_MARGIN
          }
          el.velocity = 0
          agent.state = 'done'
          postGateTrack.delete(agent.id)
          continue
        }
      } else if (agent.state === 'to_gate') {
        postGateTrack.delete(agent.id)
      }

      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const tx = agent.target.x + agent.target.width / 2
      const ty = agent.target.y + agent.target.height / 2
      let dx = tx - cx
      let dy = ty - cy
      let dist = Math.hypot(dx, dy)

      // [ФИКС-очередь] раньше здесь был continue: агент, вставший ровно на цель
      // (dist ≈ 0 при удавшемся шаге кадра), навсегда пропускал блок прибытия
      // ниже и зависал в to_gate; остальные агенты его направления выстраивались
      // позади (car-following) и замирали — «выходящие стоят на месте».
      if (dist < 0.01) dist = 0

      const dirX = dist > 0 ? dx / dist : 0
      const dirY = dist > 0 ? dy / dist : 0

      // [ФИКС-ДРОЖАНИЕ] прибытие = цель достигнута текущим шагом кадра.
      // Раньше порог был только dist < ARRIVE_THRESHOLD (1px): при крупном
      // шаге (лаги Electron, dt до 0.1с) агент перепрыгивал цель и вечно
      // «дрожал» вокруг неё — позиция ходила туда-сюда ровно на velocity*dt
      // (>3px — stall-watchdog сбрасывался каждый кадр), а дистанция так и
      // не опускалась ниже порога (цикл |d - s|). Именно так «застревали»
      // вошедший человек и въехавшая машина сразу после ворот.
      const stepLen = (el.velocity || 0) * dt
      const reachedByStep = (el.velocity || 0) > 0.5 && stepLen > 0 && dist <= stepLen
      if (dist < ARRIVE_THRESHOLD || reachedByStep) {
        // точная посадка в центр цели — без остаточной дистанции
        el.x = tx - el.width / 2
        el.y = ty - el.height / 2
        if (agent.state === 'to_gate') {
          el.velocity = 0
          agent.state = 'waiting_before'
          // [PAYROLL] фиксируем момент подхода: отсюда считаются и ожидание
          // ворот, и опоздание записи
          waitStartByAgentId.set(agent.id, Date.now())
          try {
            payrollHooks?.onAgentArrive?.(agent)
          } catch (e) {
            console.error('[physics] onAgentArrive упал:', e)
          }
        } 
        else if (agent.state === 'crossing') {
          // [ФИКС-РЫВОК-ПОСЛЕ-КАЛИТКИ] скорость на стыке crossing ->
          // moving_away НЕ обнуляется: обнуление на 1-2 кадра ставило анимацию
          // ходьбы на паузу (гистерезис is-paused) посреди шага — видимый
          // «дёрганчик» в точке останова после калитки. Пешеход продолжает
          // шаг с текущей скоростью; машину останавливает ветка waiting_after.
          // [СХЕМА-ТРАЕКТОРИЙ] после прохода агент оказывается на ПРОТИВОПОЛОЖНОЙ
          // стороне забора: входящий — у базы (перед забором, 400),
          // выходящий — в городе (за забором, 150)
          const targetZ = agent.direction === 'enter' ? 400 : 150
          if ((el.zIndex || 0) !== targetZ) {
            el.zIndex = targetZ
            simElements.value = [...simElements.value]
          }

          // [ФИКС-висяки] пешеходу waiting_after не положен: в этой ветке он
          // ждал бы закрытия прохода/машину и замирал у калитки навсегда.
          // Калитка шире 60px без метки gateType раньше проваливалась сюда.
          if (isWicket || agent.type === 'person') {
            agent.state = 'moving_away'
            agent.target = { ...agent.afterTarget, width: 0, height: 0 }
            tryActivateNextInGroup(agent, gate)

            let shouldClose = true
            if (agent.groupId) {
              const leader = aiAgents.value.find(a => a.groupId === agent.groupId && a.isLeader)
              if (leader && leader.groupMembers) {
                const anyRemaining = leader.groupMembers.some(m =>
                  m.state === 'waiting_before' || m.state === 'crossing'
                )
                if (anyRemaining) shouldClose = false
              }
            }

            if (shouldClose && gate && gate.settings?.isOpen && !gate.settings?.isAnimating && !gate.settings?.isStopping) {
              if (closeDelay === 0) {
                // [ФИКС-очередь] мгновенное закрытие после КАЖДОГО прошедшего
                // глушило калитку, даже если у неё ещё ждут люди (в таймерной
                // ветке проверка hasOtherWaiting есть, здесь — не было)
                const hasOtherWaiting = aiAgents.value.some(a =>
                  a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) &&
                  ((a.type === 'person' && String(gate.id) === cfg.personGateId) ||
                   (a.type === 'car' && String(gate.id) === cfg.carGateId))
                )
                if (!hasOtherWaiting) closeGateFn(gate)
              }
              else {
                if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
                const timer = setTimeout(() => {
                  const currentGate = simElements.value.find(g => String(g.id) === gateId)
                  if (currentGate && currentGate.settings?.isOpen && !currentGate.settings?.isAnimating && !currentGate.settings?.isStopping) {
                    const hasOtherWaiting = aiAgents.value.some(a =>
                      a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) &&
                      ((a.type === 'person' && String(currentGate.id) === cfg.personGateId) ||
                      (a.type === 'car' && String(currentGate.id) === cfg.carGateId))
                    )
                    if (!hasOtherWaiting) closeGateFn(currentGate)
                  }
                  gateCloseTimers.delete(gateId)
                }, closeDelay * 1000)
                gateCloseTimers.set(gateId, timer)
              }
            }
          } 
          else {
            el.velocity = 0 // машина встаёт на точку останова после ворот
            agent.state = 'waiting_after'
            // [ФИКС-висяки-2] closeDelay=0: раньше таймер не ставился вовсе —
            // ворота не закрывались никогда, машина стояла в ожидании вечно.
            if (gate && gate.settings?.isOpen && !gate.settings?.isAnimating && closeDelay >= 0 && !gateCloseTimers.has(gateId) && !gate.settings?.isStopping) {
              if (closeDelay === 0) {
                const hasActiveAgents = aiAgents.value.some(a =>
                  (a.state === 'crossing' || (a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id))) &&
                  ((a.type === 'car' && String(gate.id) === cfg.carGateId) ||
                   (a.type === 'person' && String(gate.id) === cfg.personGateId))
                )
                if (!hasActiveAgents) closeGateFn(gate)
              }
              else {
              const timer = setTimeout(() => {
                const currentGate = simElements.value.find(g => String(g.id) === gateId)
                if (currentGate && currentGate.settings?.isOpen && !currentGate.settings?.isAnimating && !currentGate.settings?.isStopping) {
                  const hasActiveAgents = aiAgents.value.some(a =>
                    (a.state === 'crossing' || (a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id))) &&
                    ((a.type === 'car' && String(currentGate.id) === cfg.carGateId) ||
                     (a.type === 'person' && String(currentGate.id) === cfg.personGateId))
                  )
                  if (!hasActiveAgents) closeGateFn(currentGate)
                }
                gateCloseTimers.delete(gateId)
              }, closeDelay * 1000)
              gateCloseTimers.set(gateId, timer)
              }
            }
          }
        } 
        else if (agent.state === 'moving_away') {
          agent.state = 'done'
        }
        continue
      }

      let distanceToLeader = Infinity
      let leaderSpeed = Infinity
      const myLen = Math.max(el.width, el.height)
      const myWid = Math.min(el.width, el.height)

      for (const other of sorted) {
        if (other.id === agent.id) continue
        if (other.type !== agent.type) continue
        if (other.direction !== agent.direction) continue
        const ox = other.element.x + other.element.width / 2
        const oy = other.element.y + other.element.height / 2
        const toX = ox - cx
        const toY = oy - cy
        const forward = dot({ x: toX, y: toY }, { x: dirX, y: dirY })
        // forward <= 0: центр другого позади/совпадает с моим — он не впереди,
        // стоповать друг друга взаимно нельзя (двое в одной точке заморозили
        // бы друг друга навсегда). Совпавшие центры разводит расхождение ниже.
        if (forward <= 0 || forward > MAX_LOOKAHEAD) continue
        const lateral = Math.abs(cross({ x: toX, y: toY }, { x: dirX, y: dirY }))
        const otherWid = Math.min(other.element.width, other.element.height)
        if (lateral > myWid / 2 + otherWid / 2 + 15) continue
        const otherLen = Math.max(other.element.width, other.element.height)
        const gap = forward - (myLen / 2 + otherLen / 2)
        // [ФИКС-СКВОЗЬ] gap <= 0 — корпуса уже пересеклись: раньше такой
        // «препятствие» игнорировалось (условие gap > 0), и агент спокойно
        // проходил сквозь стоящего/медленного впереди. Пересечение = дистанция
        // 0: экстренное торможение за уходящим впереди.
        if (gap <= 0) {
          if (distanceToLeader > 0) {
            distanceToLeader = 0
            leaderSpeed = other.element.velocity || 0
          }
        } else if (gap < distanceToLeader) {
          distanceToLeader = gap
          leaderSpeed = other.element.velocity || 0
        }
      }

      let targetSpeed = agent.speed
      const safeDistance = Math.max(MIN_BUFFER, (el.velocity || 0) * REACTION_TIME)
      if (distanceToLeader < safeDistance) {
        targetSpeed = Math.min(targetSpeed, leaderSpeed * 0.8)
        if (distanceToLeader < safeDistance * 0.5) targetSpeed = 0
      }
      // [ФИКС-УСТУПИ-ДОРОГУ] вблизи любого пешехода ПО КУРСУ (в том числе
      // встречного — leader-follow их не видит) сбавляем шаг: попарное
      // торможение даёт расхождению время развести людей в стороны без
      // прохода насквозь. Math.min — никогда не УВЕЛИЧИВАЕТ скорость,
      // поэтому очереди leader-follow (targetSpeed = 0) не ломаются.
      let personNearAhead = Infinity
      if (agent.type === 'person') {
        let near2 = Infinity
        for (const other of aiAgents.value) {
          if (other.id === agent.id || other.type !== 'person' || other.state === 'done') continue
          // [ФИКС-УСТУПИ-ДОРОГУ] своих по группе не считаем помехой:
          // группа идёт строем и не тормозит сама перед собой
          if (agent.groupId && other.groupId === agent.groupId) continue
          const ox = other.element.x + other.element.width / 2 - cx
          const oy = other.element.y + other.element.height / 2 - cy
          const ahead = ox * dirX + oy * dirY
          if (ahead < 0 || ahead > 90) continue
          const lateral = Math.abs(ox * dirY - oy * dirX)
          if (lateral > 30) continue
          const d2 = ahead * ahead + lateral * lateral
          if (d2 < near2) near2 = d2
        }
        personNearAhead = Math.sqrt(near2)
        if (personNearAhead < PERSON_SEP_RADIUS * 1.6) {
          targetSpeed = Math.min(targetSpeed, Math.max(14, personNearAhead * 0.5))
        }
      }
      // [ФИКС-РЫВОК] плавное торможение к точке останова: скорость
      // пропорциональна остатку пути (с нижним порогом), а не ступенька
      // «dist<80 -> сразу 30». Подход к цели заканчивается мягко,
      // скорость к моменту прибытия уже сопоставима с шагом кадра.
      if (dist < 80) {
        targetSpeed = Math.min(targetSpeed, Math.max(12, dist * 0.55))
      }

      if ((el.velocity || 0) < targetSpeed) {
        el.velocity = Math.min(targetSpeed, (el.velocity || 0) + ACCEL * dt)
      } else {
        el.velocity = Math.max(targetSpeed, (el.velocity || 0) - DECEL * dt * 2)
      }

      const targetAngle = Math.atan2(dirY, dirX)
      let angleDiff = normalizeAngle(targetAngle - (el.rotation || 0) + SPRITE_ORIENTATION_OFFSET)
      el.rotation = (el.rotation || 0) + angleDiff * 0.1

      if ((el.velocity || 0) > 0.5) {
        // [ФИКС-РЫВОК] шаг не длиннее остатка дистанции: при разгоне
        // фактический шаг (velocity УЖЕ после разгона) * dt бывал больше
        // остатка, агент перескакивал точку останова и «возвратом» давал рывок
        const moveStep = Math.min((el.velocity || 0) * dt, dist)
        el.x += dirX * moveStep
        el.y += dirY * moveStep
      }

      // [ФИКС-УСТУПИ-ДОРОГУ] мягкое расхождение пешеходов: в зоне радиуса
      // PERSON_SEP_RADIUS каждый ДВИЖУЩИЙСЯ пешеход смещается от соседа.
      // [ФИКС-ЕСТЕСТВЕННОСТЬ] вектор отталкивания проецируется НА
      // ПЕРПЕНДИКУЛЯР к своему курсу — человек ОТСТУПАЕТ ВБОК, уступая
      // дорогу, а не пятится назад (радиальная «назад»-составляющая раньше
      // гасила ход и разворачивала обход широкой дугой — «обошёл вокруг»).
      // Стоящих не толкаем: строй группы и очереди у прохода не расползаются.
      // [ФИКС-ДЁРГАНИЕ] в тихой зоне прибытия (dist < ARRIVE_QUIET_ZONE)
      // расталкивание и дрейф отключены — подход к точке остановки плавный.
      if (agent.type === 'person' && (el.velocity || 0) > 0.5 && dist >= ARRIVE_QUIET_ZONE) {
        const ccx = el.x + el.width / 2
        const ccy = el.y + el.height / 2
        let sepX = 0, sepY = 0, maxW = 0
        for (const other of aiAgents.value) {
          if (other.id === agent.id || other.type !== 'person' || other.state === 'done') continue
          // своих по группе не раскидываем — колонна/строй сохраняется
          if (agent.groupId && other.groupId === agent.groupId) continue
          const ocx = other.element.x + other.element.width / 2
          const ocy = other.element.y + other.element.height / 2
          const ax = ccx - ocx
          const ay = ccy - ocy
          const d = Math.hypot(ax, ay)
          if (d < 0.01) {
            // центры совпали (спавн в одной точке): детерминированно разводим
            // по разные стороны от курса по порядку id — иначе взаимный стоп
            const s = String(agent.id) < String(other.id) ? 1 : -1
            sepX += -dirY * s
            sepY += dirX * s
            maxW = Math.max(maxW, 0.6)
            continue
          }
          if (d >= PERSON_SEP_RADIUS) continue
          const w = (PERSON_SEP_RADIUS - d) / PERSON_SEP_RADIUS // 0..1
          const nx = ax / d, ny = ay / d
          // [ФИКС-ЕСТЕСТВЕННОСТЬ] только РАДИАЛЬНАЯ составляющая «от соседа»:
          // боковая добавка (0.8) для лобовых встреч была противонаправлена
          // дрейфу «держись правее» и гасила расхождение
          sepX += nx * w
          sepY += ny * w
          maxW = Math.max(maxW, w)
        }
        const mRaw = Math.hypot(sepX, sepY)
        // [ФИКС-ЛОБОВЫЕ] правило «держись правее» работает НЕЗАВИСИМО от
        // наличия перпендикулярной составляющей: при точном лобовом контакте
        // радиальный «от соседа» проецируется на перпендикуляр в ноль, и без
        // дрейфа встречные проходят друг сквозь друга
        if (personNearAhead < PERSON_SEP_RADIUS) {
          el.x += -dirY * PERSON_YIELD_SPEED * dt
          el.y += dirX * PERSON_YIELD_SPEED * dt
        }
        if (mRaw > 0.01 && maxW > 0) {
          // [ФИКС-ЕСТЕСТВЕННОСТЬ] оставляем только перпендикулярную к курсу
          // составляющую: шаг ВБОК, без хода назад/вперёд от толчка
          const par = sepX * dirX + sepY * dirY
          const perpX = sepX - par * dirX
          const perpY = sepY - par * dirY
          const m = Math.hypot(perpX, perpY)
          if (m > 0.01) {
            const push = maxW * PERSON_SEP_SPEED * dt
            el.x += (perpX / m) * push
            el.y += (perpY / m) * push
          }
        }
      }

      // [ФИКС-висяки] деспавн за пределами сцены — для всех одинаково:
      // прежний skip для exit оставлял вечные призраки при мусорных целях
      // (агент уходил за край и занимал слот лимита минутами)
      if (el.x + el.width < -DESPAWN_MARGIN || el.x > sceneSize.value.width + DESPAWN_MARGIN ||
          el.y + el.height < -DESPAWN_MARGIN || el.y > sceneSize.value.height + DESPAWN_MARGIN) {
        agent.state = 'done'
      }
    }
  }

  const clearAllTimers = () => {
    for (const timer of gateCloseTimers.values()) clearTimeout(timer)
    gateCloseTimers.clear()
  }

  const cancelCloseTimer = (gateId: string) => {
    const timer = gateCloseTimers.get(gateId)
    if (timer) clearTimeout(timer)
    gateCloseTimers.delete(gateId)
  }

  return { updateAiMovement, clearAllTimers, cancelCloseTimer }
}