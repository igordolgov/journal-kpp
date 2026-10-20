// app/utils/payrollPass.ts
// Назначение: реестр «проходов» симулятора — ground truth для оценки ручных
// записей журнала. Когда агент подходит к шлагбауму, здесь рождается след
// прохода; когда пользователь сохраняет запись — след помечается записанным;
// когда агент уходит — нестёртый след означает «прошёл без записи».
//
// [stage-7.1] Дополнено для правила «запись без прохода» (entry_phantom):
//  1. seen — множество всех, кто хотя бы раз подходил к воротам за сессию
//     (включая пассажиров и членов групп). След живёт до деспавна агента,
//     а «не подходил вообще» — факт всей сессии: запись о человеке без
//     следа и без отметки seen = липовая запись.
//  2. companionIds в следе: пассажиры машины и члены группы оцениваются по
//     следу водителя/лидера (своего следа у них нет по регламенту).
//  3. peekPayrollPassFor находит след и по самому человеку, и по попутчику.
//
// [stage-8.1] «Запись раньше подхода»: охранник может оформить журнал, пока
// человек ещё идёт к воротам. Следа в этот момент ещё нет — раньше такая
// запись мгновенно получала ложный «запись без прохода», а след потом
// рождался пустым и давал ложный «ворота без записи» при открытии.
// Теперь ранняя запись откладывается в pendingRecords: если за
// PENDING_TTL_MS человек подошёл (markPayrollPass) — запись признаётся
// сделанной заранее (гасит gate_no_entry, оценивается как обычная), если
// не подошёл — истёкший pending публикует entry_phantom.
//
// Почему модуль, а не useSimulatorIntegration: реестр должен быть доступен
// и симулятору (mark/take), и журналу (peek) без циклических зависимостей
// между композаблами. IndexedDB для этого не нужна — следы живут секунды.

import type { PayrollPassTrace } from '~/types/payroll'
import { publishEntryAdded, publishEntryPhantom } from '~/utils/payrollBus'

// TTL следа: агент не может идти к воротам 10 минут. Чистка ленивая —
// при каждом mark, чтобы не плодить таймеры.
const PASS_TTL_MS = 10 * 60 * 1000

// Сколько ждать подхода после ранней записи. Спавн до ~30 сек + путь до
// ворот десятки секунд — 90 сек покрывает игровой темп; настоящая липа
// (никто не пришёл) штрафуется с задержкой, зато без ложных срабатываний.
const PENDING_TTL_MS = 90 * 1000

// Модульный уровень — синглтон на сессию (как состояние useShift)
const passes = new Map<number, PayrollPassTrace>()
const seen = new Set<number>()

// Ранняя запись: personId -> что записали. Таймер лежит в записи, чтобы
// clear не оставлял висящих setTimeout.
interface PendingRecord {
  personId: number
  fio?: string
  plate?: string
  direction: 'enter' | 'exit'
  entryId?: number
  ts: number
  timer: ReturnType<typeof setTimeout>
}
const pendingRecords = new Map<number, PendingRecord>()

// personId приходит и числом (симулятор), и строкой (формы журнала) —
// приводим к числу, иначе Map/Set промахиваются мимо ключа
const normId = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const clearPending = (personId: number): void => {
  const p = pendingRecords.get(personId)
  if (p) {
    clearTimeout(p.timer)
    pendingRecords.delete(personId)
  }
}

/**
 * Ранняя запись: журнал оформлен, а человек к воротам ещё не подходил
 * (следа нет). Не штрафуем сразу — ждём подхода; таймер истечения публикует
 * entry_phantom («запись без прохода»), подход — оценивает запись как обычную.
 */
export const addPendingRecord = (
  rawId: number | string | null | undefined,
  data: { fio?: string; plate?: string; direction: 'enter' | 'exit'; entryId?: number },
): void => {
  const personId = normId(rawId)
  if (personId == null) return
  // Повторная ранняя запись по тому же человеку — заменяем (одна оценка
  // на проход, таймеры не накапливаются)
  clearPending(personId)
  const record: PendingRecord = {
    personId,
    fio: data.fio,
    plate: data.plate,
    direction: data.direction,
    entryId: data.entryId,
    ts: Date.now(),
    timer: setTimeout(() => {
      pendingRecords.delete(personId)
      try {
        // За PENDING_TTL никто не подошёл — записанный не проходил: липа
        publishEntryPhantom({
          personId,
          fio: data.fio || '',
          plate: data.plate,
          direction: data.direction,
          entryId: data.entryId,
        })
      } catch (e) {
        console.error('[payrollPass] entry_phantom (ранняя запись) не опубликован', e)
      }
    }, PENDING_TTL_MS),
  }
  pendingRecords.set(personId, record)
}

// Оценка созревшей ранней записи: isSelf — запись по самому водителю/лидеру
// (гасит gate_no_entry), иначе по попутчику (оценивается по его следу).
const consumePending = (pid: number, trace: PayrollPassTrace, isSelf: boolean): void => {
  const pending = pendingRecords.get(pid)
  if (!pending) return
  clearPending(pid)
  if (isSelf) {
    trace.recordedTs = pending.ts
  } else {
    const recordedIds = trace.recordedIds || (trace.recordedIds = [])
    if (recordedIds.includes(pid)) return
    recordedIds.push(pid)
  }
  const expectedPlate = String(trace.plate || '').trim()
  const wrotePlate = String(pending.plate || '').replace('🚶 Пеш.', '').trim()
  const plateOk = !expectedPlate ? true : wrotePlate === expectedPlate
  try {
    publishEntryAdded({
      entryId: pending.entryId,
      personId: pid,
      fio: pending.fio || trace.fio || '',
      plate: trace.plate,
      direction: trace.direction,
      correct: pending.direction === trace.direction && plateOk,
      // Запись сделана ДО подхода — задержки нет: норматив выполняется
      lateSeconds: 0,
    })
  } catch (e) {
    console.error('[payrollPass] оценка ранней записи упала', e)
  }
}

export const markPayrollPass = (trace: PayrollPassTrace): void => {
  const now = Date.now()
  for (const [id, p] of passes) {
    if (now - p.ts > PASS_TTL_MS) passes.delete(id)
  }
  const companions = (trace.companionIds || [])
    .map(id => normId(id))
    .filter((id): id is number => id != null)
  const stored: PayrollPassTrace = { ...trace, companionIds: companions }
  passes.set(Number(trace.personId), stored)
  // «Виденные» живут всю сессию: человек мог подойти, уйти со сцены
  // (след снят при деспавне) — запись по нему уже не «липовая»
  const selfId = normId(trace.personId)
  if (selfId != null) seen.add(selfId)
  for (const id of companions) seen.add(id)

  // [stage-8.1] Созревшие ранние записи: свои и попутчиков
  if (selfId != null) consumePending(selfId, stored, true)
  for (const id of companions) consumePending(id, stored, false)
}

// peek — НЕ удаляет след: журнал помечает recordedTs, а снять след со сцены
// должен только handleAgentDone (единственная точка «проход завершён»)
export const peekPayrollPass = (personId?: number | string | null): PayrollPassTrace | null => {
  const key = normId(personId)
  if (key == null) return null
  return passes.get(key) ?? null
}

// Поиск следа для ЛЮБОГО участника прохода: сам водитель/лидер либо
// пассажир/член группы из companionIds
export const peekPayrollPassFor = (personId?: number | string | null): PayrollPassTrace | null => {
  const key = normId(personId)
  if (key == null) return null
  const direct = passes.get(key)
  if (direct) return direct
  for (const p of passes.values()) {
    if ((p.companionIds || []).some(id => Number(id) === key)) return p
  }
  return null
}

// Подходил ли человек к калитке/воротам хотя бы раз за сессию
export const hasPayrollSeen = (personId?: number | string | null): boolean => {
  const key = normId(personId)
  return key != null && seen.has(key)
}

// take — забирает след (удаляет из реестра). Вызывается при деспавне агента.
export const takePayrollPass = (personId?: number | string | null): PayrollPassTrace | null => {
  const key = normId(personId)
  if (key == null) return null
  const pass = passes.get(key) ?? null
  if (pass) passes.delete(key)
  // Ранняя запись этого человека больше не ждёт подхода: проход завершён,
  // недооценённый pending превратился бы в ложный entry_phantom
  clearPending(key)
  return pass
}

// Полная очистка (перезапуск симуляции, смена сцены)
export const clearPayrollPasses = (): void => {
  passes.clear()
  seen.clear()
  for (const [id] of pendingRecords) clearPending(id)
}
