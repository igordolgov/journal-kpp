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
  // [БАГ-РЕПОРТ-5-ЗОНЫ] уступание (торможение перед чужим корпусом, боковое
  // расхождение, «держись правее») работает ТОЛЬКО при входе/выходе — у
  // СВОИХ ворот. Вдали от ворот (горизонтальное движение по дороге) агенты
  // проезжают/проходят сквозь друг друга, «как раньше»: взаимные остановки
  // посреди дороги давали «машины не могут разъехаться» и лишние
  // подёргивания при горизонтальном ходу.
  const PERSON_GATE_ZONE = 130   // px от центра калитки
  const CAR_GATE_ZONE = 240      // px от центра автомобильных ворот

  // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] машины уступают проезд друг другу «как
  // люди»: стоящая у прохода машина (и машина на самом подходе к остановке)
  // ОТЪЕЗЖАЕТ ПО СВОЕЙ ОСИ ПОДХОДА, освобождая коридор проезда: въезжающая —
  // назад по дороге от ворот, выезжающая — назад вглубь базы. Человек при
  // уступании шагает вбок (PERSON_SEP_*), машине «шагнуть» некуда — она
  // отступает по своей оси, а когда коридор свободен — возвращается на
  // остановку (state to_gate, ретаргет приводит на место).
  // Раньше (до №6) припаркованная встречная машина стояла НА пути проезда:
  // проезжающая тормозила перед ней, а сторож через 10с телепортировал её на
  // цель — «машина мгновенно оказывается в месте ожидания закрытия ворот».
  const CAR_YIELD_SPEED = 55     // px/с: темп отъезда (задний ход)
  // [БАГ-РЕПОРТ-8-СТОП] кап отъезда 150 -> 175: остановка выезда поднята к
  // линии ворот (240), и отъезд на 150 оставлял выезжающую В зоне прохода
  // (240+150=390 < граница зоны 160+240=400) — уезжающая вниз машина вежливо
  // замирала перед ней навсегда (hold 'leader' + hold 'car-yield', оба «не
  // зависли»). 175 выносит отъехавшую за границу зоны (240+175=415 > 400):
  // уезжающая проходит коридор, отъехавшая возвращается на остановку.
  const CAR_YIELD_MAX = 175      // px: предел отъезда от своей остановки
  // «опасная зона» остановки: отъезжаем, пока не отойдем на столько — корпус
  // машины 80 + буфер leader-follow 15 + запас: иначе проезжающая встаёт в
  // упор к отъехавшей и StallWatchdog/cap снова приносят телепорты
  const CAR_YIELD_NEAR_STOP = 100
  const CAR_YIELD_REAPPROACH = 4 // px: отъезд, после которого нужен возврат
  // встречная стоит ПРЯМО НА моей остановке (посадке прохода) — отъезжаю:
  // радиус меньше CAR_EXIT_PULL_PAST (40), чтобы ожидающая выше дороги
  // машина не считалась «стоящей на моей остановке»
  const CAR_YIELD_ON_MY_SPOT = 35

  // [ФИКС-УСТУПИ-ДОРОГУ] параметры мягкого расхождения пешеходов: ближе
  // PERSON_SEP_RADIUS движущиеся пешеходы плавно смещаются друг от друга
  // (встречные — каждый в свою сторону), вместо прохода «сквозь» друг друга
  const PERSON_SEP_RADIUS = 40   // px: дистанция начала расхождения
  const PERSON_SEP_SPEED = 34    // px/с: темп бокового смещения
  const PERSON_YIELD_SPEED = 22  // px/с: постоянный дрейф «держись правее» при соседе по курсу
  // [БАГ-РЕПОРТ-4-ТОЛЧОК] ждущий у прохода уступает ЗАРАНЕЕ: реагирует на
  // любого встречного проходного состояния в этом радиусе (а не только на
  // движущегося быстрее 0.5) и отходит в сторону от линии его курса
  const PERSON_WAIT_YIELD_RADIUS = 66 // px
  // [ФИКС-ЗАСТРЯЛ-ВНИЗУ] «тихая зона» прибытия: на последнем отрезке к точке
  // остановки расталкивание и дрейф отключены — именно они дёргали агента
  // перед остановкой (толчок вбок -> коррекция курса -> новый толчок).
  // [БАГ-РЕПОРТ-4-ДЁРГАНИЕ] зона расширена 34 -> 70: покрывает весь
  // тормозной отрезок (dist < 80), поэтому подход к линии ворот плавный
  const ARRIVE_QUIET_ZONE = 70   // px
  // [БАГ-РЕПОРТ-4-ЗАКРЫТИЕ] приехавшая машина ждёт ПОЛНОГО закрытия ворот
  // (и свободной стороны выезда — уступание машин).
  // Предохранитель: если ворота не закрылись/не освободилась дорога за
  // WAIT_AFTER_MAX секунд — уезжаем принудительно (не виснем навечно)
  const WAIT_AFTER_MAX = simOpts.waitAfterMax ?? 30  // сек
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
  // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] текущий отъезд машины от своей остановки
  // (px) пока она уступает проезд; чистится при деспавне и возврате
  const carBackoffByAgentId = new Map<string, number>()
  // [БАГ-РЕПОРТ-7-АНТИ-ТЕЛЕПОРТ] причина ВЕЖЛИВОЙ остановки агента в
  // движущемся состоянии («leader» — едет/идёт за кем-то, «standing» —
  // человек на курсе, «car-yield» — уступает проезд, «oncoming» — пропускает
  // встречную, «person-near» — ползёт за пешеходом). Сторож читает флаг
  // ПРОШЛОГО кадра: агент, которого остановила вежливость, не «завис» —
  // телепортить и форсировать его нельзя. Раньше такие остановки (уступание,
  // очередь за припаркованной, человек чуть сбоку от курса) выглядели для
  // сторожа зависанием: через 10с он ПРЫГАЛ на цель — «за секунду до
  // остановки агент мгновенно телепортируется в точку ожидания».
  const holdByAgentId = new Map<string, string>()
  // [БАГ-РЕПОРТ-7-ПРОХОД] «права прохода» (остаток, сек): пост-гейтовый
  // пешеход, застрявший за стоящим у прохода, 3с идёт БЕЗ удержаний —
  // мягко дотеходит до цели (сепарация скользит вокруг встречных) вместо
  // прыжка сторожа/капа. crossing/moving_away — зона, где дорогу уступают
  // МНЕ, поэтому мягкий дожим прохода корректен.
  const bypassByAgentId = new Map<string, number>()
  // [БАГ-РЕПОРТ-7-КАП] последняя позиция агента в crossing: лимит crossing
  // копится только пока агент НЕ движется (>3px за кадр сбрасывают счётчик).
  // Медленно, но верно идущий через калитку не «завис» — прыгать на него
  // нельзя (это и был «скачок после калитки»).
  const crossLastPos = new Map<string, { x: number; y: number }>()
  
  // ✅ автоматическая очистка при размонтировании
  onScopeDispose(() => {
    clearAllTimers()
  })

  // [БАГ-РЕПОРТ-5-ЗОНЫ] дистанция от центра агента до центра ЕГО ворот
  // (калитки для людей, автомобильных ворот для машин)
  const distToGateCenter = (a: AiAgent, gate: SceneElement | undefined): number => {
    if (!gate) return Infinity
    return Math.hypot(
      a.element.x + a.element.width / 2 - (gate.x + gate.width / 2),
      a.element.y + a.element.height / 2 - (gate.y + gate.height / 2),
    )
  }

  // [БАГ-РЕПОРТ-6-АНТИ-СКАЧОК] свободна ли зона текущей цели: телепорт
  // сторожа на занятую кем-то цель выглядел как «агент мгновенно прыгнул на
  // другое место» (и вообще на другого агента). Занято — ждём дальше.
  const targetAreaClear = (agent: AiAgent): boolean => {
    const t = agent.target
    if (!Number.isFinite(t?.x) || !Number.isFinite(t?.y)) return false
    const tcx = t.x + (t.width || 0) / 2
    const tcy = t.y + (t.height || 0) / 2
    for (const o of aiAgents.value) {
      if (o.id === agent.id || o.state === 'done') continue
      const ocx = o.element.x + o.element.width / 2
      const ocy = o.element.y + o.element.height / 2
      if (Math.hypot(ocx - tcx, ocy - tcy) < 26) return false
    }
    return true
  }

  // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] должен ли я (машина) уступить проезд.
  // 0 — нет; 1 — стою на месте (не приближаюсь к проходу);
  // 2 — отъезжаю ПО СВОЕЙ ОСИ прямо сейчас (я у остановки/на пути).
  // Триггеры:
  //  • встречная в crossing — её путь это мой коридор;
  //  • встречная стоит в waiting_after ПРЯМО НА моей остановке (посадка
  //    въезда = остановка выезда) — освобождаю место;
  //  • встречная уезжает (moving_away) сквозь мой вертикальный коридор вниз —
  //    выезжающая машина отступает, чтобы не встать под уезд въезжающей.
  const carYieldLevel = (agent: AiAgent, gate: SceneElement | undefined, includeWaitingAfter: boolean): 0 | 1 | 2 => {
    if (!gate) return 0
    const el = agent.element
    const gcx = gate.x + gate.width / 2
    const myCy = el.y + el.height / 2
    const tx = agent.target.x + (agent.target.width || 0) / 2
    const ty = agent.target.y + (agent.target.height || 0) / 2
    const nearStop = Math.hypot(el.x + el.width / 2 - tx, el.y + el.height / 2 - ty) < CAR_YIELD_NEAR_STOP
    for (const o of aiAgents.value) {
      if (o.id === agent.id || o.type !== 'car' || o.direction === agent.direction || o.state === 'done') continue
      if (o.state === 'crossing') return nearStop ? 2 : 1
      // [№9-ПРИОРИТЕТ-ВЫЕЗДА] выезжающая стоит/подъезжает к своему створу
      // (базовая сторона, зона ворот) — въезжающая освобождает полосу:
      // у остановки отъезжает назад по дороге (2), на подходе тормозит к
      // границе створа (1). Только на подходе/стоянке: в crossing машиной
      // управляют leader-follow и очередь направлений.
      if (agent.direction === 'enter' &&
          (agent.state === 'to_gate' || agent.state === 'waiting_before') &&
          (o.state === 'to_gate' || o.state === 'waiting_before')) {
        const ocyYield = o.element.y + o.element.height / 2
        if (ocyYield > gate.y + gate.height - 10 &&
            distToGateCenter(o, gate) <= GATE_ZONE_CAR) {
          return nearStop ? 2 : 1
        }
      }
      if (includeWaitingAfter && o.state === 'waiting_after') {
        const ocx = o.element.x + o.element.width / 2
        const ocy = o.element.y + o.element.height / 2
        if (Math.hypot(ocx - tx, ocy - ty) < CAR_YIELD_ON_MY_SPOT) return nearStop ? 2 : 1
      }
      if (o.state === 'moving_away' && agent.direction === 'exit' && o.direction === 'enter') {
        const ocx = o.element.x + o.element.width / 2
        const ocy = o.element.y + o.element.height / 2
        const oTargetY = o.afterTarget?.y
        if (Number.isFinite(oTargetY) && Math.abs(ocx - gcx) < 70 && ocy < myCy && oTargetY > myCy) return 2
      }
    }
    return 0
  }

  // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] отъезжает ли машина-лидер ВДОЛЬ нашего
  // курса: её ось отъезда (выезжающая — вниз +y, въезжающая — назад по
  // дороге от ворот) сонаправлена нашему направлению движения.
  const retreatsAlongCourse = (o: AiAgent, dirX: number, dirY: number): boolean => {
    if (!carBackoffByAgentId.has(o.id)) return false
    const isExitO = o.direction === 'exit'
    const ax = isExitO ? 0 : (((o.element.settings as any)?._facingLeft !== false) ? 1 : -1)
    const ay = isExitO ? 1 : 0
    return ax * dirX + ay * dirY > 0.5
  }

  // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] свободен ли путь ВОЗВРАТА на мою
  // остановку: своя колонна (тот же direction) не помеха, чужие машины в
  // полосе между мной и воротами и чужой crossing — жду на отъезде.
  const carCorridorFree = (agent: AiAgent, gate: SceneElement | undefined): boolean => {
    if (!gate) return false
    const el = agent.element
    const gcx = gate.x + gate.width / 2
    const gBottom = gate.y + gate.height
    const myCx = el.x + el.width / 2
    const myCy = el.y + el.height / 2
    for (const o of aiAgents.value) {
      if (o.id === agent.id || o.type !== 'car' || o.state === 'done') continue
      if (o.state === 'crossing') return false
      if (o.direction === agent.direction) continue
      const ocx = o.element.x + o.element.width / 2
      const ocy = o.element.y + o.element.height / 2
      if (agent.direction === 'exit') {
        // вертикальный коридор между линией ворот и мной
        if (Math.abs(ocx - gcx) < 70 && ocy > gBottom - 10 && ocy < myCy - 24) return false
      } else {
        // полоса дороги между мной и воротами. [БАГ-РЕПОРТ-7] 45 -> 36:
        // своя полоса выезда (roadY - CAR_EXIT_PULL_PAST = 40 от дороги)
        // НЕ блокирует возврат въезжающей на дорогу — корпуса там только
        // касаются (полусуммы 40), раньше возврат висел, пока выезжающая
        // ждёт закрытия/уезжает, и пара вставала нос к хвосту навсегда
        const roadY = gBottom - el.height / 2
        if (Math.abs(ocy - roadY) < 36) {
          const fl = (el.settings as any)?._facingLeft !== false
          const towardGate = fl ? -1 : 1
          const inFront = towardGate < 0
            ? (ocx < myCx + 10 && ocx > gcx - 40)
            : (ocx > myCx - 10 && ocx < gcx + 40)
          if (inFront) return false
        }
      }
    }
    return true
  }

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
        carBackoffByAgentId.delete(agent.id) // [БАГ-РЕПОРТ-6] без утечек отъезда
        holdByAgentId.delete(agent.id) // [БАГ-РЕПОРТ-7] без утечек
        bypassByAgentId.delete(agent.id) // [БАГ-РЕПОРТ-7] без утечек
        crossLastPos.delete(agent.id) // [БАГ-РЕПОРТ-7-КАП] без утечек
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
      // [БАГ-РЕПОРТ-4-ОЧЕРЕДЬ] СВОЯ машина в зоне прохода (crossing /
      // waiting_after) тоже занимает ворота: она стоит/едет ровно на линии
      // выезда, и вторая машина въезжала в неё. Ворота обслуживают по одной
      // машине, независимо от направления потока.
      if (agent.type === 'car') {
        for (const o of aiAgents.value) {
          if (o.id === agent.id || o.type !== 'car' || o.direction !== agent.direction || o.state === 'done') continue
          if (o.state !== 'crossing' && o.state !== 'waiting_after') continue
          const ocx = o.element.x + o.element.width / 2
          const ocy = o.element.y + o.element.height / 2
          if (Math.abs(ocx - gcx) > 100 || Math.abs(ocy - gcy) > 140) continue
          return true
        }
      }
      // [№9-ПРИОРИТЕТ-ВЫЕЗДА] въезжающая не начинает проход, пока выезжающая
      // занимает свой створ с базовой стороны (to_gate/waiting_before в зоне
      // ворот): выезд идёт ПЕРВЫМ, въезжающая отъезжает (carYieldLevel) и ждёт.
      // Раньше FCFS мог пустить въезжающую первой — она заезжала В корпус
      // стоящей выезжающей («въезжающая толкает выезжающую»), и пара
      // расходилась только по предохранителям (25/90с).
      if (agent.type === 'car' && agent.direction === 'enter') {
        const gBottomOcc = gate.y + gate.height
        for (const o of aiAgents.value) {
          if (o.id === agent.id || o.type !== 'car' || o.direction !== 'exit' || o.state === 'done') continue
          if (o.state !== 'to_gate' && o.state !== 'waiting_before') continue
          const ocyOcc = o.element.y + o.element.height / 2
          if (ocyOcc <= gBottomOcc - 10) continue
          if (distToGateCenter(o, gate) > GATE_ZONE_CAR) continue
          return true
        }
      }
      for (const o of aiAgents.value) {
        if (o.id === agent.id || o.type !== agent.type || o.direction !== opp || o.state === 'done') continue
        // проход или стоянка сразу за проходом — занимают всегда
        if (o.state === 'crossing' || o.state === 'waiting_after') return true
        const ocx = o.element.x + o.element.width / 2
        const ocy = o.element.y + o.element.height / 2
        if (Math.hypot(ocx - gcx, ocy - gcy) >= zoneR) continue
        if (o.state === 'waiting_before') {
          // [№9-ПРИОРИТЕТ-ВЫЕЗДА] выезд не ждёт очереди у въезжающей, стоящей
          // на дороге (её бампер не ниже линии ворот): въезжающая уступает
          // физически — отъезжает по дороге (carYieldLevel), выезжающая
          // проходит первой. Без этого пара «нос к носу» ждала FCFS друг
          // друга и расходилась только по предохранителям.
          if (agent.direction === 'exit' &&
              (o.element.y + o.element.height) <= gate.y + gate.height + 10) continue
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
      const gateId = agent.type === 'car' ? cfg.carGateId : cfg.personGateId
      const gate = simElements.value.find(g => String(g.id) === gateId)
      const isWicket = gate?.settings?.gateType === 'wicket' || (gate?.width && gate.width <= 60)
      const closeDelay = isWicket ? wicketCloseDelay : gateCloseDelay
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
            // [БАГ-РЕПОРТ-7-АНТИ-ТЕЛЕПОРТ] «очередь за своим» с ШИРОКИМ
            // окном и для ВСЕХ движущихся состояний: свой агент в коридоре
            // между мной и целью (впереди до самой цели +40, сбоку до 60 —
            // шире коридора торможения 55) — легитимная причина стоять.
            // Раньше окно было 80/30 и только для to_gate: препятствие чуть
            // сбоку (40-55) или чуть дальше 80px делало сторожа «слепым»,
            // и он прыгал на цель («мгновенно оказывается в точке ожидания»,
            // «скачок после калитки»).
            const mateAhead = aiAgents.value.some(o => {
              if (o.id === agent.id || o.type !== agent.type || o.state === 'done') return false
              // [БАГ-РЕПОРТ-4] помеха на курсе может быть ВСТРЕЧНОЙ (машина,
              // выезжающая с ворот, или человек, отходящий в сторону) —
              // фильтр по direction снят.
              // [ФИКС-взаимная-блокировка] «свой» впереди — законная причина
              // ждать, если он реально движется или стоит на ЛЕГАЛЬНОЙ
              // стоянке (waiting_before — уступит и разойдётся; waiting_after
              // — машина, ждущая закрытия ворот, уедет). Два СТОЯЩИХ to_gate
              // с пересекающимися целями иначе спасают друг друга вечно.
              const oMoving = (o.element.velocity || 0) > 0.5
              if (!oMoving && o.state !== 'waiting_before' && o.state !== 'waiting_after') return false
              const ox = o.element.x + o.element.width / 2 - cx0
              const oy = o.element.y + o.element.height / 2 - cy0
              const f = ox * ux + oy * uy
              return f > 0 && f < dd + 40 && Math.abs(ox * uy - oy * ux) < 60
            })
            // [БАГ-РЕПОРТ-7-АНТИ-ТЕЛЕПОРТ] вежливая остановка прошлого кадра:
            // уступание/следование/человек на курсе — не зависание
            const held = holdByAgentId.has(agent.id)
            // [БАГ-РЕПОРТ-7-ПРОХОД] пост-гейтовый пешеход имеет ПРАВО
            // ПРОХОДА: дорогу в crossing/moving_away уступают ЕМУ, поэтому
            // застрявшего за стоящим спасаем мягко — 3с без удержаний,
            // дотеходит сам. Машины и входящие ждут: их блокирует легальная
            // очередь/стоянка, она разойдётся сама (WAIT_AFTER_MAX,
            // DIR_BLOCK_MAX, force-cross).
            const postGatePerson = agent.type === 'person' &&
              (agent.state === 'crossing' || agent.state === 'moving_away')
            if (postGatePerson && (mateAhead || held || !targetAreaClear(agent))) {
              bypassByAgentId.set(agent.id, 3)
            } else if (!mateAhead && !held) {
              // [БАГ-РЕПОРТ-6-АНТИ-СКАЧОК] телепорт ТОЛЬКО на свободную цель
              // и только если агент не уступает проезд: скачок на занятую
              // кем-то цель выглядел как «мгновенно оказался в другом месте»
              // (машина прыгала на место ожидания, занятое встречной),
              // а стоящий в ожидании проезда агент — это штатная вежливость.
              // [БАГ-РЕПОРТ-7] carYieldLevel теперь учитывает waiting_after:
              // машина, отъехавшая из-за припаркованной, тоже «вежлива».
              const yieldingNow = agent.type === 'car' &&
                carYieldLevel(agent, gate, true) > 0
              if (!yieldingNow && targetAreaClear(agent)) {
                console.warn('[watchdog] агент стоял', STALL_LIMIT, 'с — телепорт на цель:', agent.state, agent.id)
                // [WATCHDOG] дистанция в физике считается центр-к-центру,
                // поэтому выравниваем ЦЕНТР элемента на центр цели,
                // иначе остаточная дистанция (h/2) не даст прибытию сработать
                el.x = agent.target.x - el.width / 2
                el.y = agent.target.y - el.height / 2
                el.velocity = 0
              }
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

      // [БАГ-РЕПОРТ-7] флаг вежливой остановки сторож прочитал — кадр
      // начинается заново: движение ниже поставит его при необходимости
      holdByAgentId.delete(agent.id)

      // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] отъезд/возврат машины у прохода.
      // Действует на подходе (to_gate) и в ожидании (waiting_before):
      //  • уровень 2 и я у своей остановки — отъезжаю по своей оси
      //    (въезжающая — назад по дороге, выезжающая — назад вглубь базы);
      //  • триггер отпустил и я отъезжал — возвращаюсь на остановку,
      //    когда свободен коридор возврата (carCorridorFree).
      if (agent.type === 'car' && gate && (agent.state === 'to_gate' || agent.state === 'waiting_before')) {
        const level = carYieldLevel(agent, gate, true)
        const backoff = carBackoffByAgentId.get(agent.id) ?? 0
        const tx = agent.target.x + (agent.target.width || 0) / 2
        const ty = agent.target.y + (agent.target.height || 0) / 2
        const nearStop = Math.hypot(el.x + el.width / 2 - tx, el.y + el.height / 2 - ty) < CAR_YIELD_NEAR_STOP
        // level 2 = «отъезжай сейчас»: и у своей остановки, и когда встречная
        // уезжает сквозь мой коридор (case moving_away) — с любого места
        if (level > 0 && (nearStop || level === 2) && backoff < CAR_YIELD_MAX) {
          if (backoff === 0) waitStartByAgentId.delete(agent.id) // выходим из очереди FCFS, вернёмся в её конец
          const isExit = agent.direction === 'exit'
          const bx = isExit ? 0 : (((el.settings as any)?._facingLeft !== false) ? 1 : -1)
          const by = isExit ? 1 : 0
          // [№9] встречная в crossing — экстренная расчистка полосы: отъезд
          // на 40% быстрее, чтобы встречная не ждала лишних секунд у створа
          const oppCrossing = aiAgents.value.some(o =>
            o.id !== agent.id && o.type === 'car' && o.state === 'crossing' &&
            o.direction !== agent.direction)
          let step = (oppCrossing ? CAR_YIELD_SPEED * 1.4 : CAR_YIELD_SPEED) * dt
          step = Math.min(step, CAR_YIELD_MAX - backoff)
          if (isExit) step = Math.min(step, Math.max(0, sceneSize.value.height - 50 - (el.y + el.height)))
          if (step > 0) {
            // [№9-ЗАДНИЙ-ХОД] не отъезжаем В корпус: машина на оси отъезда
            // впереди ближе 85px — ждём (колонна отъезжает эшелонированно,
            // задний ход не бьёт задний бампер своего/чужого)
            const bl = Math.hypot(bx, by)
            let rearBlocked = false
            if (bl > 0.01) {
              const ux0 = bx / bl
              const uy0 = by / bl
              rearBlocked = aiAgents.value.some(o => {
                if (o.id === agent.id || o.type !== 'car' || o.state === 'done') return false
                const rxc = o.element.x + o.element.width / 2 - (el.x + el.width / 2)
                const ryc = o.element.y + o.element.height / 2 - (el.y + el.height / 2)
                const aheadR = rxc * ux0 + ryc * uy0
                if (aheadR < 10 || aheadR > 85) return false
                return Math.abs(rxc * uy0 - ryc * ux0) < 50
              })
            }
            if (rearBlocked) {
              el.velocity = 0
              holdByAgentId.set(agent.id, 'car-yield')
              continue
            }
            el.x += bx * step
            el.y += by * step
            el.velocity = CAR_YIELD_SPEED
            carBackoffByAgentId.set(agent.id, backoff + step)
          } else {
            el.velocity = 0
            // [БАГ-РЕПОРТ-7] предел отъезда — вежливое стояние, не зависание
            holdByAgentId.set(agent.id, 'car-yield')
          }
          continue
        }
        if (backoff > CAR_YIELD_REAPPROACH) {
          if (level === 0 && carCorridorFree(agent, gate)) {
            // коридор свободен — возвращаемся на остановку штатным подходом
            carBackoffByAgentId.delete(agent.id)
            agent.state = 'to_gate'
            const pts = trafficPointsFor(gate as any, { width: el.width, height: el.height }, agent.direction, sceneSize.value)
            agent.target = { x: pts.stop.x, y: pts.stop.y, width: 0, height: 0 }
            continue
          }
          // ждём освобождения коридора, стоя на отъезде
          el.velocity = 0
          // [БАГ-РЕПОРТ-7] вежливое стояние на отъезде, не зависание
          holdByAgentId.set(agent.id, 'car-yield')
          continue
        }
        if (backoff > 0) carBackoffByAgentId.delete(agent.id)
      }

      // [БАГ-РЕПОРТ-5-ЗОНЫ] я в зоне прохода (вход/выход)? Сам фазa crossing
      // (проход сквозь ворота/калитку) — всегда зона уступания, где бы ни
      // находился агент: уступать обязан именно в момент входа/выхода.
      const zoneR = agent.type === 'car' ? CAR_GATE_ZONE : PERSON_GATE_ZONE
      const inGateZone = distToGateCenter(agent, gate) <= zoneR
      const yieldActive = inGateZone || agent.state === 'crossing'

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
        // [БАГ-РЕПОРТ-4-ТОЛЧОК] ждущий у прохода уступает ЗАРАНЕЕ и НАСТИГАЮЩЕ:
        //  1) триггер — проходное СОСТОЯНИЕ соседа (to_gate/crossing/
        //     moving_away) в радиусе PERSON_WAIT_YIELD_RADIUS, а не его
        //     текущая скорость: входящий, уже затормозивший перед стоящим
        //     выходящим (или вставший в упор), раньше замораживал пару
        //     «оба стоят» — никто не отходил;
        //  2) боковой шаг идёт от ЛИНИИ КУРСА встречного — ждущий отходит
        //     вбок, освобождая полосу, ещё ДО контакта (раньше отходил
        //     радиально «назад» с дистанции 40px, и входящий успевал его
        //     толкнуть, прежде чем они расходились).
        // Стоящих (waiting_before/waiting_after) не сдвигаем — очередь и
        // строй групп не расползаются; своих по группе исключаем.
        if (agent.type === 'person') {
          const mcx = el.x + el.width / 2
          const mcy = el.y + el.height / 2
          let gx = 0, gy = 0, wMax = 0
          for (const other of aiAgents.value) {
            if (other.id === agent.id || other.type !== 'person' || other.state === 'done') continue
            if (agent.groupId && other.groupId === agent.groupId) continue
            if (other.state === 'waiting_before' || other.state === 'waiting_after') continue
            const ocx = other.element.x + other.element.width / 2
            const ocy = other.element.y + other.element.height / 2
            const ax = mcx - ocx
            const ay = mcy - ocy
            const d = Math.hypot(ax, ay)
            if (d < 0.01 || d >= PERSON_WAIT_YIELD_RADIUS) continue
            const w = Math.max(0.45, (PERSON_WAIT_YIELD_RADIUS - d) / PERSON_WAIT_YIELD_RADIUS)
            // радиальная составляющая «от соседа» (как раньше, но шире)
            gx += (ax / d) * w
            gy += (ay / d) * w
            // боковой шаг от линии курса встречного (основа уступания)
            const rot = other.element.rotation || 0
            const hx = Math.cos(rot)
            const hy = Math.sin(rot)
            const ahead = ax * hx + ay * hy
            if (ahead < -24) continue // он уже проехал мимо — не пятимся
            const par = ahead
            const px = ax - hx * par
            const py = ay - hy * par
            const lat = Math.hypot(px, py)
            if (lat > 34) continue    // я не на его пути
            if (lat < 0.5) {
              // точная лобовая: отходим в сторону, ПРОТИВОПОЛОЖНУЮ дрейфу
              // встречного («держись правее»), — освобождаем именно его полосу
              gx += hy * 1.2
              gy += -hx * 1.2
            } else {
              gx += (px / lat) * 1.2
              gy += (py / lat) * 1.2
            }
            wMax = Math.max(wMax, w)
          }
          if (wMax > 0) {
            const gm = Math.hypot(gx, gy)
            if (gm > 0.01) {
              const push = wMax * PERSON_SEP_SPEED * dt
              el.x += (gx / gm) * push
              el.y += (gy / gm) * push
              // [БАГ-РЕПОРТ-5-АНИМАЦИЯ] уступающий ШАГАЕТ в сторону, а не
              // скользит: боковой шаг фиксируется как скорость, чтобы
              // гистерезис is-paused не замораживал анимацию рук/ног.
              // Шаг закончился — velocity снова 0, агент «встаёт».
              el.velocity = Math.max(el.velocity || 0, Math.min(PERSON_SEP_SPEED, push / Math.max(dt, 1e-4)))
            }
          }
        }
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
        // [БАГ-РЕПОРТ-4-ЗАКРЫТИЕ] приехавшая машина стоит, пока ворота НЕ
        // закроются ПОЛНОСТЬЮ (шлагбаум опущен, анимация закончена): раньше
        // CAR_LEAVE_DELAY 1.6с выпроваживал её при ещё поднименном шлагбауме.
        // [БАГ-РЕПОРТ-4-УСТУПАНИЕ-МАШИН] выезжаем только на СВОБОДНУЮ
        // сторону дороги: раньше машина выезжала направо «в лоб» очереди
        // встречных машин (они вообще не тормозили перед ней). Занятая
        // сторона => ждём освобождения; обе заняты => ждём (предохранитель
        // WAIT_AFTER_MAX уводит в менее загруженную сторону).
        const gateFullyClosed = !gate ||
          (!gate.settings?.isOpen && !gate.settings?.isAnimating && !gate.settings?.isStopping)
        // [БАГ-РЕПОРТ-7-УЕЗД] у ворот (с любой стороны) уже стоит/проходит
        // другая машина — ждать полного закрытия бессмысленно: ворота всё
        // равно тут же понадобятся ей (таймер закрытия их и не закроет, пока
        // она активна). Уезжаем после короткой вежливой паузы, не дожидаясь
        // полного закрытия.
        const anotherCarAtGate = gate ? aiAgents.value.some(o =>
          o.id !== agent.id && o.type === 'car' && o.state !== 'done' &&
          (o.state === 'waiting_before' || o.state === 'crossing') &&
          distToGateCenter(o, gate) < GATE_ZONE_CAR
        ) : false
        // [БАГ-РЕПОРТ-5-РАЗЪЕЗД] уезд по КАНОНИЧЕСКОЙ схеме, без выбора
        // «свободной стороны»: ожидание свободной стороны при занятой дороге
        // взаимно блокировало машины («не могут разъехаться»). Въехавшая
        // уезжает ВНИЗ за нижний край (afterTarget из спавна), выехавшая —
        // ВБОК по СВОЕЙ полосе выше дороги (CAR_EXIT_PULL_PAST): её путь не
        // пересекает полосу дороги, уступать встречным/попутным не нужно —
        // на дороге машины расходятся «сквозь» (уступание только у ворот).
        if ((gateFullyClosed || anotherCarAtGate) && waitedAfter > 0.8) {
          agent.state = 'moving_away'
          agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
        } else if (waitedAfter > WAIT_AFTER_MAX) {
          // [ПРЕДОХРАНИТЕЛЬ] ворота так и не закрылись — уезжаем
          agent.state = 'moving_away'
          agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
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
          // [БАГ-РЕПОРТ-7-КАП] счётчик — только для СТОЯЩЕГО: якорь
          // обновляется лишь при кумулятивном сдвиге >3px от прошлой отметки
          // (ползущий на 0.8px/кадр — ИДЁТ, ему прыжок не положен)
          const lp = crossLastPos.get(agent.id)
          let crossAge: number
          if (!lp) {
            crossLastPos.set(agent.id, { x: el.x, y: el.y })
            crossAge = 0
            crossTrack.set(agent.id, 0)
          } else if (Math.hypot(el.x - lp.x, el.y - lp.y) > 3) {
            crossLastPos.set(agent.id, { x: el.x, y: el.y })
            crossAge = 0
            crossTrack.set(agent.id, 0)
          } else {
            crossAge = (crossTrack.get(agent.id) ?? 0) + dt
            crossTrack.set(agent.id, crossAge)
          }
          const crossLimit = agent.type === 'car' ? CROSS_MAX_CAR : CROSS_MAX_PERSON
          if (crossAge >= crossLimit) {
            // [БАГ-РЕПОРТ-7-АНТИ-ТЕЛЕПОРТ] перенос в конец прохода — только
            // для ОДИНОЧНО застрявших: без вежливой остановки, без очереди в
            // коридоре и без активных «прав прохода». Раньше лимит прыгал на
            // тех, кто легитимно ждёт/ползёт в проходе («скачок после
            // калитки»); их спасают сторож (bypass) и предохранители потоков.
            const held = holdByAgentId.has(agent.id)
            const bypassNow = (bypassByAgentId.get(agent.id) ?? 0) > 0
            const cx0 = el.x + el.width / 2
            const cy0 = el.y + el.height / 2
            const tx0 = agent.target.x + (agent.target.width || 0) / 2
            const ty0 = agent.target.y + (agent.target.height || 0) / 2
            const dd0 = Math.hypot(tx0 - cx0, ty0 - cy0)
            const ux0 = dd0 > 0 ? (tx0 - cx0) / dd0 : 0
            const uy0 = dd0 > 0 ? (ty0 - cy0) / dd0 : 0
            const mate0 = aiAgents.value.some(o => {
              if (o.id === agent.id || o.type !== agent.type || o.state === 'done') return false
              const oMoving = (o.element.velocity || 0) > 0.5
              if (!oMoving && o.state !== 'waiting_before' && o.state !== 'waiting_after') return false
              const ox = o.element.x + o.element.width / 2 - cx0
              const oy = o.element.y + o.element.height / 2 - cy0
              const f = ox * ux0 + oy * uy0
              return f > 0 && f < dd0 + 40 && Math.abs(ox * uy0 - oy * ux0) < 60
            })
            if (!held && !bypassNow && !mate0) {
              console.warn('[crossing-cap] crossing дольше', crossLimit, 'с — перенос в конец прохода:', agent.type, agent.id)
              const exitT = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
                ? agent.exitPoint
                : agent.target
              if (Number.isFinite(exitT?.x) && Number.isFinite(exitT?.y)) {
                el.x = exitT.x - el.width / 2
                el.y = exitT.y - el.height / 2
              }
              el.velocity = 0
            }
            // счётчик копится заново: следующий рубеж через crossLimit секунд
            crossTrack.delete(agent.id)
          }
        } else {
          crossTrack.delete(agent.id)
          crossLastPos.delete(agent.id)
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
                  a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id) &&
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
                      a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id) &&
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
                  (a.state === 'crossing' || (a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id))) &&
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
                    (a.state === 'crossing' || (a.state === 'waiting_before' && !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id))) &&
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

      // [БАГ-РЕПОРТ-7-ПРОХОД] активен ли режим «прав прохода» (и остаток)
      const bpLeft = bypassByAgentId.get(agent.id) ?? 0
      const bypassActive = bpLeft > 0
      if (bypassActive) {
        const left = bpLeft - dt
        if (left > 0) bypassByAgentId.set(agent.id, left)
        else bypassByAgentId.delete(agent.id)
      }

      let distanceToLeader = Infinity
      let leaderSpeed = Infinity
      // [БАГ-РЕПОРТ-6] лидер отъезжает от нас ВДОЛЬ нашего курса (уступает
      // задним ходом, освобождая проход) — тогда догоняем плавно, без «стой-поехаль»
      let leaderRetreatsAlongCourse = false
      const myLen = Math.max(el.width, el.height)
      // [№9-КЛИП] поперечник корпуса ПЕРПЕНДИКУЛЯРНО курсу: машина рисуется
      // в профиль (длина 80 по X, высота 40 по Y) — на горизонтальном курсе
      // поперечник это высота (40), на вертикальном — длина (80). Раньше
      // всегда брали min(w,h): на вертикальном курсе метрика считала корпус
      // вдвое уже — выезжающая начинала проход, когда встречная отъехала на
      // 55px, и её нос на ~20px накрывал задний угол отъезжающей.
      const myWid = agent.type === 'car'
        ? (Math.abs(dirX) >= Math.abs(dirY) ? el.height : el.width)
        : Math.min(el.width, el.height)
      // [БАГ-РЕПОРТ-4-ЛОБОВЫЕ] уступи встречной to_gate-машине: приоритет у той,
      // что КЛИЧЕ к своей цели (при равенстве — меньший id). Уступающая
      // останавливается ЗАРАНЕЕ (по обнаружению в коридоре), поэтому приоритетная
      // доезжает до общей остановки, не встречая препятствия на своём пути.
      let yieldToOncoming = false

      for (const other of sorted) {
        if (other.id === agent.id) continue
        if (other.type !== agent.type) continue
        // [БАГ-РЕПОРТ-4-УСТУПАНИЕ-МАШИН] машины притормаживают перед ЛЮБОЙ
        // машиной в коридоре курса — встречной и стоящей тоже: раньше фильтр
        // по direction пропускал встречные/стоящие, и машины проезжали
        // сквозь друг друга. Люди остаются на старом правиле (свой поток):
        // встречных они обходят шагом в сторону, а не тормозят.
        if (agent.type === 'person' && other.direction !== agent.direction) continue
        // [БАГ-РЕПОРТ-5-ЗОНЫ] торможение/приоритет — только у ворот (вход/
        // выход) и только если ПРЕПЯТСТВИЕ тоже в зоне; в фазе crossing
        // (сам проход) препятствия на курсе учитываются всегда. Вдали от
        // ворот — едем/идём сквозь, «как раньше».
        if (!(yieldActive && (agent.state === 'crossing' || distToGateCenter(other, gate) <= zoneR))) continue
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
        const otherWid = agent.type === 'car'
          ? (Math.abs(dirX) >= Math.abs(dirY) ? other.element.height : other.element.width)
          : Math.min(other.element.width, other.element.height)
        if (lateral > myWid / 2 + otherWid / 2 + 15) continue

        if (agent.type === 'car') {
          const myFacingLeft = dirX < 0
          const oSettings = (other.element.settings || {}) as Record<string, unknown>
          const otherFacingLeft = typeof oSettings._facingLeft === 'boolean'
            ? (oSettings._facingLeft as boolean)
            : other.direction === 'enter'
          // [БАГ-РЕПОРТ-8-СТОП] «встречность» считается ТОЛЬКО на горизонтальном
          // курсе (дорога). На ВЕРТИКАЛЬНОМ курсе (проход через ворота, отъезд
          // вдоль базы) машины не ездят лоб в лоб — очередь направлений
          // исключает встречный проход, — а _facingLeft у вертикально идущей
          // машины хранит СТАРЫЙ горизонтальный курс. Раньше выезжающая,
          // отъехавшая вниз от своей остановки (теперь бампер на линии ворот,
          // 240 -> ~340), считалась «встречной» для проходящей вниз въезжающей:
          // правило «препятствие ЗА моей целью не мешает» отключалось, и
          // въезжающая навсегда замирала в 10px от своей посадки (взаимная
          // вежливость: она hold 'leader', отъехавшая — hold 'car-yield').
          const horizontalCourse = Math.abs(dirX) > Math.abs(dirY)
          const oncoming = horizontalCourse
            ? (myFacingLeft ? !otherFacingLeft : otherFacingLeft)
            : false
          if (oncoming && other.state === 'to_gate') {
            // [БАГ-РЕПОРТ-7] дуэль приоритетов — только между двумя to_gate:
            // машина в moving_away уже уезжает по СВОЕЙ полосе (выезд —
            // выше дороги, уезд — ниже её), встречный to_gate ей не
            // приоритет. Раньше уезжающая уступала стоя, а въезжающая ждала
            // её прохода — взаимное стояние навсегда.
            if (agent.state !== 'to_gate') continue
            // две машины едут к общей остановке с разных сторон: уступает
            // та, что дальше от цели; приоритетная игнорирует встречную
            const otherTarget = other.target
            const otherDist = Number.isFinite(otherTarget?.x) && Number.isFinite(otherTarget?.y)
              ? Math.hypot(
                  otherTarget.x + (otherTarget.width || 0) / 2 - ox,
                  otherTarget.y + (otherTarget.height || 0) / 2 - oy,
                )
              : Infinity
            const iYield = otherDist < dist - 4 ||
              (Math.abs(otherDist - dist) <= 4 && String(agent.id) > String(other.id))
            if (iYield) {
              yieldToOncoming = true
              continue
            }
            continue // у меня приоритет — еду, встречная уступит
          }
          // [ЛОБОВЫЕ] препятствие ЗА моей целью не мешает, но только если оно
          // не едет НАВСТРЕЧУ (стоящее/попутное не войдёт в мой отрезок пути;
          // встречное — войдёт, и проехать сквозь него нельзя)
          if (!oncoming && forward > dist + 4) continue
        }
        const otherLen = Math.max(other.element.width, other.element.height)
        const gap = forward - (myLen / 2 + otherLen / 2)
        // [ФИКС-СКВОЗЬ] gap <= 0 — корпуса уже пересеклись: раньше такой
        // «препятствие» игнорировалось (условие gap > 0), и агент спокойно
        // проходил сквозь стоящего/медленного впереди. Пересечение = дистанция
        // 0: экстренное торможение за уходящим впереди.
        if (gap <= 0) {
          // [БАГ-РЕПОРТ-7-КУЧА] корпуса пересеклись: экстренный стоп — только
          // за ДВИЖУЩИМСЯ или ЛЕГАЛЬНО припаркованным (waiting_*) впереди.
          // Стоящий нелегально (сам застрял в to_gate/crossing) помехой не
          // считается: иначе куча сбившихся в точку агентов взаимно
          // замораживается навсегда (hold «leader» у каждого гасил сторож —
          // телепортов больше нет). Куча расходится ходом + сепарацией.
          const oMoving = (other.element.velocity || 0) > 0.5
          const oLegalPark = other.state === 'waiting_before' || other.state === 'waiting_after'
          if (!oMoving && !oLegalPark) continue
          if (distanceToLeader > 0) {
            distanceToLeader = 0
            leaderSpeed = other.element.velocity || 0
            leaderRetreatsAlongCourse = retreatsAlongCourse(other, dirX, dirY)
          }
        } else if (gap < distanceToLeader) {
          distanceToLeader = gap
          leaderSpeed = other.element.velocity || 0
          leaderRetreatsAlongCourse = retreatsAlongCourse(other, dirX, dirY)
        }
      }

      let targetSpeed = agent.speed
      const safeDistance = Math.max(MIN_BUFFER, (el.velocity || 0) * REACTION_TIME)
      if (distanceToLeader < safeDistance && !bypassActive) {
        holdByAgentId.set(agent.id, 'leader') // [БАГ-РЕПОРТ-7] вежливое следование
        targetSpeed = Math.min(targetSpeed, leaderSpeed * 0.8)
        // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] жёсткий стоп — только за медленным/
        // стоящим лидером. Исключение: лидер ОТЪЕЗЖАЕТ от нас ВДОЛЬ НАШЕГО
        // КУРСА (уступающий отъезжает задним ходом, освобождая нам проход) —
        // плавно едем за ним без дёргания. Лидер, уходящий ВБОК от курса
        // (мы поднимаемся сквозь ворота, он отъезжает по дороге), по-прежнему
        // останавливает нас жёстко — проедем, когда он расчистит коридор.
        const softFollow = leaderRetreatsAlongCourse && leaderSpeed > (el.velocity || 0)
        if (distanceToLeader < safeDistance * 0.5 && !softFollow) targetSpeed = 0
      }
      // [ФИКС-УСТУПИ-ДОРОГУ] вблизи любого пешехода ПО КУРСУ (в том числе
      // встречного — leader-follow их не видит) сбавляем шаг: попарное
      // торможение даёт расхождению время развести людей в стороны без
      // прохода насквозь. Math.min — никогда не УВЕЛИЧИВАЕТ скорость,
      // поэтому очереди leader-follow (targetSpeed = 0) не ломаются.
      let personNearAhead = Infinity
      let standingAhead = false
      if (agent.type === 'person' && (inGateZone || agent.state === 'crossing')) {
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
          // [БАГ-РЕПОРТ-4-ТОЛЧОК] стоящий человек прямо на курсе — ПОЛНАЯ
          // остановка на безопасной дистанции: раньше пол 14 px/с
          // проталкивал входящего прямо в стоящего выходящего (контакт
          // раньше, чем успевало сработать расхождение). Стоящий уступит
          // (проактивное отхождение ждущих) — и путь освободится.
          // ahead > 8: совпавшие/почти совпавшие центры (двойной спавн в
          // одну точку) НЕ замораживаем — их разводит ветка сепарации,
          // иначе взаимный стоп всей очереди позади.
          // [БАГ-РЕПОРТ-5-АНИМАЦИЯ] уступающий ждущий теперь «идёт» боком
          // (velocity > 0), поэтому признак стоящего дополнен состоянием:
          // waiting_before с боковым шагом — всё ещё препятствие на курсе.
          if (ahead > 8 && ahead < 54 && lateral < 26 &&
              ((other.element.velocity || 0) <= 0.5 || other.state === 'waiting_before')) {
            standingAhead = true
          }
        }
        personNearAhead = Math.sqrt(near2)
        if (standingAhead && !bypassActive) {
          targetSpeed = 0
          holdByAgentId.set(agent.id, 'standing') // [БАГ-РЕПОРТ-7] человек на курсе
        } else if (personNearAhead < PERSON_SEP_RADIUS * 1.6) {
          targetSpeed = Math.min(targetSpeed, Math.max(14, personNearAhead * 0.5))
          holdByAgentId.set(agent.id, 'person-near') // [БАГ-РЕПОРТ-7] ползём за пешеходом
        }
      }
      // [ФИКС-РЫВОК] плавное торможение к точке останова: скорость
      // пропорциональна остатку пути (с нижним порогом), а не ступенька
      // «dist<80 -> сразу 30». Подход к цели заканчивается мягко,
      // скорость к моменту прибытия уже сопоставима с шагом кадра.
      // [БАГ-РЕПОРТ-4-ДЁРГАНИЕ] у людей порог снижен 12 -> 8: меньше ползущий
      // шаг — меньше видимый «доводящий толчок» в момент точной посадки.
      // У машин порог поднят 12 -> 20: ползти последние метры на 12 px/с
      // неестественно (4с на 50px) — машина подкатывает живее.
      // [БАГ-РЕПОРТ-8-ДЁРГАНИЕ] посадка теперь без overshoot (reachedByStep),
      // поэтому «ползучий» хвост поднят: человек 8 -> 11 px/с и экспонента
      // 0.55 -> 0.6 (2с шафла на последних 15px выглядели как нерешительное
      // шарканье), машина 20 -> 24 px/с и 0.55 -> 0.7 (выезжающая проползала
      // последние 56px почти 3с). Подход живее, рывков нет: скорость к
      // прибытию монотонно сходится, шаг кадра <= остатка дистанции.
      if (dist < 80) {
        const brakeFloor = agent.type === 'person' ? 11 : 24
        const brakeGain = agent.type === 'person' ? 0.6 : 0.7
        let brakeCap = Math.max(brakeFloor, dist * brakeGain)
        // [№9-РЫВОК] дотягивание перед ТОЧКОЙ ОСТАНОВА: на коротком отрезке
        // скорость плавно спадает от brakeFloor до ходового пола (машина 8,
        // человек 4) — посадка без «клевка» (раньше в кадр прибытия скорость
        // падала brakeFloor -> 0 мгновенно). Транзитные фазы (человек в
        // crossing/moving_away проходит калитку и уходит НЕ останавливаясь)
        // дотягиванию не подлежат — тормозить в дверном проёме нельзя.
        const stopsAtTarget = agent.state === 'to_gate' ||
          (agent.type === 'car' && agent.state === 'crossing')
        if (stopsAtTarget) {
          const taperZone = agent.type === 'person' ? 8 : 12
          const taperFloor = agent.type === 'person' ? 4 : 8
          if (dist < taperZone) {
            const k = Math.max(0, dist) / taperZone
            brakeCap = taperFloor + (brakeFloor - taperFloor) * k
          }
        }
        targetSpeed = Math.min(targetSpeed, brakeCap)
      }
      // [БАГ-РЕПОРТ-4-ЛОБОВЫЕ] уступаю встречной to_gate-машине —
      // останавливаюсь заранее, не доезжая до зоны встречи
      if (yieldToOncoming && !bypassActive) {
        targetSpeed = 0
        holdByAgentId.set(agent.id, 'oncoming') // [БАГ-РЕПОРТ-7] вежливая уступка
      }
      // [БАГ-РЕПОРТ-6-УСТУПАНИЕ-МАШИН] машина на подходе (level 1 — не у
      // остановки, отъезд не нужен) замирает, пока встречная проезжает/уезжает
      // через её коридор; отойдет триггер — поедет дальше сама.
      if (agent.type === 'car' && gate && distToGateCenter(agent, gate) < CAR_GATE_ZONE && !bypassActive) {
        const yieldLevel = carYieldLevel(agent, gate, false)
        if (yieldLevel > 0) {
          // [№9-РЫВОК] уступка на подходе — не ступенька «крейсерская -> 0»:
          // скорость гасится пропорционально остатку до границы створа
          // (CAR_YIELD_NEAR_STOP до своей остановки). Ступень 0 осталась
          // только у самой остановки и для жёстких уровней.
          if (yieldLevel === 1 && agent.state === 'to_gate') {
            const holdDist = Math.max(0, dist - CAR_YIELD_NEAR_STOP)
            targetSpeed = Math.min(targetSpeed, holdDist <= 2 ? 0 : Math.max(14, holdDist * 0.7))
          } else {
            targetSpeed = 0
          }
          holdByAgentId.set(agent.id, 'car-yield') // [БАГ-РЕПОРТ-7] уступаю проезд
        }
      }

      // [БАГ-РЕПОРТ-8-ДЁРГАНИЕ] разгон людей вдвое мягче машинного:
      // раньше человек, притормозивший перед проходом до ~8-11 px/с, при
      // старте crossing (ретаргет на точку выхода) за 0.4с взлетал до
      // крейсерских 40 px/с — видимый рывок «внезапно сорвался». Половина
      // ACCEL даёт естественный набор шага ~0.8с. Торможение не трогаем:
      // резкая остановка перед препятствием — это безопасность, не дёргание.
      const accel = agent.type === 'person' ? ACCEL * 0.5 : ACCEL
      if ((el.velocity || 0) < targetSpeed) {
        el.velocity = Math.min(targetSpeed, (el.velocity || 0) + accel * dt)
      } else {
        el.velocity = Math.max(targetSpeed, (el.velocity || 0) - DECEL * dt * 2)
      }

      // [ФИКС-КАПОТ] машина рисуется в ПРОФИЛЬ (нос вправо) и НЕ вращается
      // по вертикальному курсу: при вертикальном проходе/убыли она стояла
      // «на капоте». Курс запоминаем только по горизонтальной составляющей
      // (дорога вдоль забора): влево — зеркало scaleX(-1), вправо — нос вправо.
      // Вертикальный участок (проход через ворота, убыль вниз/вверх)
      // сохраняет последнюю горизонтальную ориентацию — как в прежней схеме.
      // Люди вращаются плавно по курсу (targetAngle), как раньше.
      if (agent.type === 'car') {
        if (Math.abs(dirX) >= Math.abs(dirY)) {
          const s = el.settings ?? (el.settings = {})
          s._facingLeft = dirX < 0
        }
        el.rotation = 0
      } else {
        const targetAngle = Math.atan2(dirY, dirX)
        let angleDiff = normalizeAngle(targetAngle - (el.rotation || 0) + SPRITE_ORIENTATION_OFFSET)
        el.rotation = (el.rotation || 0) + angleDiff * 0.1
      }

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
      // [БАГ-РЕПОРТ-4-ТОЛЧОК] клапан: если чужой человек ВПЛОТНУЮ (< 42px,
      // например стоит прямо на моей цели), расталкивание работает и в
      // тихой зоне — иначе проходим сквозь стоящего.
      // [БАГ-РЕПОРТ-5-ЗОНЫ] расхождение — только у ворот (вход/выход) и НЕ
      // в тихой зоне финального подхода (to_gate, dist < QUIET): боковые
      // подталкивания на последних метрах были главным источником
      // «дёргания перед остановкой». Уступает СТОЯЩИЙ (проактивный шаг
      // ждущего), идущий к цели двигается по прямой. Клапан «nearestD < 42»
      // снят — именно он возвращал подталкивания в тихую зону.
      // [БАГ-РЕПОРТ-8-ДЁРГАНИЕ] В ПРОХОДЕ (crossing) бокового танца НЕТ:
      // человек идёт сквозь калитку ПО ПРЯМОЙ, как в жизни. Раньше на него
      // действовали дрейф «держись правее» (константный, 22 px/с) и
      // дистанционное радиальное отталкивание от встречного —
      // равнодействующая меняла знак каждые ~0.5с, и человек zigzagsил
      // ±2-4px прямо в дверном проёме (замер: 5 реверсов за 1.5с прохода).
      // Расходятся ДО прохода: ждущий отходит проактивно (ветка
      // waiting_before), подходящий тормозит (personNearAhead) и сам
      // смещается в зоне ворот — но не внутри дверного проёма.
      if (agent.type === 'person' && (el.velocity || 0) > 0.5 && inGateZone &&
          agent.state !== 'crossing' &&
          !(agent.state === 'to_gate' && dist < ARRIVE_QUIET_ZONE)) {
        const ccx = el.x + el.width / 2
        const ccy = el.y + el.height / 2
        {
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