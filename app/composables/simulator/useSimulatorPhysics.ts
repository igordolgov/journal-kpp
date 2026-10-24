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
// [П1] темп шага: накопление «паузы анимации» для CSS-фазы ног
import { walkHoldStep } from '~/utils/simTuning'
// [№20-ВОРОТА-ИДЕАЛ] общая логика зоны ворот: точка ожидания выезда,
// ранний уезд въезжающей налево, выбор стороны уезда, забор калитки
// [№23-ДУГА] построение дуги прохода в створ калитки
// [№24-БЕЗ-ОСТАНОВКИ] GATE_AXIS_WINDOW — коридор оси ворот для проверки
// «у ворот есть другая машина»
// [№26-РУЧКА] wicketHandlePending — пуш полотна ждёт конца анимации ручки
import { buildWicketArcPoints, clampPersonToFence, exitLaneBusy, exitPendingFor, exitWaitCenterY, GATE_AXIS_WINDOW, limitPersonPushY, roadSideBusyForDeparture, wicketHandlePending } from '../../utils/gateFlow'

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
  // [№13-БЕЗОПАСНОСТЬ] сколько секунд машина на посадке ждёт ПОЛНОГО
  // закрытия своих ворот. Предохранитель на случай «ворота не закроются
  // никогда» (остановлены оператором, зависла анимация): по истечении
  // лимита машина уезжает без ожидания (с предупреждением в консоль).
  const gateCloseWaitByAgentId = new Map<string, number>()
  // [№23-ДУГА] очередь точек дуги прохода: человек, смещённый уступанием,
  // идёт к створу плавной дугой (квадратичная Безье, см.
  // gateFlow.buildWicketArcPoints) — без прямого возврата на ось и без
  // острой смены курса на вертикаль. Последняя точка очереди — сквозная
  // exitPoint; очередь опустошается перехватом в блоке прибытия crossing.
  const crossArcByAgentId = new Map<string, { x: number; y: number }[]>()
  // [№23-КОЛЛАПС] прорыв затора у прохода (репорт №23: «люди должны быстрее
  // разбираться с коллапсом»; «уступают встречным, если это не создаёт
  // ситуацию коллапса»). Пока уступание работает — все расходятся правее;
  // когда пара/толпа взаимно замерли (взаимное standingAhead, скорость у
  // всех ~0, дрейф отключён его же условием velocity > 0.5) — счётчик
  // затора копит окна без прогресса, после порога один из участников
  // получает «право прорыва»: на COLLAPSE_BREAK_S секунд он идёт своим
  // курсом БЕЗ уступаний/остановок перед стоящими, остальные уступают ему
  // штатно (он для них движущийся встречный). Затор разрешается за секунды
  // вместо сторожа-телепорта через 10 с.
  const collapseStuckByAgentId = new Map<string, number>()   // накопленные секунды затора
  const collapseBreakByAgentId = new Map<string, number>()   // остаток прорыва, сек
  const collapseAnchorByAgentId = new Map<string, { x: number; y: number; t: number }>()
  // [№24-ПЛАВНЫЙ-ВЫХОД] сглаженный курс пешехода (единица на агента):
  // направление шага подтягивается к свежему «на цель» экспоненциально,
  // ТАU ~0.15с — свободный шаг не меняется, а скачок курса в первый кадр
  // после паузы уступания (стоял -> уступивший отошёл -> курс развернулся
  // на 30-60° за кадр) исчезает: выход из паузы — плавный поворот.
  const headingByAgentId = new Map<string, { x: number; y: number }>()
  const PERSON_TURN_TAU = 0.15   // с: постоянная времени поворота курса
  const COLLAPSE_WINDOW_S = 1.2   // окно оценки прогресса
  // [№24] порог затора 2.0 -> 1.0 с (репорт №24: «право прорыва» через 1с):
  // фактически прорыв выдаётся после первого окна без прогресса (1.2с)
  const COLLAPSE_STUCK_S = 1.0    // затор дольше — выдаём прорыв
  const COLLAPSE_BREAK_S = 2.5    // длительность прорыва
  const COLLAPSE_MIN_MOVE = 5     // px за окно, меньше — «без прогресса»
  const COLLAPSE_RADIUS = 70      // рядом не должно быть другого прорывателя
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
  // [СПЕЦ-M9/D2] зона створа для машин: 80 px (правка заказчика, было 160).
  // Створ считается занятым встречным потоком (очередь направлений) и
  // приоритет выезда работает, когда выезжающая в 80 px от центра ворот.
  const GATE_ZONE_CAR = 80        // px: радиус зоны прохода для машин
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
  // [№20-ПЛАВНОСТЬ] разгон ЛЮДЕЙ: раньше скорость человека применялась
  // МГНОВЕННО (№13 «люди не ускоряются»), а целевую скорость пересчитывает
  // каждый из ~10 правил уступания — переключение правила было видимым
  // скачком скорости. Рамп 110 px/с² (шаг с места ~0.4с) сглаживает пульс;
  // фаза ног ∝ пройденному пути (№12), поэтому темп шага не искажается.
  const PERSON_ACCEL = 110      // px/с²
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
  // радиус меньше расстояния до полосы ожидания выезда, чтобы ожидающая
  // выше дороги машина не считалась «стоящей на моей остановке».
  // [СПЕЦ-Z7] остановка въезда поднята на 6 px (STOP_STANDOFF_ENTER),
  // расстояние до полосы выезда стало 40-6=34 px — радиус 35 нарушил бы
  // инвариант «полоса выезда НЕ считается моей остановкой», пересчитан 35->28.
  const CAR_YIELD_ON_MY_SPOT = 28

  // [ФИКС-УСТУПИ-ДОРОГУ] параметры мягкого расхождения пешеходов: ближе
  // PERSON_SEP_RADIUS движущиеся пешеходы плавно смещаются друг от друга
  // (встречные — каждый в свою сторону), вместо прохода «сквозь» друг друга
  const PERSON_SEP_RADIUS = 40   // px: дистанция начала расхождения
  const PERSON_SEP_SPEED = 34    // px/с: темп бокового смещения
  // [№25-ПРАВЫЙ-ОБХОД] единое правило «каждый правее» вместо дуги + сепарации:
  // вес обхода — непрерывная функция дистанции (ни одного булева переключателя),
  // знак сдвига — только от собственного курса, поэтому траектория без рывков
  const PERSON_BYPASS_RADIUS = 80 // px: радиус раннего правого обхода
  const PERSON_BYPASS_SPEED = 40  // px/с: темп бокового ухода к правой руке
  const PERSON_HARD_SEP = 30      // px: радиус аварийного расталкивания (контакт)
  const PERSON_HARD_SPEED = 60    // px/с: темп аварийного расталкивания
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
  // [П6] машина на посадке (waiting_after) больше НЕ ждёт закрытия ворот:
  // уезд после вежливой паузы 0.8с, шлагбаум закрывается сам после
  // расчистки створа (свип закрытия в конце тика). Прежний предохранитель
  // WAIT_AFTER_MAX (30с ожидания закрытия) стал не нужен — уезд безусловный.
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

  // [СПЕЦ-M9/D2] машина в зоне створа GATE_ZONE_CAR, мерянной ОТ ЛИНИИ
  // ДОРОГИ F (нижняя линия ворот), а не от центра прямоугольника ворот:
  // высота ворот на сцене бывает большой (тестовые — 120px), и замер от
  // центра относил бы СТОЯЩУЮ на своей остановке выезжающую (30px ниже F)
  // к «вне створа» — ломая приоритет выезда и ранний уезд ([№9]).
  // Горизонтальная полоса 100px — как в проверке коридора своего потока:
  // стоящие/проходящие машины всегда на оси ворот.
  const nearCarGateLine = (o: AiAgent, gate: SceneElement | undefined): boolean => {
    if (!gate) return false
    const gcx = gate.x + gate.width / 2
    const gBottom = gate.y + gate.height
    const ocx = o.element.x + o.element.width / 2
    const ocy = o.element.y + o.element.height / 2
    return Math.abs(ocx - gcx) <= 100 && Math.abs(ocy - gBottom) <= GATE_ZONE_CAR
  }

  // [№13-БЕЗОПАСНОСТЬ] корпус машины ПЕРЕКРЫВАЕТ линию шлагбаума? Шлагбаум
  // опускается ПО нижней линии ворот (F), поэтому задеть он может только
  // корпус, физически пересекающий линию. Ждущие на стоп-линиях (бампер в
  // 6/10 px до линии, [СПЕЦ-Z5/Z7/Z8]) и посадка за линией перекрытия не
  // создают — закрывать за ними безопасно. Именно это позволяет машине
  // ждать закрытия на посадке, а шлагбауму — опускаться перед очередью.
  const carBodyOnGateLine = (o: AiAgent, gateEl: SceneElement | undefined): boolean => {
    if (!gateEl) return false
    const gcx = gateEl.x + gateEl.width / 2
    const ocx = o.element.x + o.element.width / 2
    if (Math.abs(ocx - gcx) > 100) return false
    const lineY = gateEl.y + gateEl.height
    return o.element.y < lineY - 4 && o.element.y + o.element.height > lineY + 4
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
            nearCarGateLine(o, gate)) {
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

  // [№12-РАЗЪЕЗД] стоит ли ВЫЕЗЖАЮЩАЯ машина на коридоре уезда въезжающей.
  // Въезжающая после прохода стоит на посадке НА ОСИ ворот; выезжающая
  // поднимается к своей остановке ПО ТОЙ ЖЕ оси — вниз перед ней не
  // проехать, две машины «лоб в лоб» внутри территории не разъедутся.
  // Критерий геометрический: та же ось (±70 px — конвенция оси ворот,
  // как в carYieldLevel) и корпус выезжающей НИЖЕ нашего центра.
  const exitCarBlocksCorridor = (me: AiAgent): boolean => {
    const mel = me.element
    const mcx = mel.x + mel.width / 2
    const mcy = mel.y + mel.height / 2
    for (const o of aiAgents.value) {
      if (o.id === me.id || o.type !== 'car' || o.direction !== 'exit' || o.state === 'done') continue
      const ocx = o.element.x + o.element.width / 2
      const ocy = o.element.y + o.element.height / 2
      if (Math.abs(ocx - mcx) >= 70) continue
      if (ocy > mcy + 10) return true
    }
    return false
  }

  // [№24-БЕЗ-ОСТАНОВКИ] окно сторон ворот по вертикали: чужой корпус/цель
  // в ±140 px от центра ворот считается «у ворот» (та же конвенция, что в
  // oppositeOccupies) — накрывает и сторону въезжающей очереди, и сторону
  // выезжающей линии ожидания.
  const GATE_SIDE_WINDOW = 140

  // [№24-БЕЗ-ОСТАНОВКИ] есть ли у ворот ДРУГАЯ машина, занимающая или
  // ждущая створ (подходит to_gate, стоит в очереди waiting_before,
  // проходит crossing) — корпус ИЛИ цель в коридоре оси, с ЛЮБОЙ из двух
  // сторон ворот (репорт №24: прошедшая створ машина при машинах по
  // сторонам ворот не должна останавливаться вовсе). Сверстки на посадке
  // (waiting_after) не считаются: двое прошедших не «разрешают» друг
  // другу уезд — иначе створ остаётся открытым над пустотой ([№13]).
  const gateHasOtherCarWaiting = (agents: AiAgent[], me: AiAgent, gate: SceneElement): boolean => {
    const gcx = gate.x + gate.width / 2
    const gcy = gate.y + gate.height / 2
    for (const o of agents) {
      if (o.id === me.id || o.type !== 'car' || o.state === 'done') continue
      if (o.state !== 'to_gate' && o.state !== 'waiting_before' && o.state !== 'crossing') continue
      const ocx = o.element.x + o.element.width / 2
      const ocy = o.element.y + o.element.height / 2
      if (Math.abs(ocx - gcx) <= GATE_AXIS_WINDOW && Math.abs(ocy - gcy) <= GATE_SIDE_WINDOW) return true
      const t = o.target
      if (t && Number.isFinite(t.x) && Number.isFinite(t.y) &&
          Math.abs((t.x ?? 0) - gcx) <= GATE_AXIS_WINDOW &&
          Math.abs((t.y ?? 0) - gcy) <= GATE_SIDE_WINDOW) return true
    }
    return false
  }

  // [№24-БЕЗ-ОСТАНОВКИ] немедленный уезд с посадки по канонической схеме
  // ([№12]/[№20-УЕЗД]): въезжающая — вниз, при занятом коридоре уезда —
  // налево; выезжающая — вбок по фактической полосе в сторону без
  // встречных. Возвращает false, если уезда сейчас быть не может:
  // выезжающей перекрыты ОБЕ стороны дороги — корректор + ожидание
  // закрытия ([№23], «уезд под встречный поток» запрещён). Скорость не
  // обнуляется — остановки нет вовсе; таймеры посадки чистятся.
  const tryNoStopDeparture = (agent: AiAgent, el: SceneElement, gate: SceneElement): boolean => {
    if (agent.type !== 'car') return false
    if (agent.direction === 'exit') {
      const curCy = el.y + el.height / 2
      const origSide: 'left' | 'right' = agent.afterTarget.x < el.x ? 'left' : 'right'
      const otherSide: 'left' | 'right' = origSide === 'left' ? 'right' : 'left'
      const busyOrig = roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, origSide)
      const busyOther = roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, otherSide)
      if (busyOrig && busyOther) return false
      const side = busyOrig ? otherSide : origSide
      const depX = side === 'left' ? -60 - el.width / 2 : sceneSize.value.width + 60 + el.width / 2
      agent.afterTarget = { x: depX, y: curCy, width: 0, height: 0 }
    } else if (agent.direction === 'enter' && exitCarBlocksCorridor(agent)) {
      console.warn('[car-no-stop] коридор уезда вниз занят выезжающей — уезд налево:', agent.id)
      agent.afterTarget = { x: -60 - el.width / 2, y: el.y + el.height / 2, width: 0, height: 0 }
    }
    agent.state = 'moving_away'
    agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
    waitAfterByAgentId.delete(agent.id)
    gateCloseWaitByAgentId.delete(agent.id)
    console.warn('[car-no-stop] другие машины у ворот — уезд без остановки:', agent.id)
    return true
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
    // [ФИКС-калитка] пол 1с: мгновенное закрытие било по ещё идущим к
    // проходу — люди приходили к уже закрытой калитке. [№21] заказчик
    // попросил сократить: было 2с, стало 1с после прохода человека.
    const wicketCloseDelay = Math.max(1, Number(simOpts.wicketCloseDelay ?? 0) || 0)
    // [№21-ТОРМОЖЕНИЕ] тумблер эксперимента заказчика («может попробуем
    // отключить торможение… в конце движения к точке ожидания»): false —
    // подход к точке останова без прогрессивного торможения (скорость
    // постоянная, посадка по reachedByStep). По умолчанию включено.
    const arrivalBrake = simOpts.arrivalBrake !== false
    // [№20-КАЛИТКА-ЗАБОР] калитка ЛЮДЕЙ для ограничителя толчков и клэмпа:
    // ищется один раз на тик (см. также блок клэмпа в конце тика)
    const personGate = simElements.value.find(g => String(g.id) === cfg.personGateId)

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
        gateCloseWaitByAgentId.delete(agent.id) // [№13] без утечек ожидания закрытия
        postGateTrack.delete(agent.id) // [ФИКС-висяки-3] без утечек
        crossTrack.delete(agent.id) // [ФИКС-застыл-калитка] без утечек
        crossArcByAgentId.delete(agent.id) // [№23-ДУГА] без утечек
        headingByAgentId.delete(agent.id) // [№24-ПЛАВНЫЙ-ВЫХОД] без утечек
        collapseStuckByAgentId.delete(agent.id) // [№23-КОЛЛАПС] без утечек
        collapseBreakByAgentId.delete(agent.id)
        collapseAnchorByAgentId.delete(agent.id)
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
      let crossTarget = (agent.exitPoint && Number.isFinite(agent.exitPoint.x) && Number.isFinite(agent.exitPoint.y))
        ? agent.exitPoint
        : (agent.afterTarget ?? { x: agent.element.x, y: agent.element.y })
      // [№20-БЕЗ-ВОЗВРАТА] выезжающая машина при СВОБОДНОЙ полосе заканчивает
      // проход сразу на линии ожидания въезжающих (exitWaitCenterY): прежняя
      // цель «глубокая посадка» (CAR_EXIT_PULL_PAST) заставляла машину
      // проехать вверх и вернуться назад к точке ожидания закрытия —
      // «сначала проезжает вверх, затем возвращается» (репорт №20). Полоса
      // занята (встречная стоит/подъезжает к воротам) — цель прежняя:
      // посадка вверху, чтобы освободить линию въезжающим.
      if (agent.type === 'car' && agent.direction === 'exit') {
        const exitGate = simElements.value.find(g => String(g.id) === cfg.carGateId)
        if (exitGate && !exitLaneBusy(aiAgents.value, agent, exitGate)) {
          crossTarget = { x: crossTarget.x, y: exitWaitCenterY(exitGate, agent.element.height) }
        }
      }
      // [№23-ДУГА] человек после уступания смещён вбок от оси проёма: проход
      // идёт ПЛАВНОЙ ДУГОЙ к створу (репорт №23: «можно продолжить движение
      // к цели плавно по дуге», без прямого возврата на своё место). Дуга
      // выводит на ось за 6px до линии забора, дальше — строго вертикальный
      // проход в проём (створ чист при любом смещении). Сквозная цель
      // сохранена в exitPoint — она замыкает очередь точек.
      if (agent.type === 'person' &&
          Number.isFinite(agent.exitPoint?.x) && Number.isFinite(agent.exitPoint?.y)) {
        const pg = simElements.value.find(g => String(g.id) === cfg.personGateId)
        const axisX = pg ? pg.x + pg.width / 2 : agent.exitPoint!.x
        const offX = (agent.element.x + agent.element.width / 2) - axisX
        if (Math.abs(offX) > 2) {
          const fenceY = pg ? pg.y + pg.height : agent.exitPoint!.y
          const arc = buildWicketArcPoints(
            agent.element.x + agent.element.width / 2,
            agent.element.y + agent.element.height / 2,
            axisX,
            agent.exitPoint!.y,
            fenceY,
            agent.element.height / 2,
          )
          const first = arc[0]
          if (first) {
            crossArcByAgentId.set(agent.id, [...arc, { x: agent.exitPoint!.x, y: agent.exitPoint!.y }])
            crossTarget = { x: first.x, y: first.y }
          }
        }
      }
      agent.target = { ...crossTarget, width: 0, height: 0 }
      const gateId = agent.type === 'car' ? cfg.carGateId : cfg.personGateId
      const gate = simElements.value.find(g => String(g.id) === gateId)
      try {
        payrollHooks?.onAgentCrossing?.(agent, waitMs, gate)
      } catch (e) {
        console.error('[physics] onAgentCrossing упал:', e)
      }
    }

    // [№13-БЕЗОПАСНОСТЬ] легальная очередь у ворот: ВСЕ ждущие waiting_before.
    // Директивно заблокированные (dirBlock) и уступающие-отъезжающие
    // (carBackoff) тоже считаются: они стоят У ворот и хотят проехать,
    // поэтому открытые ворота оправданы их присутствием (инвариант
    // «открыто ⟹ рядом машина»). Благодаря этому машина на посадке уезжает,
    // не дожидаясь закрытия, пока у линии кто-то ждёт, — а «последняя
    // машина цикла» (очереди больше нет) дожидается закрытия сама.
    // [№13-ДЕДЛОК] без учёта carBackoff пара «посадка въезда над путём
    // возврата выезжающей» взаимно блокировалась: выезжающая отъехала и
    // ждёт расчистки коридора, въезжающая на посадке ждёт закрытия, ворота
    // «никто не держит» — счёт не идёт. С учётом carBackoff посадка видит
    // легальную очередь и уезжает (налево, [№12]), коридор освобождается.
    const gateHasQueue = (gateEl: SceneElement | undefined): boolean => {
      if (!gateEl) return false
      const gid = String(gateEl.id)
      return aiAgents.value.some(a =>
        a.state === 'waiting_before' &&
        ((a.type === 'person' && gid === cfg.personGateId) ||
         (a.type === 'car' && gid === cfg.carGateId)))
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
          if (!nearCarGateLine(o, gate)) continue
          return true
        }
      }
      for (const o of aiAgents.value) {
        if (o.id === agent.id || o.type !== agent.type || o.direction !== opp || o.state === 'done') continue
        // проход или стоянка сразу за проходом — занимают всегда
        if (o.state === 'crossing' || o.state === 'waiting_after') return true
        const ocx = o.element.x + o.element.width / 2
        const ocy = o.element.y + o.element.height / 2
        // [СПЕЦ-M9/D2] для машин зона створа меряется ОТ ЛИНИИ ДОРОГИ F
        // (nearCarGateLine) — высокая геометрия ворот не должна выводить
        // стоящую на своей остановке машину из зоны; у людей — от центра.
        const inCorridor = agent.type === 'car'
          ? nearCarGateLine(o, gate)
          : Math.hypot(ocx - gcx, ocy - gcy) < zoneR
        if (!inCorridor) continue
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
          // [№26-ПЛАВНЫЙ-ОТЪЕЗД] задний ход трогается рампой (раньше — мгновенные
          // 55 px/с с места: видимый рывок у точки останова)
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
            // [№26-ПЛАВНЫЙ-ОТЪЕЗД] скорость отъезда — рампой от текущей
            el.velocity = Math.min(isExit ? CAR_YIELD_SPEED * (oppCrossing ? 1.4 : 1) : CAR_YIELD_SPEED,
              (el.velocity || 0) + CAR_YIELD_SPEED * 2.2 * dt)
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
              // [№20-3б] шаг уступания не выносит корпус на линию забора
              const nextY = el.y + (gy / gm) * push
              el.y = personGate ? limitPersonPushY(el, personGate, nextY) : nextY
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
        // [№21-КАЛИТКА-В-ЖИЗНИ] приоткрытая (разблокированная охранником)
        // калитка: подошедший человек ТОЛКАЕТ её до полного открытия —
        // полностью открывают люди, а не кнопка (репорт №21). Звук скрипа
        // играет внутри openGateFn; дальше штатный gateOpenIdle запускает
        // проход, когда анимация открытия завершится.
        // [№26-РУЧКА] последовательность «сначала ручка, потом калитка»:
        // пока ручка доигрывает поворот (WICKET_HANDLE_S после unlockWicket),
        // пуш полотна отложен — человек ждёт у створa.
        if (agent.type === 'person' && gate.settings.isAjar &&
            !gate.settings.isOpen && !gate.settings.isAnimating &&
            !wicketHandlePending(gate.settings, Date.now())) {
          openGateFn(gate)
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
        // [№24-БЕЗ-ОСТАНОВКИ] перепроверка КАЖДОГО тика: чужие машины у
        // любой из сторон ворот (подошла очередь, встал встречный) —
        // посадка не нужна вовсе, уезд немедленно без остатка вежливой
        // паузы и без ожидания закрытия (репорт №24). Одиночная машина при
        // пустых воротах ждёт по [№23] — ветка ниже не менялась.
        if (agent.type === 'car' && gate && gate.settings &&
            gateHasOtherCarWaiting(aiAgents.value, agent, gate) &&
            tryNoStopDeparture(agent, el, gate)) {
          continue
        }
        el.velocity = 0
        const waitedAfter = (waitAfterByAgentId.get(agent.id) ?? 0) + dt
        waitAfterByAgentId.set(agent.id, waitedAfter)
        // [П6→№13-БЕЗОПАСНОСТЬ] на посадке — вежливая пауза 0.8 с (завершение
        // события проезда), затем ОСНОВНОЕ ПРАВИЛО КПП: ворота никогда не
        // остаются открытыми (частично или полностью) без машин рядом.
        // Машина уезжает с посадки только когда:
        //  • её шлагбаум ПОЛНОСТЬЮ закрыт (опустился за её спиной), либо
        //  • у ворот стоит легальная очередь (waiting_before): открытые
        //    ворота оправданы её присутствием, «последняя машина цикла»
        //    дождётся закрытия сама, либо
        //  • ворота исчезли со сцены, либо
        //  • истёк предохранитель: ворота не закрываются (остановлены
        //    оператором, зависла анимация) — уезд с предупреждением.
        // Прежний уезд «через 0.8 с безусловно» оставлял шлагбаум открытым
        // над пустым створом, пока шла отсрочка закрытия, — нарушение
        // инварианта «открыто ⟹ рядом машина» (баг-репорт №13).
        // [БАГ-РЕПОРТ-5-РАЗЪЕЗД] уезд по КАНОНИЧЕСКОЙ схеме: въехавшая —
        // ВНИЗ за нижний край, выехавшая — ВБОК по СВОЕЙ полосе.
        // [№12-РАЗЪЕЗД] исключение: на оси уезда ниже стоит/поднимается
        // выезжающая — вниз не проехать, уезд НАЛЕВО за левый край
        // (afterTarget переписывается — сторож/предохранители не вернут
        // машину вниз).
        if (waitedAfter > 0.8) {
          const gateGone = !gate || !gate.settings
          const fullyClosed = !!gate && !gate.settings.isOpen && !gate.settings.isAnimating
          const queueHoldsGate = gateHasQueue(gate)
          // [№20-ПРОБКА] въехавшая машина освобождает ось ворот СРАЗУ, как
          // только выезжающая хочет выезд (стоит/подъезжает к створу или
          // уже проходит): уезд НАЛЕВО по базе без ожидания закрытия ворот.
          // Раньше пара «посадка въезда над подъезжающим выездом» ждала
          // закрытия (до closeWaitCap) — пробка, которую описал заказчик
          // («может сразу уехать налево... чтобы не создавать пробку»).
          // Инвариант [№13] не страдает: с оси уходит корпус, свип закрытия
          // досчитывает и закрывает ворота сам.
          if (agent.type === 'car' && agent.direction === 'enter' && gate &&
              exitPendingFor(aiAgents.value, agent, gate)) {
            console.warn('[car-left-departure] выезжающая хочет выезд — ранний уезд налево:', agent.id)
            agent.afterTarget = { x: -60 - el.width / 2, y: el.y + el.height / 2, width: 0, height: 0 }
            agent.state = 'moving_away'
            agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
            waitAfterByAgentId.delete(agent.id)
            continue
          }
          // [№23-ВЫЕЗД-ЗАКРЫТИЕ] выезжающая машина ОБЯЗАНА дождаться полного
          // закрытия ворот (репорт №23: «машины обязательно должны ждать
          // закрытия ворот после въезда/выезда, если у ворот нет другой
          // машины»). Ранний уезд сразу после вежливой паузы — только когда
          // У ВОРОТ есть другая машина (стоит или подъезжает: корпус ИЛИ
          // цель в коридоре оси — exitLaneBusy): она задерживается у створа,
          // и ранний уезд оправдан (репорты №20-4/№21-7 «не создавать пробку»).
          // Уезд — в свободную от встречных сторону дороги. Если у ворот
          // кто-то стоит, но обе стороны дороги заняты встречными — ранний
          // уезд откладывается: корректор ниже поднимает машину на глубокую
          // посадку, уезд после закрытия. Инвариант [№13] держит свип [G2].
          if (agent.type === 'car' && agent.direction === 'exit' && gate &&
              exitLaneBusy(aiAgents.value, agent, gate)) {
            const curCy0 = el.y + el.height / 2
            const origSide0: 'left' | 'right' = agent.afterTarget.x < el.x ? 'left' : 'right'
            const otherSide0: 'left' | 'right' = origSide0 === 'left' ? 'right' : 'left'
            const busyOrig0 = roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, origSide0)
            const busyOther0 = roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, otherSide0)
            if (!busyOrig0 || !busyOther0) {
              const side0 = busyOrig0 ? otherSide0 : origSide0
              const depX0 = side0 === 'left' ? -60 - el.width / 2 : sceneSize.value.width + 60 + el.width / 2
              agent.afterTarget = { x: depX0, y: curCy0, width: 0, height: 0 }
              agent.state = 'moving_away'
              agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
              waitAfterByAgentId.delete(agent.id)
              gateCloseWaitByAgentId.delete(agent.id)
              continue
            }
            // у ворот машина, но обе стороны дороги заняты встречными —
            // прежний сценарий: корректор + ожидание закрытия (блок ниже)
          }
          if (!gateGone && !fullyClosed && !queueHoldsGate) {
            // [№20-КОРРЕКТОР-ТОЧКИ] выезжающая машина ждёт закрытия там, где
            // ей позволила ситуация на момент завершения прохода: свободная
            // полоса — сразу на линии ожидания въезжающих (цель прохода,
            // см. startCrossing [№20-БЕЗ-ВОЗВРАТА]), занятая — вверху на
            // глубокой посадке. Пока ворота не закрылись, точка ожидания
            // ПЕРЕСЧИТЫВАЕТСЯ (репорт №20: «ждать вверху можно только если
            // в это время стоит или подъезжает другая машина»):
            //   • полоса освободилась — плавно спускаемся на линию;
            //   • встречная встала/подъехала — поднимаемся на посадку,
            //     освобождая линию въезжающим.
            // Ход вертикальный по оси ворот в обе стороны; путь проверяется
            // (чужой корпус между мной и точкой — стоим). Встав на точку,
            // переписываем afterTarget.y — уезд после закрытия строго вбок
            // по фактической полосе ([№19-СТОП-ЛИНИЯ], тесты сохранены).
            if (agent.type === 'car' && agent.direction === 'exit' && gate) {
              const lineY = exitWaitCenterY(gate, el.height)
              const spotY = exitLaneBusy(aiAgents.value, agent, gate)
                ? (Number.isFinite(agent.exitPoint?.y) ? agent.exitPoint!.y : lineY)
                : lineY
              const curCy = el.y + el.height / 2
              const remain = spotY - curCy
              if (Math.abs(remain) > 2) {
                const dirY = Math.sign(remain)
                const pathBusy = aiAgents.value.some(o => {
                  if (o.id === agent.id || o.type !== 'car' || o.state === 'done') return false
                  const rxc = (o.element.x + o.element.width / 2) - (el.x + el.width / 2)
                  const ryc = (o.element.y + o.element.height / 2) - curCy
                  const fwd = ryc * dirY
                  return fwd > 10 && fwd < Math.abs(remain) + 30 && Math.abs(rxc) < 50
                })
                if (!pathBusy) {
                  const step = Math.min(CAR_YIELD_SPEED * dt, Math.abs(remain))
                  el.y += dirY * step
                  // [№26-ПЛАВНЫЙ-ОТЪЕЗД] скольжение к точке ожидания — рампой
                  el.velocity = Math.min(CAR_YIELD_SPEED, (el.velocity || 0) + CAR_YIELD_SPEED * 2.2 * dt)
                  continue
                }
                // путь к точке занят — ждём закрытия, где стоим (velocity уже 0)
              } else if (Number.isFinite(agent.afterTarget?.y) &&
                         Math.abs(agent.afterTarget.y - curCy) > 1) {
                agent.afterTarget = { ...agent.afterTarget, y: curCy, width: 0, height: 0 }
              }
            }
            // [№13] предохранитель настраивается (gateCloseWaitMax) — в
            // тестах с «вечно открытыми» воротами укорачивается; по умолчанию
            // покрывает максимальный gateCloseDelay + анимацию закрытия
            const closeWaitCap = simOpts.gateCloseWaitMax ?? Math.max(45, closeDelay + 20)
            const waitedClose = (gateCloseWaitByAgentId.get(agent.id) ?? 0) + dt
            if (waitedClose < closeWaitCap) {
              gateCloseWaitByAgentId.set(agent.id, waitedClose)
              // [БАГ-РЕПОРТ-7] штатное ожидание закрытия — сторожу не вмешиваться
              holdByAgentId.set(agent.id, 'gate-close')
              continue
            }
            console.warn('[gate-close-wait] ворота не закрылись за', closeWaitCap, 'с — уезд без ожидания:', agent.id)
          }
          gateCloseWaitByAgentId.delete(agent.id)
          if (agent.direction === 'enter' && exitCarBlocksCorridor(agent)) {
            console.warn('[car-left-departure] коридор уезда занят выезжающей — уезд налево:', agent.id)
            agent.afterTarget = { x: -60 - el.width / 2, y: el.y + el.height / 2, width: 0, height: 0 }
          }
          // [№20-УЕЗД] выезжающая уезжает вбок по ФАКТИЧЕСКОЙ полосе и в
          // сторону, где на дороге нет встречных въезжающих (реальная
          // машина не выезжает под поток; после [№20-БЕЗ-ВОЗВРАТА] точка
          // ожидания может совпадать с полосой дороги). Въезжающим уезд не
          // трогаем: у них канонический ход вниз/налево по [№12].
          if (agent.type === 'car' && agent.direction === 'exit') {
            const curCy = el.y + el.height / 2
            const origSide: 'left' | 'right' = agent.afterTarget.x < el.x ? 'left' : 'right'
            let depX = agent.afterTarget.x
            if (gate) {
              const other: 'left' | 'right' = origSide === 'left' ? 'right' : 'left'
              const busyOrig = roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, origSide)
              const side = busyOrig && !roadSideBusyForDeparture(aiAgents.value, agent, gate, sceneSize.value.width, other)
                ? other
                : origSide
              depX = side === 'left' ? -60 - el.width / 2 : sceneSize.value.width + 60 + el.width / 2
            }
            agent.afterTarget = { x: depX, y: curCy, width: 0, height: 0 }
          }
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

      // [№12-РАЗЪЕЗД] уже уезжаем ВНИЗ по оси, а выезжающая встала на ней
      // ниже (появилась уже после старта уезда) — вниз не проехать:
      // переключаемся на уезд налево. Канонический уезд вниз распознаём
      // по afterTarget ниже текущего центра (после переключения налево
      // afterTarget.y равен текущему центру — повтор не срабатывает).
      if (
        agent.type === 'car' && agent.direction === 'enter' && agent.state === 'moving_away' &&
        Number.isFinite(agent.afterTarget?.y) &&
        agent.afterTarget.y > el.y + el.height / 2 + 20 &&
        exitCarBlocksCorridor(agent)
      ) {
        console.warn('[car-left-departure] выезжающая на коридоре уезда — уезд налево:', agent.id)
        agent.afterTarget = { x: -60 - el.width / 2, y: el.y + el.height / 2, width: 0, height: 0 }
        agent.target = { x: agent.afterTarget.x, y: agent.afterTarget.y, width: 0, height: 0 }
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
          // [№23-ДУГА] прибытие в точку дуги: цель = следующая точка очереди
          // (движение не прерывается, скорость сохраняется). Последняя точка
          // очереди — сквозная exitPoint: при её достижении очередь пустеет
          // и штатный блок завершения прохода выполняется как обычно.
          const arc = crossArcByAgentId.get(agent.id)
          if (arc && arc.length) {
            arc.shift()
            const next = arc[0]
            if (next) {
              agent.target = { x: next.x, y: next.y, width: 0, height: 0 }
              continue
            }
            crossArcByAgentId.delete(agent.id)
          }
          // [ФИКС-РЫВОК-ПОСЛЕ-КАЛИТКИ] скорость на стыке crossing ->
          // moving_away НЕ обнуляется: обнуление на 1-2 кадра ставило анимацию
          // ходьбы на паузу (гистерезис is-paused) посреди шага — видимый
          // «дёрганчик» в точке останова после калитки. Пешеход продолжает
          // шаг с текущей скоростью; машину останавливает ветка waiting_after.
          // [СХЕМА-ТРАЕКТОРИЙ] после прохода агент оказывается на ПРОТИВОПОЛОЖНОЙ
          // стороне забора: входящий — у базы (перед забором, 400),
          // выходящий — в городе (за забором, 150)
          // [№26-Z] машины ВСЕГДА рисуются НИЖЕ людей (репорт №26): люди
          // сохраняют слои 400/150, машины сдвинуты на полосу ниже —
          // 390 (внутри базы, всё ещё выше ворот 300) и 120 (на дороге,
          // ниже входящих людей 130-idx).
          const targetZ = agent.type === 'car'
            ? (agent.direction === 'enter' ? 390 : 120)
            : (agent.direction === 'enter' ? 400 : 150)
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
                // [№22-ТОЛПА] очередь калитки — это и ВСТРЕЧНЫЕ ждущие
                // (dirBlock): они стоят у прохода легально (очерёдность
                // направлений) и пройдут следом по той же открытой калитке.
                // Раньше калитка закрывалась перед их носом (dirBlock-люди
                // не считались ждущими), и толпа по обе стороны стопорилась
                // до повторной разблокировки охранником. У машин прежняя
                // семантика: dirBlock/carBackoff — манёвр уступания [G2].
                const hasOtherWaiting = aiAgents.value.some(a =>
                  a.state === 'waiting_before' &&
                  ((a.type === 'person' && String(gate.id) === cfg.personGateId) ||
                   (a.type === 'car' && String(gate.id) === cfg.carGateId &&
                    !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id)))
                )
                if (!hasOtherWaiting) closeGateFn(gate)
              }
              else {
                if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
                const timer = setTimeout(() => {
                  const currentGate = simElements.value.find(g => String(g.id) === gateId)
                  if (currentGate && currentGate.settings?.isOpen && !currentGate.settings?.isAnimating && !currentGate.settings?.isStopping) {
                    // [№22-ТОЛПА] как в мгновенной ветке: очередь калитки
                    // включает встречных ждущих (dirBlock) — см. [G3]
                    // gateHasQueue, с которой эта проверка теперь согласована.
                    const hasOtherWaiting = aiAgents.value.some(a =>
                      a.state === 'waiting_before' &&
                      ((a.type === 'person' && String(currentGate.id) === cfg.personGateId) ||
                       (a.type === 'car' && String(currentGate.id) === cfg.carGateId &&
                        !dirBlockByAgentId.has(a.id) && !carBackoffByAgentId.has(a.id)))
                    )
                    if (!hasOtherWaiting) closeGateFn(currentGate)
                  }
                  gateCloseTimers.delete(gateId)
                }, closeDelay * 1000)
                gateCloseTimers.set(gateId, timer)
              }
            }
          } else {
            // [№24-БЕЗ-ОСТАНОВКИ] прошедшая створ машина при чужих машинах
            // у ЛЮБОЙ из сторон ворот уезжает СРАЗУ, с текущей скоростью:
            // ни вежливой паузы, ни ожидания полного закрытия. Очередь у
            // створа сама оправдывает открытые ворота ([№13]), свип [G2]
            // закроет створ, когда корпус уйдёт из зоны (репорт №24).
            if (gate && gate.settings && gateHasOtherCarWaiting(aiAgents.value, agent, gate) &&
                tryNoStopDeparture(agent, el, gate)) {
              continue
            }
            // [П6] машина встала на посадку после ворот. Таймер закрытия
            // здесь больше не ставится: отсчёт [G2] запускает свип закрытия
            // в конце тика, когда корпус ПОЛНОСТЬЮ покинул зону створа.
            el.velocity = 0
            agent.state = 'waiting_after'
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
      // [№23-КОЛЛАПС] активен ли прорыв затора (и остаток, сек). Прорыватель
      // идёт своим курсом без уступаний — остальные уступают ЕМУ штатно
      // (для них он движущийся встречный, см. [№21-ВСТРЕЧНЫЕ]).
      let collapseLeft = collapseBreakByAgentId.get(agent.id) ?? 0
      if (collapseLeft > 0) {
        collapseLeft -= dt
        if (collapseLeft > 0) collapseBreakByAgentId.set(agent.id, collapseLeft)
        else collapseBreakByAgentId.delete(agent.id)
      }
      const collapseActive = collapseLeft > 0

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
        // [№13-ПОЛОСЫ] для машин — ТОЧНЫЙ осесимметричный тест прямоугольников:
        // корпуса не вращаются (el.rotation = 0), перекрытие возможно только
        // при |Δпоперечник| < суммы полу-поперечников. Прежняя метрика
        // «перпендикуляр к курсу» на чуть наклонённом курсе давала 39.99 < 40
        // (посадка выезда ровно над полосой въезда, зазор [E4] = 0) — касание
        // считалось помехой, въезжающая замерла «стой-иди» за стоящей на
        // посадке машиной. Люди вращаются по курсу — для них прежняя метрика
        // с запасом +15 сохранена.
        const lateral = agent.type === 'car'
          ? (Math.abs(dirX) >= Math.abs(dirY)
              ? Math.abs((other.element.y + other.element.height / 2) - cy)
              : Math.abs((other.element.x + other.element.width / 2) - cx))
          : Math.abs(cross({ x: toX, y: toY }, { x: dirX, y: dirY }))
        const otherWid = agent.type === 'car'
          ? (Math.abs(dirX) >= Math.abs(dirY) ? other.element.height : other.element.width)
          : Math.min(other.element.width, other.element.height)
        if (agent.type === 'car') {
          if (lateral >= myWid / 2 + otherWid / 2) continue
        } else if (lateral > myWid / 2 + otherWid / 2 + 15) continue

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
          // [П6-ФИКС-ВЗАИМНАЯ-ВЕЖЛИВОСТЬ] активно уступающая машина (отъезд
          // по [№9] идёт, carBackoff) — НЕ стена: она расчищает коридор.
          // Раньше отъезжающая, остановленная стражем заднего хода ПОЗАДИ
          // пересекающей (v=0, но backoff>0), считалась «легальной стоянкой»
          // с перекрытием курса — пересекающая замирала навсегда: она ждёт
          // расчистки коридора, уступающая ждёт, пока та освободит ей зад.
          const oMoving = (other.element.velocity || 0) > 0.5
          const oLegalPark = other.state === 'waiting_before' || other.state === 'waiting_after'
          const oHardPark = oLegalPark && !carBackoffByAgentId.has(other.id)
          if (!oMoving && !oHardPark) continue
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
      // [№23-КОЛЛАПС] прорыватель игнорирует и следование за стоящим впереди:
      // в заторе «нос к носу» именно этот кап замораживает пару (gap <= 0),
      // разойдутся сепарацией и уступанием — как у bypass-прав прохода.
      if (distanceToLeader < safeDistance && !bypassActive && !collapseActive) {
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
      // [№13-НЕ-СКВОЗЬ] торможение перед пешеходом действует ПО ВСЕЙ СЦЕНЕ
      // (раньше только в зоне прохода): колонна с разным темпом [П7] и
      // встречные на дороге/в базе не должны проходить друг сквозь друга.
      let personNearAhead = Infinity
      let standingAhead = false
      // [№25-ПРАВЫЙ-ОБХОД] встречный определяется по КУРСУ соседа (углу
      // корпуса), а не по его текущей скорости: флаг не мигает на разгоне и
      // на боковом шаге уступания, поэтому кап скорости для встречной пары
      // отключён стабильно — обход идёт без торможений. Флаг ставится по
      // ЛЮБОМУ соседу в окне курса (раньше — только при смене ближайшего:
      // «липкий» устаревший флаг тормозил/отпускал не тех).
      let oncomingAhead = false
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
          // 40: коридор скана шире порога отхода ждущего (34) — иначе на
          // кромке 30-34px стоп снимался бы раньше, чем ждущий отошёл
          if (lateral > 40) continue
          const oRot = other.element.rotation || 0
          const oVel = other.element.velocity || 0
          if (Math.cos(oRot) * dirX + Math.sin(oRot) * dirY < -0.3) oncomingAhead = true
          const d2 = ahead * ahead + lateral * lateral
          if (d2 < near2) near2 = d2
          // Стоящий НА КУРСЕ — полная остановка на безопасной дистанции
          // (очереди у прохода не втаптывают стоящего). [№25] шагающий в
          // сторону ждущий (проактивное уступание) — не «стенка», но и не
          // разрешение хода: пока он В МОЁМ коридоре (lateral < 34 — его же
          // порог отхода), я жду; отошёл — один раз трогаюсь. Стоп-гонки
          // «встал-пошёл-встал» больше нет и прохода по корпусу тоже.
          if (ahead > 8 && ahead < 54 &&
              ((lateral < 26 && oVel <= 0.5) ||
               (lateral < 34 && other.state === 'waiting_before'))) {
            standingAhead = true
          }
        }
        personNearAhead = Math.sqrt(near2)
        // [№23-КОЛЛАПС] прорыватель не останавливается перед стоящим и не
        // ползёт: в коллапсе именно эти капы замораживают пару, а обход
        // отключён условием velocity > 0.5 — без прорыва затор вечен
        // [№25] ТРАНЗИТ (crossing/moving_away) не останавливается перед
        // ждущим вовсе: ждущие уступают ему штатно (ветка waiting_before),
        // а жёсткий стоп превращался в «танец» — транзитный замирал, ждущий
        // отходил от ЕГО линии курса, которая сама дрейфовала вслед за
        // отходом (оба скользили вбок паровозиком, никто не расходился).
        // Транзит идёт: кап дистанции и правый обход разводят их без стопа.
        if (standingAhead && !bypassActive && !collapseActive &&
            agent.state !== 'crossing' && agent.state !== 'moving_away') {
          targetSpeed = 0
          holdByAgentId.set(agent.id, 'standing') // [БАГ-РЕПОРТ-7] человек на курсе
        } else if (!oncomingAhead && personNearAhead < PERSON_SEP_RADIUS * 1.6 && !collapseActive) {
          // [№25] кап скорости НЕ действует на встречных (флаг по курсу
          // корпуса): встречная пара расходится правым обходом на полном
          // ходу, без торможений. Кап остаётся для попутного/стоящего
          // впереди (следование за темпом лидера).
          targetSpeed = Math.min(targetSpeed, Math.max(14, personNearAhead * 0.5))
          holdByAgentId.set(agent.id, 'person-near') // [БАГ-РЕПОРТ-7] ползём за пешеходом
        }
        // [№23-КОЛЛАПС] учёт затора и выдача прорыва: окно 1.2с, затор = нет
        // прогресса (<5px) при встречном/стоящем на курсе. Прорыв — только
        // при открытых (или отсутствующих) воротах: закрытые ворота с
        // очередью — легальное ожидание, а не коллапс. Второй прорыватель
        // рядом не назначается (радиус 70): один идёт, остальные уступают.
        if ((agent.state === 'to_gate' || agent.state === 'crossing' || agent.state === 'moving_away') &&
            Number.isFinite(agent.target?.x) && Number.isFinite(agent.target?.y)) {
          const anch = collapseAnchorByAgentId.get(agent.id)
          if (!anch) {
            collapseAnchorByAgentId.set(agent.id, { x: cx, y: cy, t: 0 })
          } else {
            anch.t += dt
            if (anch.t >= COLLAPSE_WINDOW_S) {
              const moved = Math.hypot(cx - anch.x, cy - anch.y)
              const blocked = standingAhead || oncomingAhead
              if (blocked && moved < COLLAPSE_MIN_MOVE) {
                const stuck = (collapseStuckByAgentId.get(agent.id) ?? 0) + anch.t
                collapseStuckByAgentId.set(agent.id, stuck)
                const gateOpenOk = !gate || !!gate.settings?.isOpen
                const breakerNear = collapseBreakByAgentId.size > 0 && aiAgents.value.some(o => {
                  if (o.id === agent.id || o.type !== 'person') return false
                  if ((collapseBreakByAgentId.get(o.id) ?? 0) <= 0) return false
                  const odx = (o.element.x + o.element.width / 2) - cx
                  const ody = (o.element.y + o.element.height / 2) - cy
                  return Math.hypot(odx, ody) < COLLAPSE_RADIUS
                })
                if (!collapseActive && stuck >= COLLAPSE_STUCK_S && gateOpenOk && !breakerNear) {
                  collapseBreakByAgentId.set(agent.id, COLLAPSE_BREAK_S)
                  collapseStuckByAgentId.delete(agent.id)
                  console.warn('[collapse-break] прорыв затора у прохода:', agent.id)
                }
              } else {
                collapseStuckByAgentId.delete(agent.id)
              }
              anch.x = cx
              anch.y = cy
              anch.t = 0
            }
          }
        } else {
          collapseAnchorByAgentId.delete(agent.id)
          collapseStuckByAgentId.delete(agent.id)
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
      if (arrivalBrake && dist < 80) {
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
      // [П2] машина трогается мягче: потолок разгона 60 px/с² (в жизни
      // легковушка набирает ход за ~1с). ACCEL из настроек остаётся общим
      // регулятором, но для машин не поднимается выше 60.
      // [№13-НОГИ] люди НЕ УСКОРЯЮТСЯ ВООБЩЕ: скорость сразу равна целевой.
      // Фаза ног ∝ пути (№12), поэтому любой разгон-рампа был виден как
      // «ноги набирают темп» — теперь шаг с места начинается сразу в
      // естественном ритме CSS-анимации. Торможение осталось плавным (DECEL).
      // [№20-ПЛАВНОСТЬ] скорость теперь у ВСЕХ агентов меняется рампом:
      // люди — 110 px/с² (шаг с места ~0.4с; торможение прежнее, DECEL*2 —
      // резкая остановка перед препятствием это безопасность), машины —
      // прежние min(ACCEL, 60). Прежде у людей targetSpeed применялся
      // мгновенно, а пересчитывается он каждым из ~10 правил уступания —
      // переключение правила было видимым скачком скорости. Фаза ног
      // ∝ пройденному пути (№12), поэтому рамп темп шага не искажает.
      const accel = agent.type === 'person' ? PERSON_ACCEL : Math.min(ACCEL, 60)
      if ((el.velocity || 0) < targetSpeed) {
        el.velocity = Math.min(targetSpeed, (el.velocity || 0) + accel * dt)
      } else {
        el.velocity = Math.max(targetSpeed, (el.velocity || 0) - DECEL * dt * 2)
      }

      // [П1][№12][№26-ФИКС-ФАЗА] темп шага = скорости ходьбы: фаза-ЗАДЕРЖКА
      // CSS-анимации ног (_walkHold, секунды) растёт на dt*(1 - v/cruise)
      // (walkHoldStep), пока человек идёт медленнее крейсерской — рендеримая
      // скорость ног = v/cruise (замедлился — ноги реже, НИКОГДА не быстрее
      // естественного темпа; на крейсерской фаза заморожена). Кап 2.5с:
      // положительный delay больше возраста аватара показывал бы позу 0%.
      // На месте анимацию ставит на паузу is-paused.
      if (agent.type === 'person') {
        const v = el.velocity || 0
        if (v > 0.05 && v < agent.speed) {
          const ws = el.settings ?? (el.settings = {})
          ws._walkHold = Math.min((((ws as any)._walkHold as number) || 0) + walkHoldStep(dt, v, agent.speed), 2.5)
        }
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
        // [№24-ПЛАВНЫЙ-ВЫХОД] курс шага сглаживается (только пешеход, только
        // вне прохода и тихой зоны): после паузы уступания направление «на
        // цель» развернуто за кадр — прежний прямой шаг давал видимый рывок
        // вбок. Храним курс ТОЛЬКО на ходу: за время паузы он не течёт, и
        // первый кадр возобновления блендится от дос_pauseового курса.
        // [№26-ПЛАВНАЯ-ТИХАЯ-ЗОНА] бленд курса теперь продолжается И в тихой
        // зоне (исключение убрано): ранее на границе 70px направление шага
        // СКАЧКОМ менялось с бленднутого на прямой — видимый излом хода
        // перед точкой останова. Бленд сам сходится к прямому направлению.
        let stepX = dirX
        let stepY = dirY
        if (agent.type === 'person' && agent.state !== 'crossing') {
          const h0 = headingByAgentId.get(agent.id)
          // разворот через «назад» не блендим — там путь всё равно перепланируется
          if (h0 && (h0.x * dirX + h0.y * dirY) > 0) {
            const kb = 1 - Math.exp(-dt / PERSON_TURN_TAU)
            let bx = h0.x + (dirX - h0.x) * kb
            let by = h0.y + (dirY - h0.y) * kb
            const bm = Math.hypot(bx, by)
            if (bm > 0.001) {
              stepX = bx / bm
              stepY = by / bm
            }
          }
          headingByAgentId.set(agent.id, { x: stepX, y: stepY })
        } else if (agent.type === 'person') {
          headingByAgentId.delete(agent.id)
        }
        const moveStep = Math.min((el.velocity || 0) * dt, dist)
        el.x += stepX * moveStep
        el.y += stepY * moveStep
      }

      // [№25-ПРАВЫЙ-ОБХОД] единое расхождение пешеходов — БЕЗ дуги и БЕЗ
      // торможений. (Старая схема: дуга-дрейф [№24] и радиальная сепарация,
      // спроецированная на перпендикуляр, толкали в ПРОТИВОПОЛОЖНЫЕ стороны —
      // радиальное «от соседа» гасило дрейф «держись правее», пара
      // накладывалась; вес дуги и булевы флаги уступания мигали от кадра к
      // кадру — отсюда дёргание в вертикальных проходах.)
      // Новое правило «каждый правее» — одно и непрерывное:
      //   1) вес обхода — плавная функция дистанции до соседа и его бокового
      //      отклонения от моего курса; знак бокового сдвига — ТОЛЬКО от
      //      моего курса (правая рука, (-dirY, dirX)): сдвиг не может
      //      реверсировать из-за позиции соседа — осциллировать нечему;
      //   2) встречная пара не тормозит: кап скорости для встречных отключён
      //      по курсу соседа (см. скан выше) — расхождение на полном ходу;
      //   3) аварийный клапан от наложения: при дистанции < PERSON_HARD_SEP
      //      радиальное «от соседа», плавное по весу, перекрывает всё.
      // [№26-ПЛАВНАЯ-ТИХАЯ-ЗОНА] в тихой зоне прибытия боковой танец не
      // выключается РЕЗКО на границе 70px (прежний скачок силы = излом хода
      // перед точкой останова), а ПЛАВНО гаснет: вес умножается на
      // arriveFade = dist / ARRIVE_QUIET_ZONE, жёсткое выключение — только
      // у самой посадки (< 12px). Аварийный клапан фейдится вместе с ним —
      // контакт ближе 30px возможен только вне зоны посадки.
      // Стоящих не толкаем: строй группы и очереди у прохода не расползаются.
      // [№13-НЕ-СКВОЗЬ] правило действует ПО ВСЕЙ СЦЕНЕ: люди в базе и на
      // дороге не проходят друг сквозь друга.
      if (agent.type === 'person' && (el.velocity || 0) > 0.5 &&
          agent.state !== 'crossing' &&
          !(agent.state === 'to_gate' && dist < 12)) {
        const ccx = el.x + el.width / 2
        const ccy = el.y + el.height / 2
        let bypassW = 0                  // вес правого обхода 0..1
        let hardAX = 0, hardAY = 0, hardW = 0
        for (const other of aiAgents.value) {
          if (other.id === agent.id || other.type !== 'person' || other.state === 'done') continue
          // своих по группе не раскидываем — колонна/строй сохраняется
          if (agent.groupId && other.groupId === agent.groupId) continue
          const ocx = other.element.x + other.element.width / 2
          const ocy = other.element.y + other.element.height / 2
          const ox = ocx - ccx
          const oy = ocy - ccy
          const d = Math.hypot(ox, oy)
          if (d < 0.01) {
            // центры совпали (спавн в одной точке): детерминированно разводим
            // по разные стороны от курса по порядку id — иначе взаимный стоп
            const s = String(agent.id) < String(other.id) ? 1 : -1
            hardAX += -dirY * s
            hardAY += dirX * s
            hardW = Math.max(hardW, 0.6)
            continue
          }
          // 3) аварийный клапан: физический контакт — радиальное «от соседа»,
          // вес непрерывен по дистанции (работает и на «нерелевантном» соседе)
          if (d < PERSON_HARD_SEP) {
            const hw = (PERSON_HARD_SEP - d) / PERSON_HARD_SEP
            hardAX += -(ox / d) * hw
            hardAY += -(oy / d) * hw
            hardW = Math.max(hardW, hw)
          }
          if (d >= PERSON_BYPASS_RADIUS) continue
          const ahead = ox * dirX + oy * dirY
          const oRot = other.element.rotation || 0
          const oDot = Math.cos(oRot) * dirX + Math.sin(oRot) * dirY
          const oncoming = oDot < -0.3
          // [№25] обходить ЛЮБОГО соседа впереди в радиусе — встречного,
          // медленного, стоящего. Классификация «медленнее ли он меня»
          // запрещена: скорость соседа, ползущего за капом, колеблется
          // (~13-16 px/с), порог стоит ровно на границе — релевантность
          // стробит от кадра к кадру, дрейф мигает = зигзаг (диагностика S5). Вес непрерывен и
          // сам гасит манёвр: сосед ушёл вперёд — distW спадает; я обошёл —
          // courseW гаснет за границей коридора. Попутчик СБОКУ в темп
          // (ahead ≈ 0) и находящийся позади — не помеха, не смещаемся.
          if (ahead < (oncoming ? -6 : 6)) continue
          // вес обхода: полная сила уже с d ≤ 44px (ранний заход, как у
          // прежней дуги с радиусом 88), дальше плавный спад к 80. По КУРСУ
          // вес полон в коридоре (≤ 34 = порог отхода ждущего) и плавно
          // гаснет к 48: равновесие «дрейф ↔ возврат к цели» оказывается
          // ВНУТРИ плавного спада — без предельного цикла на жёсткой границе
          // (резкое выключение на 34 давало раскачку «дрейф-возврат» и
          // микрореверсы боковой составляющей)
          const distW = Math.min(1, (PERSON_BYPASS_RADIUS - d) / (PERSON_BYPASS_RADIUS * 0.45))
          const lateral = Math.abs(ox * dirY - oy * dirX)
          const courseW = Math.max(0, Math.min(1, (48 - lateral) / 14))
          bypassW = Math.max(bypassW, distW * courseW)
        }
        // 1) правый обход: непрерывный боковой уход к правой руке. Вес
        // непрерывен по дистанции, знак фиксирован курсом — реверсов нет.
        // [№26] в тихой зоне вес дополнительно гаснет по остатку пути
        // (arriveFade) — без излома силы на границе зоны.
        // [№23-КОЛЛАПС] прорыватель идёт своим курсом — встречные уступают
        // ему (обход для него выключен, аварийный клапан работает всегда)
        if (bypassW > 0 && !collapseActive) {
          const arriveFade = agent.state === 'to_gate'
            ? Math.max(0, Math.min(1, dist / ARRIVE_QUIET_ZONE))
            : 1
          const lat = PERSON_BYPASS_SPEED * bypassW * arriveFade * dt
          el.x += -dirY * lat
          // [№20-3б] обход не заносит корпус на линию забора
          const nextY = el.y + dirX * lat
          el.y = personGate ? limitPersonPushY(el, personGate, nextY) : nextY
        }
        // 2) аварийный клапан от наложения (контакт ближе PERSON_HARD_SEP)
        if (hardW > 0) {
          const m = Math.hypot(hardAX, hardAY)
          if (m > 0.01) {
            const arriveFade = agent.state === 'to_gate'
              ? Math.max(0, Math.min(1, dist / ARRIVE_QUIET_ZONE))
              : 1
            const push = PERSON_HARD_SPEED * hardW * arriveFade * dt
            el.x += (hardAX / m) * push
            // [№20-3б] клапан не выносит корпус на линию забора
            const nextY = el.y + (hardAY / m) * push
            el.y = personGate ? limitPersonPushY(el, personGate, nextY) : nextY
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

    // [№20-КАЛИТКА-ЗАБОР] люди заходят/выходят только в проём калитки:
    // после всех смещений кадра корпус человека не пересекает линию забора
    // вне проёма (толкания/уступания/дрейф у калитки скользят вдоль линии,
    // а не сквозь забор — «как будто по краям калитки есть забор»). Во
    // время crossing клэмп не применяется: путь прохода вертикален в проёме.
    if (personGate) {
      for (const agent of aiAgents.value) {
        if (agent.type !== 'person' || agent.state === 'crossing' || agent.state === 'done') continue
        // сторона возврата — сторона цели (куда человек направляется),
        // темп ограничен: толчок, а не телепорт (см. gateFlow.clampPersonToFence)
        clampPersonToFence(agent.element, personGate, agent.target?.y, dt)
      }
    }

    // [№13-ЗАКРЫТИЕ-ПО-ЛИНИИ] основное правило безопасности КПП: ворота не
    // остаются открытыми (частично или полностью) без машин рядом. Отсчёт
    // [G2] (gateCloseDelay) стартует, когда НИ ОДИН корпус не ПЕРЕКРЫВАЕТ
    // линию шлагбаума (carBodyOnGateLine): ждущие на стоп-линиях (бампер в
    // 6/10 px до линии) и посадка за линией перекрытия не создают —
    // шлагбаум опускается за спиной уехавшей с посадки машины и ПЕРЕД
    // очередью, как в жизни. Очередь [G3] (gateHasQueue, включая
    // директивно заблокированных) держит ворота открытыми, пока у линии
    // реально кто-то ждёт. Калитка (wicket) живёт по тем же правилам со
    // своим occupied/очередью и wicketCloseDelay.
    for (const gate of simElements.value) {
      if (gate.category !== 'gate' && gate.category !== 'barrier') continue
      const gs: any = gate.settings
      if (!gs) continue
      const gateId = String(gate.id)
      const isWicket = gs.gateType === 'wicket'
      const normalOpen = gs.isOpen && !gs.isAnimating && !gs.isStopping && !gs.isStopped
      if (!normalOpen) {
        // закрыты/анимируются/остановлены — отложенный отсчёт не имеет смысла
        cancelCloseTimer(gateId)
        continue
      }
      // корпус в створе (проход по факту либо корпус на линии шлагбаума) —
      // закрывать нельзя, отсчёт снимается
      const occupied = isWicket
        ? aiAgents.value.some(o => {
            if (o.type !== 'person' || o.state === 'done') return false
            if (o.state === 'crossing') return true
            const gcx = gate.x + gate.width / 2
            const gcy = gate.y + gate.height / 2
            const ocx = o.element.x + o.element.width / 2
            const ocy = o.element.y + o.element.height / 2
            return Math.hypot(ocx - gcx, ocy - gcy) < GATE_ZONE_PERSON
          })
        : aiAgents.value.some(o => {
            if (o.type !== 'car' || o.state === 'done') return false
            if (o.gateId === gateId && o.state === 'crossing') return true
            return carBodyOnGateLine(o, gate)
          })
      if (occupied) {
        cancelCloseTimer(gateId)
        continue
      }
      // отсчёт уже идёт — не перезапускаем
      if (gateCloseTimers.has(gateId)) continue
      // [G3] очередь перед закрытием: ждущий у прохода держит ворота
      if (gateHasQueue(gate)) continue
      const closeDelayHere = isWicket ? wicketCloseDelay : gateCloseDelay
      if (closeDelayHere === 0) {
        closeGateFn(gate)
        continue
      }
      const timer = setTimeout(() => {
        gateCloseTimers.delete(gateId)
        const currentGate = simElements.value.find(g => String(g.id) === gateId)
        if (!currentGate || !currentGate.settings?.isOpen ||
            currentGate.settings?.isAnimating || currentGate.settings?.isStopping ||
            currentGate.settings?.isStopped) return
        // за время отсчёта в створ мог войти корпус (лаг кадра) — не закрывать
        const occupiedNow = isWicket
          ? aiAgents.value.some(o => {
              if (o.type !== 'person' || o.state === 'done') return false
              if (o.state === 'crossing') return true
              const gcx = currentGate.x + currentGate.width / 2
              const gcy = currentGate.y + currentGate.height / 2
              const ocx = o.element.x + o.element.width / 2
              const ocy = o.element.y + o.element.height / 2
              return Math.hypot(ocx - gcx, ocy - gcy) < GATE_ZONE_PERSON
            })
          : aiAgents.value.some(o => {
              if (o.type !== 'car' || o.state === 'done') return false
              if (o.gateId === gateId && o.state === 'crossing') return true
              return carBodyOnGateLine(o, currentGate)
            })
        if (occupiedNow) return
        if (gateHasQueue(currentGate)) return
        closeGateFn(currentGate)
      }, closeDelayHere * 1000)
      gateCloseTimers.set(gateId, timer)
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