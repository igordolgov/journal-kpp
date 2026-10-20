// app/composables/usePayroll.ts
// Назначение: движок зарплаты — принимает события шины, применяет правила,
// пишет проводки в store 'payroll'. Единственное место, где считаются деньги:
// UI только отображает (принцип «суммы считает движок» из регламента).
// Идемпотентность: dedupe_key = `${shiftId}:${ruleCode}:${eventId}` — повторный
// прогон того же события (HMR, реплей сценария) не задвоит начисление.
// Fail-safe: ни один обработчик не бросает исключение наружу — сбой оплаты
// не должен ломать симулятор.

import { ref, computed } from 'vue'
import type {
  PayrollConfig,
  PayrollEntry,
  PayrollEvent,
  PayrollPresetKey,
  PayrollRule,
  PayrollShiftSummary,
} from '~/types/payroll'
import { onPayrollEvent } from '~/utils/payrollBus'
import { useDatabase } from './useDatabase'

// --- Каталог правил по умолчанию ---

const defaultRules: PayrollRule[] = [
  // Бонусы
  {
    code: 'gate_on_time', enabled: true, kind: 'bonus',
    title: 'Ворота открыты вовремя',
    description: 'Открыл ворота/калитку в течение норматива после подхода',
    amount: 50, unit: 'per_event', graceSeconds: 30, maxPerShift: 1000,
  },
  {
    code: 'entry_on_time', enabled: true, kind: 'bonus',
    title: 'Запись сделана быстро',
    description: 'Запись в журнале в течение норматива после прохода',
    amount: 30, unit: 'per_event', graceSeconds: 60, maxPerShift: 600,
  },
  {
    code: 'entry_correct', enabled: true, kind: 'bonus',
    title: 'Запись верная',
    description: 'Данные записи совпали с фактическими (ФИО, номер, направление)',
    amount: 40, unit: 'per_event', maxPerShift: 800,
  },
  {
    code: 'streak_bonus', enabled: false, kind: 'bonus',
    title: 'Серия без ошибок',
    description: 'Премия за N правильных действий подряд',
    amount: 100, unit: 'per_event', streakLength: 5, maxPerShift: 500,
  },
  // Штрафы
  {
    code: 'gate_slow', enabled: true, kind: 'penalty',
    title: 'Долгое удержание у ворот',
    description: 'Каждая полная минута ожидания сверх лимита',
    amount: 25, unit: 'per_minute_over', graceSeconds: 60, maxPerShift: 750, severity: 'minor',
  },
  {
    code: 'entry_missing', enabled: true, kind: 'penalty',
    title: 'Пропущена запись',
    description: 'Человек/машина прошли без записи в журнале',
    amount: 100, unit: 'per_event', maxPerShift: 1000, severity: 'major',
  },
  {
    code: 'entry_wrong', enabled: true, kind: 'penalty',
    title: 'Неверная запись',
    description: 'Запись противоречит фактическим данным',
    amount: 80, unit: 'per_event', maxPerShift: 800, severity: 'major',
  },
  {
    code: 'entry_late', enabled: true, kind: 'penalty',
    title: 'Запись с опозданием',
    description: 'Запись сделана позже допустимого окна после прохода',
    amount: 50, unit: 'per_event', graceSeconds: 120, maxPerShift: 500, severity: 'minor',
  },
  {
    code: 'gate_no_entry', enabled: true, kind: 'penalty',
    title: 'Ворота без записи',
    description: 'Открыл ворота, а записи в журнале нет',
    amount: 150, unit: 'per_event', maxPerShift: 900, severity: 'critical',
  },
  {
    code: 'entry_phantom', enabled: true, kind: 'penalty',
    title: 'Запись без прохода',
    description: 'Запись в журнале о том, кто не подходил к калитке/воротам',
    amount: 120, unit: 'per_event', maxPerShift: 900, severity: 'major',
  },
]


// Пресеты сложности переопределяют только часть полей поверх дефолта —
// каталог правил остаётся единым, пресет лишь «крутит ручки».
// Внимание: применение пресета затирает ручные правки пользователя —
// это осознанное действие из настроек, а не фоновая операция.
const PAYROLL_PRESETS: Record<
  PayrollPresetKey,
  { baseSalary: number; overrides: Record<string, Partial<PayrollRule>> }
> = {
  intern: {
    baseSalary: 1000,
    overrides: {
      gate_on_time: { graceSeconds: 60, amount: 60 },
      gate_slow: { graceSeconds: 120, amount: 15 },
      entry_missing: { amount: 50 },
      entry_wrong: { amount: 40 },
      entry_late: { graceSeconds: 240, amount: 30 },
      gate_no_entry: { amount: 75 },
      entry_phantom: { amount: 60 },
    },
  },
  duty: { baseSalary: 1500, overrides: {} },
  veteran: {
    baseSalary: 2000,
    overrides: {
      gate_on_time: { graceSeconds: 20, amount: 70 },
      gate_slow: { graceSeconds: 45, amount: 40 },
      entry_missing: { amount: 200 },
      entry_wrong: { amount: 150 },
      entry_late: { graceSeconds: 60, amount: 80 },
      gate_no_entry: { amount: 250 },
      entry_phantom: { amount: 250 },
    },
  },
}

// [ФИКС] пресет по умолчанию «Стажёр» (запрос пользователя). Важно: не только
// ключ в конфиге, но и ТАРИФЫ дефолта обязаны совпадать с пресетом — иначе
// в настройках подсвечивается «Стажёр», а фактически действуют тарифы
// «Дежурного». Собираем дефолт из единого каталога правил + оверрайдов пресета.
const buildPresetRules = (
  preset: { overrides: Record<string, Partial<PayrollRule>> },
): PayrollRule[] => defaultRules.map(r => ({ ...r, ...(preset.overrides[r.code] || {}) }))

const defaultPayrollConfig: PayrollConfig = {
  enabled: true,
  preset: 'intern',
  currency: '₽',
  baseSalary: PAYROLL_PRESETS.intern.baseSalary,
  rules: buildPresetRules(PAYROLL_PRESETS.intern),
}

// --- Состояние (модульный уровень — синглтон на сессию, как в useShift) ---

const config = ref<PayrollConfig>(JSON.parse(JSON.stringify(defaultPayrollConfig)))
const entries = ref<PayrollEntry[]>([])
const activeShiftId = ref<number | null>(null)
const isPaused = ref(false)   // перерыв — начисления на паузе
const streakCount = ref(0)
const isInitialized = ref(false)

// Ключи уже записанных проводок держим в памяти: IndexedDB не даёт
// уникального индекса по произвольному полю, а перечитывать store на каждое
// событие — лишняя транзакция. Набор восстанавливается из БД при init().
const dedupeKeys = new Set<string>()

const SETTINGS_KEY = 'payroll_config'
const STORE = 'payroll'

// Подписка на шину — один раз на сессию (guard от повторного init)
let unsubscribe: (() => void) | null = null

// --- Вспомогательные ---

const fmtWait = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m <= 0) return `${rest} сек`
  return `${m} мин ${rest} сек`
}

export const usePayroll = () => {
  const { getAllItems, addItem, updateItem, clearStore } = useDatabase()

  const findRule = (code: string): PayrollRule | undefined =>
    config.value.rules.find(r => r.code === code)

  // Сколько уже начислено по правилу в текущей смене — для капы maxPerShift.
  // Данных немного (сотни проводок за смену), линейный проход дешевле
  // поддержания отдельного индекса.
  const ruleUsage = (ruleCode: string): { count: number; amount: number } => {
    let count = 0
    let amount = 0
    for (const e of entries.value) {
      if (e.shift_id === activeShiftId.value && e.rule_code === ruleCode) {
        count++
        amount += e.amount
      }
    }
    return { count, amount }
  }

  // --- Конфиг ---

  const loadConfig = async () => {
    const settings = await getAllItems('settings')
    const saved = settings.find((s: any) => s.id === SETTINGS_KEY)

    if (saved?.values?.rules) {
      // Мерж по code: сохранённые суммы/лимиты пользователя поверх дефолтов.
      // Дефолт подкладывается снизу, чтобы новые правила будущих версий
      // появлялись у существующих пользователей автоматически.
      const savedMap = new Map<string, PayrollRule>(
        saved.values.rules.map((r: PayrollRule) => [r.code, r]),
      )
      const merged: PayrollRule[] = defaultRules.map(def => ({
        ...JSON.parse(JSON.stringify(def)),
        ...(savedMap.get(def.code) || {}),
      }))
      // Пользовательские правила, которых нет в дефолтах, не теряем
      for (const r of saved.values.rules) {
        if (!merged.some(m => m.code === r.code)) merged.push(r)
      }
      config.value = {
        enabled: saved.values.enabled ?? defaultPayrollConfig.enabled,
        currency: saved.values.currency ?? defaultPayrollConfig.currency,
        baseSalary: saved.values.baseSalary ?? defaultPayrollConfig.baseSalary,
        preset: saved.values.preset ?? defaultPayrollConfig.preset,
        rules: merged,
      }
    } else {
      config.value = JSON.parse(JSON.stringify(defaultPayrollConfig))
    }
  }

  const saveConfig = async () => {
    await updateItem('settings', {
      id: SETTINGS_KEY,
      name: 'Оплата труда',
      values: JSON.parse(JSON.stringify(config.value)),
    })
  }

  const applyPreset = async (key: PayrollPresetKey) => {
    const preset = PAYROLL_PRESETS[key]
    if (!preset) return
    const next = JSON.parse(JSON.stringify(defaultPayrollConfig))
    next.baseSalary = preset.baseSalary
    for (const rule of next.rules) {
      Object.assign(rule, preset.overrides[rule.code] || {})
    }
    next.preset = key // запоминаем применённый пресет для подсветки в настройках
    config.value = next
    await saveConfig()
  }

  // --- Проводки ---

  const loadEntries = async () => {
    const all = await getAllItems(STORE)
    entries.value = all || []
    dedupeKeys.clear()
    for (const e of entries.value) dedupeKeys.add(e.dedupe_key)
  }

  /**
   * Начислить по правилу с учётом капы и идемпотентности.
   * Возвращает проводку или null (правило выключено / капа / дубликат).
   */
  const accrue = (
    rule: PayrollRule,
    amount: number,
    reason: string,
    event: PayrollEvent,
    refPayload: PayrollEntry['ref'],
  ): PayrollEntry | null => {
    if (!rule.enabled || amount <= 0) return null

    // Капа режет сумму, а не отменяет начисление целиком — так честнее
    // для per_minute_over (последняя неполная минута до капы всё же оплачивается)
    if (rule.maxPerShift != null) {
      const used = ruleUsage(rule.code).amount
      if (used >= rule.maxPerShift) return null
      amount = Math.min(amount, rule.maxPerShift - used)
    }

    const shiftId = activeShiftId.value
    const dedupeKey = `${shiftId}:${rule.code}:${event.id}`
    if (dedupeKeys.has(dedupeKey)) return null

    const entry: PayrollEntry = {
      shift_id: shiftId,
      rule_code: rule.code,
      amount: Math.round(amount),
      ts: Date.now(),
      reason,
      dedupe_key: dedupeKey,
      ref: refPayload,
    }

    // Запись в БД — fire-and-forget: сбой БД не должен ломать игру,
    // но молча терять проводки нельзя — логируем. Проводка в reactive-список
    // попадает сразу, id дозапишется после ответа IndexedDB.
    addItem(STORE, entry)
      .then((id) => { entry.id = id })
      .catch(e => console.error('[usePayroll] проводка не записана в БД', e))

    entries.value = [...entries.value, entry]
    dedupeKeys.add(dedupeKey)
    return entry
  }

  // --- Серии (streak_bonus) ---

  const registerStreak = (event: PayrollEvent, success: boolean) => {
    const rule = findRule('streak_bonus')
    if (!success) {
      streakCount.value = 0
      return
    }
    if (!rule?.enabled || !rule.streakLength) return

    streakCount.value++
    if (streakCount.value % rule.streakLength === 0) {
      // streak — производное начисление от конкретного события,
      // поэтому dedupe строится от его id
      accrue(
        rule,
        rule.amount,
        `Серия из ${rule.streakLength} правильных действий подряд`,
        event,
        {},
      )
    }
  }

  // --- Обработчики событий ---

  const handleGateOpened = (event: PayrollEvent) => {
    const waitSec = (event.payload.waitMs ?? 0) / 1000
    const gateLabel = event.payload.gateType === 'wicket' ? 'калитку' : 'ворота'
    const refPayload: PayrollEntry['ref'] = {
      person_id: event.payload.personId,
      gate_id: event.payload.gateId,
    }
    const who = event.payload.fio || event.payload.plate

    // Вовремя: ожидание в пределах норматива бонусного правила
    const onTime = findRule('gate_on_time')
    if (
      onTime?.enabled
      && onTime.graceSeconds != null
      && waitSec <= onTime.graceSeconds
    ) {
      accrue(
        onTime,
        onTime.amount,
        `Открыл ${gateLabel} за ${fmtWait(waitSec)} (норматив ${onTime.graceSeconds} сек)`,
        event,
        refPayload,
      )
      registerStreak(event, true)
      return
    }

    // Долгое удержание: каждая полная минута сверх лимита
    const slow = findRule('gate_slow')
    if (
      slow?.enabled
      && slow.graceSeconds != null
      && waitSec > slow.graceSeconds
    ) {
      const minutesOver = Math.ceil((waitSec - slow.graceSeconds) / 60)
      accrue(
        slow,
        minutesOver * slow.amount,
        `${who || 'Посетитель'} ждал у ${gateLabel} ${fmtWait(waitSec)} — лимит ${slow.graceSeconds} сек`,
        event,
        refPayload,
      )
      registerStreak(event, false)
    }
  }

  const handleEntryAdded = (event: PayrollEvent) => {
    const { correct, lateSeconds, fio, plate } = event.payload
    const refPayload: PayrollEntry['ref'] = {
      person_id: event.payload.personId,
      entry_id: event.payload.entryId,
    }
    const who = fio || plate || 'проход'

    // Неверная запись — штраф; опоздание при ней не считаем:
    // одна ошибка — один штраф, иначе двойное наказание за один факт
    if (correct === false) {
      const wrong = findRule('entry_wrong')
      if (wrong) {
        accrue(wrong, wrong.amount, `Неверная запись: ${who}`, event, refPayload)
      }
      registerStreak(event, false)
      return
    }

    if (correct === true) {
      const good = findRule('entry_correct')
      if (good) {
        accrue(good, good.amount, `Верная запись: ${who}`, event, refPayload)
      }

      // Скорость записи: норматив отсчитывается от подхода к шлагбауму.
      // Правильный порядок — «сначала запись, потом открытие», поэтому
      // запись во время ожидания тоже считается быстрой.
      const fast = findRule('entry_on_time')
      if (
        fast?.enabled
        && fast.graceSeconds != null
        && (lateSeconds ?? 0) <= fast.graceSeconds
      ) {
        accrue(
          fast,
          fast.amount,
          `Запись по «${who}» без задержки (${fmtWait(lateSeconds ?? 0)} от подхода)`,
          event,
          refPayload,
        )
      }
    }

    // Опоздание: окно от подхода до записи (перекрывает бонус за скорость —
    // оба не могут сработать на одном факте: либо в нормативе, либо нет)
    const late = findRule('entry_late')
    if (
      late?.enabled
      && late.graceSeconds != null
      && (lateSeconds ?? 0) > late.graceSeconds
    ) {
      accrue(
        late,
        late.amount,
        `Запись по «${who}» сделана через ${fmtWait(lateSeconds ?? 0)} — окно ${late.graceSeconds} сек`,
        event,
        refPayload,
      )
    }

    if (correct === true) registerStreak(event, true)
  }

  const handleEvent = (event: PayrollEvent) => {
    try {
      // Три независимых предохранителя: система выключена, смена не открыта,
      // перерыв. Оплата возможна только «на посту» — это игровое правило.
      if (!config.value.enabled) return
      if (activeShiftId.value == null) return
      if (isPaused.value) return

      switch (event.type) {
        case 'gate_opened':
          handleGateOpened(event)
          break
        case 'entry_added':
          handleEntryAdded(event)
          break
        case 'entry_missing': {
          const rule = findRule('entry_missing')
          if (rule) {
            const who = event.payload.fio || event.payload.plate
            accrue(
              rule,
              rule.amount,
              `Пропущена запись: ${who || 'неизвестный'} прошёл без журнала`,
              event,
              { person_id: event.payload.personId },
            )
          }
          registerStreak(event, false)
          break
        }
        case 'gate_no_entry': {
          const rule = findRule('gate_no_entry')
          if (rule) {
            const gateLabel = event.payload.gateType === 'wicket' ? 'калитку' : 'ворота'
            const who = event.payload.fio || event.payload.plate
            accrue(
              rule,
              rule.amount,
              // [stage-8.1] кто именно прошёл без записи: при очереди у
              // ворот штраф следующему агенту выглядел ложным («я же
              // записал!» — но записан был предыдущий)
              `Открыл ${gateLabel} без записи: ${who || 'неизвестный'}`,
              event,
              {
                person_id: event.payload.personId,
                gate_id: event.payload.gateId,
              },
            )
          }
          registerStreak(event, false)
          break
        }
        case 'entry_phantom': {
          // Запись о человеке, который ни разу не подходил к калитке/воротам
          // за сессию симулятора. Продюсер — useJournalPage (точки создания
          // записей), след прохода живёт в utils/payrollPass
          const rule = findRule('entry_phantom')
          if (rule) {
            const who = event.payload.fio || event.payload.plate
            accrue(
              rule,
              rule.amount,
              `Запись без прохода: ${who || 'неизвестный'} не подходил к калитке/воротам`,
              event,
              {
                person_id: event.payload.personId,
                entry_id: event.payload.entryId,
              },
            )
          }
          registerStreak(event, false)
          break
        }
      }
    } catch (e) {
      // Fail-safe: ошибка начисления никогда не должна доходить до симулятора
      console.error('[usePayroll] ошибка обработки события', event.type, e)
    }
  }

  // --- Публичный API ---

  /**
   * Инициализация: загрузка конфига и проводок, подписка на шину.
   * Идемпотентна — можно звать из app.vue onMounted без страхов.
   */
  const init = async () => {
    if (import.meta.server || isInitialized.value) return
    await loadConfig()
    await loadEntries()
    unsubscribe = onPayrollEvent(handleEvent)
    isInitialized.value = true
    console.info('[usePayroll] движок запущен, правил:', config.value.rules.length)
  }

  const setActiveShift = (shiftId: number | null) => {
    activeShiftId.value = shiftId
    // Серия — внутри смены: новая смена всегда начинает с нуля
    streakCount.value = 0
  }

  const setPaused = (value: boolean) => {
    isPaused.value = value
  }

  const clearAllEntries = async () => {
    await clearStore(STORE)
    entries.value = []
    dedupeKeys.clear()
    streakCount.value = 0
  }

  // Проводки текущей смены — источник для HUD и расчётного листа
  const shiftEntries = computed<PayrollEntry[]>(() =>
    entries.value.filter(e => e.shift_id === activeShiftId.value),
  )

  const shiftTotals = computed(() => {
    let bonuses = 0
    let penalties = 0
    for (const e of shiftEntries.value) {
      const rule = findRule(e.rule_code)
      if (rule?.kind === 'penalty') penalties += e.amount
      else bonuses += e.amount
    }
    return { bonuses, penalties }
  })

  // «Премиальные» без базовой ставки: база начисляется только в расчётном
  // листе (этап 7), HUD показывает живую динамику смены
  const shiftBalance = computed(() => shiftTotals.value.bonuses - shiftTotals.value.penalties)

  // Сводка произвольной смены — для расчётного листа и истории (этапы 7–8)
  const getShiftSummary = (
    shiftId: number,
    baseSalary = config.value.baseSalary,
  ): PayrollShiftSummary => {
    let bonuses = 0
    let penalties = 0
    const byRuleMap = new Map<string, { count: number; amount: number }>()

    for (const e of entries.value) {
      if (e.shift_id !== shiftId) continue
      const rule = findRule(e.rule_code)
      if (rule?.kind === 'penalty') penalties += e.amount
      else bonuses += e.amount

      const agg = byRuleMap.get(e.rule_code) || { count: 0, amount: 0 }
      agg.count++
      agg.amount += e.amount
      byRuleMap.set(e.rule_code, agg)
    }

    const byRule = [...byRuleMap.entries()].map(([code, agg]) => ({
      // Правило могли удалить из конфига — тогда проводка всё равно
      // должна показаться в листе с запасным заголовком
      rule: findRule(code) || {
        code, enabled: false, kind: 'bonus' as const,
        title: code, amount: 0, unit: 'per_event' as const,
      },
      count: agg.count,
      amount: agg.amount,
    }))

    return {
      shiftId,
      baseSalary,
      bonuses,
      penalties,
      total: baseSalary + bonuses - penalties,
      entriesCount: byRule.reduce((sum, r) => sum + r.count, 0),
      byRule,
    }
  }

  return {
    // состояние
    config,
    entries,
    activeShiftId,
    isPaused,
    streakCount,
    isInitialized,
    // вычисляемое
    shiftEntries,
    shiftTotals,
    shiftBalance,
    // методы
    init,
    saveConfig,
    applyPreset,
    setActiveShift,
    setPaused,
    clearAllEntries,
    getShiftSummary,
  }
}
