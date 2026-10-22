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

// transform агента: семантика идентична getElementStyle в useSimulatorCore
// (translate3d + зеркало машины по _facingLeft/направлению + опциональный
// поворот человека при enableVisualRotation).
// [№15] alpha — доля физического шага для интерполяции (см. paintCoord);
// по умолчанию 1 (текущая позиция) — прежние вызовы/тесты не меняются.
export const agentTransform = (el: RawEl, enableRotation: boolean, alpha = 1): string => {
  const t = `translate3d(${paintCoord(el, 'x', alpha)}px, ${paintCoord(el, 'y', alpha)}px, 0)`
  if (el.category === 'car') {
    const facingLeft = el.settings?._facingLeft ?? el.direction === 'enter'
    return `${t} scaleX(${facingLeft ? -1 : 1})`
  }
  if (enableRotation && el.rotation) {
    return `${t} rotate(${(el.rotation * 180) / Math.PI}deg)`
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
}

// Покадровая запись агента: позиция+слой на корневом узле, пауза конечностей
// и фаза шага (--walk-hold) на обёртке аватара (только у людей).
export const paintAgent = (t: AgentPaintTargets, el: RawEl, enableRotation: boolean, alpha = 1): void => {
  if (t.node) {
    t.node.style.transform = agentTransform(el, enableRotation, alpha)
    t.node.style.zIndex = String(el.zIndex || 1)
  }
  if (t.avatar) {
    t.avatar.classList.toggle('is-paused', isAgentPaused(el))
    t.avatar.style.setProperty('--walk-hold', String(el.settings?._walkHold ?? 0))
  }
}

// Покадровая запись позиции лейбла.
export const paintLabel = (node: HTMLElement | null, el: RawEl, alpha = 1): void => {
  if (node) node.style.transform = labelTransform(el, alpha)
}

// Покадровая запись стрелы ворот (в т.ч. после kill() твина и синхронизаций
// сторожа — paint каждый кадр переносит фактическое состояние settings в DOM).
export const paintGate = (node: HTMLElement | null, s: RawEl | undefined | null): void => {
  if (node) node.style.transform = gateTransform(s)
}

// Покадровая запись линии «команда» (актор -> цель) в SVG.
export const paintCommandLine = (
  line: { setAttribute: (n: string, v: string) => void } | null,
  actor: RawEl | null | undefined,
  target: RawEl | null | undefined,
  alpha = 1,
): void => {
  if (!line || !actor || !target) return
  line.setAttribute('x1', String(paintCoord(actor, 'x', alpha) + actor.width / 2))
  line.setAttribute('y1', String(paintCoord(actor, 'y', alpha) + actor.height / 2))
  line.setAttribute('x2', String(paintCoord(target, 'x', alpha) + target.width / 2))
  line.setAttribute('y2', String(paintCoord(target, 'y', alpha) + target.height / 2))
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
