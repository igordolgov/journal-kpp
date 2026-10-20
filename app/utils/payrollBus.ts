// app/utils/payrollBus.ts
// Назначение: мини-шина событий оплаты (pub/sub без внешних зависимостей).
// Почему шина, а не прямой вызов usePayroll(): продюсеры (симулятор, журнал)
// не должны знать о движке начислений — иначе циклические зависимости и
// связность, которую не отревьюить. Регламент: fail-safe и слабая связность.
// Файл лежит в app/utils — Nuxt автоимпортирует экспорты, продюсерам на
// этапе 4 хватит вызова publishGateOpened(...) без import.

import type { PayrollEvent, PayrollEventPayload, PayrollEventType } from '~/types/payroll'

type PayrollHandler = (event: PayrollEvent) => void

// Модульный уровень — синглтон на время жизни страницы (как состояние useShift)
const handlers = new Set<PayrollHandler>()

// id события входит в dedupe_key, поэтому обязан быть уникальным, даже если
// два события случились в одну миллисекунду
const genEventId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Подписка возвращает функцию отписки — для HMR и будущей очистки
export const onPayrollEvent = (handler: PayrollHandler): (() => void) => {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export const publishPayrollEvent = (
  type: PayrollEventType,
  payload: PayrollEventPayload = {},
): void => {
  const event: PayrollEvent = { id: genEventId(), type, ts: Date.now(), payload }
  // try/catch вокруг КАЖДОГО обработчика: падение движка не должно
  // ронять симулятор (fail-safe из регламента)
  for (const handler of handlers) {
    try {
      handler(event)
    } catch (e) {
      console.error('[payrollBus] обработчик упал, событие:', event.type, e)
    }
  }
}

// --- Хелперы для продюсеров (этап 4): одна строка на точку интеграции ---

export const publishGateOpened = (payload: PayrollEventPayload) =>
  publishPayrollEvent('gate_opened', payload)

export const publishEntryAdded = (payload: PayrollEventPayload) =>
  publishPayrollEvent('entry_added', payload)

export const publishEntryMissing = (payload: PayrollEventPayload) =>
  publishPayrollEvent('entry_missing', payload)

export const publishGateNoEntry = (payload: PayrollEventPayload) =>
  publishPayrollEvent('gate_no_entry', payload)

export const publishEntryPhantom = (payload: PayrollEventPayload) =>
  publishPayrollEvent('entry_phantom', payload)
