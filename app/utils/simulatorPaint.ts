// utils/simulatorPaint.ts
// [№14-ПЛАВНОСТЬ-DEV] Императивный мост «физика -> DOM».
//
// Проблема: физика мутирует el.x/el.y (deep-reactive) каждый кадр, шаблон
// виджета читал эти поля через :style/:class — рендер-эффект подписывался
// на позиции ВСЕХ агентов, и Vue пересобирал весь виджет каждый кадр.
// В production-сборке это впритык укладывалось в бюджет кадра (16.6мс),
// в dev-режиме (Vite/HMR/дев-рантайм Vue, непроизводственные проверки)
// кадры срывались — видимые «дёргания» на медленном ходу (дотягивание
// 8-24 px/с = 0.1-0.4 px за кадр: один пропущенный кадр удваивает шаг).
//
// Решение (классический game-loop): Vue отвечает ТОЛЬКО за структуру
// (спавн/деспавн монтирует узел с актуальным стилем), а покадровые
// изменения записываются напрямую в DOM из gameLoop после физики.
// Ни одно покадровое поле (x, y, velocity, zIndex, settings._walkHold,
// settings._animX/_animScaleX, cmd.actor.x) больше не читается реактивно
// в шаблоне — рендер-эффект не подписывается на них, перерисовок нет.
//
// Функции чистые: работают с RAW-объектами элементов (toRaw — без прокси,
// чтение не отслеживается и не триггерит) и с DOM-узлами, поэтому
// тестируются в node-окружении с фейковыми узлами.

export type RawEl = Record<string, any>

// [№15-ФИКС-ШАГ] Интерполяция рендера: физика идёт фиксированными подшагами
// (1/60с), реальный кадр rAF может длиться 16..50+мс (в dev — неровно).
// gameLoop перед подшагами снимает prev-позиции (_px/_py), после подшагов
// paint берёт prev + (cur - prev) * alpha, где alpha = остаток аккумулятора.
// Результат: движение на экране равномерно, даже если кадры приходят
// неравномерно (первая причина остаточных «дёрганий» после №14).
export const paintCoord = (el: RawEl, axis: 'x' | 'y', alpha: number): number => {
  const cur = el[axis]
  if (!alpha || alpha >= 1) return cur
  const prev = el[axis === 'x' ? '_px' : '_py']
  if (typeof prev !== 'number' || !Number.isFinite(prev)) return cur
  return prev + (cur - prev) * alpha
}

// Пауза анимации конечностей: явный флаг физики или «стоим» по скорости.
// Семантика идентична прежнему биндингу :class в шаблоне.
export const isAgentPaused = (el: RawEl): boolean =>
  el.isPaused ?? ((el.velocity || 0) < 0.1)

// Ракурс машины (№41-РАКУРСЫ): 'side' — профиль по умолчанию; физика ставит
// 'front' (вертикальный курс вверх — едет на зрителя) или 'rear' (вниз —
// от зрителя). Старые ассеты без флага читаются как 'side' — поведение прежнее.
export type CarView = 'side' | 'front' | 'rear'
export const carViewOf = (el: RawEl): CarView => {
  const v = el.settings?._view
  return v === 'front' || v === 'rear' ? v : 'side'
}

// transform агента: семантика идентична getElementStyle в useSimulatorCore
// (translate3d + зеркало машины по _facingLeft/направлению).
// [№31-БЕЗ-ПОВОРОТА] кнопка «Поворот спрайтов» удалена: агенты никогда не
// вращаются по курсу (el.rotation остаётся только внутренней математикой
// расхождения в физике — на отображение она не влияет).
// [№41-РАКУРСЫ] зеркало ТОЛЬКО у бокового профиля: виды спереди/сзади
// симметричны, и отражённый номер/фары выглядели бы ошибкой.
// [№15] alpha — доля физического шага для интерполяции (см. paintCoord);
// по умолчанию 1 (текущая позиция) — прежние вызовы/тесты не меняются.
export const agentTransform = (el: RawEl, alpha = 1): string => {
  const t = `translate3d(${paintCoord(el, 'x', alpha)}px, ${paintCoord(el, 'y', alpha)}px, 0)`
  if (el.category === 'car') {
    if (carViewOf(el) !== 'side') return t
    const facingLeft = el.settings?._facingLeft ?? el.direction === 'enter'
    return `${t} scaleX(${facingLeft ? -1 : 1})`
  }
  return t
}

// Позиция лейбла над агентом (левый-верх 0/0 + translate3d; -50% — центрирование
// по ширине самой плашки). Прежний вариант с left/top пересчитывал layout каждый кадр.
export const labelTransform = (el: RawEl, alpha = 1): string =>
  `translate3d(${paintCoord(el, 'x', alpha) + el.width / 2}px, ${paintCoord(el, 'y', alpha) - 50}px, 0) translateX(-50%)`

// Скольжение стрелы шлагбаума/створки калитки (анимация GSAP пишет
// settings._animX/_animScaleX, paint читает их RAW).
export const gateTransform = (s: RawEl | undefined | null): string =>
  `translateX(${s?._animX || 0}px) scaleX(${s?._animScaleX ?? 1})`

export interface AgentPaintTargets {
  node: HTMLElement | null
  avatar: HTMLElement | null
  // [№41-РАКУРСЫ] три контейнера ракурсов машины (null у людей/старых машин):
  // paint переключает их display по settings._view — без ререндера Vue.
  carViews?: { side: HTMLElement | null; front: HTMLElement | null; rear: HTMLElement | null } | null
}

// [№16-МЕНЬШЕ-ЗАПИСЕЙ] Кэш последних записанных значений на DOM-узел.
// Профилирование (№16): CPU-профиль показывает, что узкое место — НЕ физика
// и НЕ Vue (longtask = 0), а размазанная по кадру стоимость style-recalc /
// инвалидации paint от ПОКАДРОВЫХ записей стилей. Большинство агентов
// большую часть времени стоит (очередь у шлагбаума, ожидание закрытия) —
// их transform/zIndex не меняются, но раньше строка писалась каждый кадр.
// Пишем в DOM только при реальном изменении значения: стоящие агенты
// выпадают из покадровой стоимости полностью, шагающие — почти полностью.
const lastWritten = new WeakMap<object, Record<string, string>>()
const writeCache = (node: object): Record<string, string> => {
  let c: Record<string, string> | undefined = lastWritten.get(node)
  if (!c) {
    c = Object.create(null) as Record<string, string>
    lastWritten.set(node, c)
  }
  return c
}
const writeOnce = (node: object, el: HTMLElement, key: string, value: string): void => {
  const c = writeCache(node)
  if (c[key] === value) return
  c[key] = value
  // custom-свойства (--walk-hold) — только через setProperty (надёжно во всех браузерах)
  if (key.startsWith('--')) el.style.setProperty(key, value)
  else (el.style as any)[key] = value
}

// [№16-ФАЗА-ШАГА][№26] Квантование --walk-hold: значение меняется каждый кадр
// (копится задержка фазы), но запись custom-свойства инвалидирует стиль всего
// поддерева аватара (сложный SVG). Квант 1/20с (50мс) давал видимую «лесенку»
// фазы на тормозном подходе — ступени 50мс на цикле шага ~1с = скачки 5%.
// Квант 1/60с (16.7мс) — ниже порога заметности, записи при торможении
// ≤ 30/с только у ТОРМОЗЯЩИХ агентов (стоящие не пишутся вовсе — кэш).
export const quantizeWalkHold = (v: number | undefined | null): number =>
  Math.round((v ?? 0) * 60) / 60

// Покадровая запись агента: позиция+слой на корневом узле, пауза конечностей
// и фаза шага (--walk-hold) на обёртке аватара (только у людей).
// [№16] каждая запись проходит через кэш: unchanged-значения не пишутся.
export const paintAgent = (t: AgentPaintTargets, el: RawEl, alpha = 1): void => {
  if (t.node) {
    writeOnce(t.node, t.node, 'transform', agentTransform(el, alpha))
    writeOnce(t.node, t.node, 'zIndex', String(el.zIndex || 1))
    // [№16-КОМПОЗИТИНГ] ОТКЛОНЕНО экспериментом (Xvfb CPU×6: j25 408 vs 242 у
    // бейзлайна): собственные слои на ПОЛНОМ экране агентов дороже, чем
    // перерисовка (в софт-растеризаторе и при дробном масштабе). Возвращено
    // к прямому рендеру в слой сцены.
  }
  // [№41-РАКУРСЫ] мгновенная смена вида машины: видим только контейнер
  // активного ракурса (display block/none, записи через кэш writeOnce —
  // стоящая машина не генерирует записей). CSS по умолчанию прячет
  // front/rear, поэтому до первого paint виден боковой профиль.
  if (t.carViews) {
    const view = carViewOf(el)
    const views: Array<['side' | 'front' | 'rear', HTMLElement | null]> = [
      ['side', t.carViews.side],
      ['front', t.carViews.front],
      ['rear', t.carViews.rear],
    ]
    for (const [key, node] of views) {
      if (node) writeOnce(node, node, 'display', view === key ? 'block' : 'none')
    }
  }
  if (t.avatar) {
    const paused = isAgentPaused(el)
    const c = writeCache(t.avatar)
    if (c['paused'] !== String(paused)) {
      c['paused'] = String(paused)
      t.avatar.classList.toggle('is-paused', paused)
    }
    writeOnce(t.avatar, t.avatar, '--walk-hold', String(quantizeWalkHold(el.settings?._walkHold)))
  }
}

// Покадровая запись позиции лейбла.
export const paintLabel = (node: HTMLElement | null, el: RawEl, alpha = 1): void => {
  if (node) writeOnce(node, node, 'transform', labelTransform(el, alpha))
}

// Покадровая запись стрелы ворот (в т.ч. после kill() твина и синхронизаций
// сторожа — paint каждый кадр переносит фактическое состояние settings в DOM).
export const paintGate = (node: HTMLElement | null, s: RawEl | undefined | null): void => {
  if (node) writeOnce(node, node, 'transform', gateTransform(s))
}

// ---------------------------------------------------------------------------
// [№31-ШЕСТЕРНЯ] приводная шестерня откатных ворот: открываются — крутится
// ПРОТИВ часовой, закрываются — ПО часовой. Направление обратимо само собой:
// угол выводится из прогресса сдвига полотна (_animX: 0 закрыто .. -width
// открыто), поэтому закрытие просто отматывает угол назад.
// ---------------------------------------------------------------------------
// Полных оборотов за полный ход полотна (openDuration ~2-8с: 1 оборот выглядит
// вяло, 3+ — мельтешение).
export const GATE_GEAR_TURNS = 2

// Прогресс открытия сдвижных ворот 0..1 по _animX (масштабный режим калитки
// _animScaleX шестерню не получает — она ставится только на ворота/шлагбаум).
export const gateOpenProgress = (s: RawEl | undefined | null, gateWidth: number): number => {
  const w = Number(gateWidth)
  if (!Number.isFinite(w) || w <= 0 || !s) return 0
  const x = typeof s._animX === 'number' && Number.isFinite(s._animX) ? s._animX : 0
  return Math.max(0, Math.min(1, -x / w))
}

// Угол шестерни в градусах: минус = против часовой (CSS-поворот по часовой
// положителен). Открытие: 0 -> -360*GEAR_GEAR_TURNS; закрытие отматывает обратно.
// p=0 -> явный 0 (без -0: «rotate(-0deg)» в style никому не нужен).
export const gateGearRotationDeg = (s: RawEl | undefined | null, gateWidth: number): number => {
  const p = gateOpenProgress(s, gateWidth)
  return p === 0 ? 0 : -p * 360 * GATE_GEAR_TURNS
}

// Покадровая запись угла шестерни (кэш writeOnce: стоячие ворота не пишутся).
export const paintGateGear = (node: HTMLElement | null, s: RawEl | undefined | null, gateWidth: number): void => {
  if (node) writeOnce(node, node, 'transform', `rotate(${gateGearRotationDeg(s, gateWidth)}deg)`)
}

// Покадровая запись линии «команда» (актор -> цель) в SVG.
export const paintCommandLine = (
  line: { setAttribute: (n: string, v: string) => void } | null,
  actor: RawEl | null | undefined,
  target: RawEl | null | undefined,
  alpha = 1,
): void => {
  if (!line || !actor || !target) return
  const x1 = paintCoord(actor, 'x', alpha) + actor.width / 2
  const y1 = paintCoord(actor, 'y', alpha) + actor.height / 2
  const x2 = paintCoord(target, 'x', alpha) + target.width / 2
  const y2 = paintCoord(target, 'y', alpha) + target.height / 2
  const c = writeCache(line)
  const key = `${x1},${y1},${x2},${y2}`
  if (c['pts'] === key) return
  c['pts'] = key
  line.setAttribute('x1', String(x1))
  line.setAttribute('y1', String(y1))
  line.setAttribute('x2', String(x2))
  line.setAttribute('y2', String(y2))
}

// [№15-ФИКС-ШАГ] Снимок prev-позиций всех агентов перед серией подшагов физики.
// Новый агент без prev интерполируется с текущей позиции (paintCoord fallback).
export const snapshotPrevPositions = (els: RawEl[]): void => {
  for (let i = 0; i < els.length; i++) {
    const el = els[i]
    if (!el || typeof el.x !== 'number') continue
    el._px = el.x
    el._py = el.y
  }
}
