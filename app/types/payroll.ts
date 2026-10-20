// app/types/payroll.ts
// Назначение: типы системы поощрений и штрафов («зарплата охранника»).
// Почему отдельный файл: типы — общий контракт движка (usePayroll), шины
// (payrollBus) и будущих UI (настройки, HUD, расчётный лист). По регламенту
// типы проекта живут в app/types/.

export type PayrollRuleKind = 'bonus' | 'penalty'

// per_event — фиксированная сумма за событие;
// per_minute_over — сумма за каждую минуту сверх graceSeconds (штраф за ожидание)
export type PayrollRuleUnit = 'per_event' | 'per_minute_over'

export type PayrollSeverity = 'minor' | 'major' | 'critical'

export interface PayrollRule {
  code: string              // стабильный ключ ('gate_on_time') — по нему мержится сохранённый конфиг
  enabled: boolean
  kind: PayrollRuleKind
  title: string             // человекочитаемое название («Ворота открыты вовремя»)
  description?: string
  amount: number            // всегда положительное число; направление задаёт kind
  unit: PayrollRuleUnit
  graceSeconds?: number     // норматив: у gate_on_time — лимит «вовремя», у gate_slow — лимит ожидания
  maxPerShift?: number      // капа суммарных начислений по правилу за одну смену
  severity?: PayrollSeverity
  streakLength?: number     // для streak_bonus: сколько правильных действий подряд
}

// Проводка — факт начисления. amount всегда >= 0, направление определяет kind правила.
export interface PayrollEntry {
  id?: number
  shift_id: number | null
  rule_code: string
  amount: number
  ts: number
  reason: string            // «Иванов И.И. ждал у ворот 2 мин 40 сек»
  dedupe_key: string        // `${shiftId}:${ruleCode}:${eventId}` — защита от двойного начисления
  ref?: {
    person_id?: number
    entry_id?: number
    gate_id?: string
  }
}

// --- События шины ---

export type PayrollEventType =
  | 'gate_opened'   // ворота/калитка открылись; payload.waitMs — сколько посетитель ждал
  | 'entry_added'   // запись в журнале создана; payload.correct / lateSeconds — оценка качества
  | 'entry_missing' // агент прошёл без записи в журнале
  | 'gate_no_entry' // ворота открыты, а записи в журнале нет
  | 'entry_phantom' // запись в журнале о том, кто не подходил к калитке/воротам

export interface PayrollEventPayload {
  waitMs?: number
  lateSeconds?: number
  correct?: boolean
  entryId?: number
  personId?: number
  fio?: string
  plate?: string
  direction?: 'enter' | 'exit'
  gateId?: string
  gateType?: 'gate' | 'wicket'
}

export interface PayrollEvent {
  id: string                // уникален в рамках сценария — входит в dedupe_key
  type: PayrollEventType
  ts: number
  payload: PayrollEventPayload
}

// --- Конфиг и пресеты ---

export type PayrollPresetKey = 'intern' | 'duty' | 'veteran'

export interface PayrollConfig {
  enabled: boolean          // мастер-выключатель: шина работает, начисления — нет
  currency: string          // символ валюты для UI
  baseSalary: number        // базовая ставка за смену (начисляется в расчётном листе)
  preset?: PayrollPresetKey | null // последний применённый пресет — для подсветки в настройках;
                                    // ручные правки тарифов его не сбрасывают
  rules: PayrollRule[]
}

// Итог смены — для расчётного листа (этап 7) и отчётов
export interface PayrollShiftSummary {
  shiftId: number
  baseSalary: number
  bonuses: number
  penalties: number
  total: number             // baseSalary + bonuses - penalties
  entriesCount: number
  byRule: Array<{ rule: PayrollRule; count: number; amount: number }>
}

// След прохода симулятора (ground truth для ручного журнала).
// Живёт в app/utils/payrollPass.ts от подхода агента к шлагбауму до его ухода.
export interface PayrollPassTrace {
  personId: number
  fio?: string
  plate?: string
  direction: 'enter' | 'exit'
  gateId?: string
  gateType?: 'gate' | 'wicket'
  ts: number                // момент подхода к шлагбауму — якорь для lateSeconds
  recordedTs?: number       // момент ручной записи водителя/лидера (гасит gate_no_entry и entry_missing)
  companionIds?: number[]   // пассажиры машины / члены группы — записи по ним оцениваются по следу главы
  recordedIds?: number[]    // кто уже оценён по этому следу (защита от повторной записи)
}
