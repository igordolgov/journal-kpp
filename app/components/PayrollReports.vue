<!-- app/components/PayrollReports.vue -->
<!-- Назначение: этап 8 — аналитика оплаты на странице «Отчёты» (вкладка
    «Оплата»). KPI-карточки периода, структура начислений по правилам
    (doughnut), динамика по сменам (stacked bar: ставка/бонусы вверх,
    штрафы вниз от нуля), список смен с открытием расчётного листа
    (переиспользование PayrollPayslip этапа 7).
    Регламент «суммы считает движок»: итоги каждой смены берёт из
    getShiftSummary() движка usePayroll; агрегаты уже начисленных проводок
    (топ правил, счётчики) — только отображение того, что движок записал
    в store 'payroll'. Новых начислений здесь нет и быть не может.
    Pug-урок этапа 6: классы со слэшем/двоеточием/точкой (bg-base-100/80,
    md:col-span-3, p-1.5) — только через атрибут class="..."; атрибуты
    в одну строку. Минус сумм — U+2212 «−», как в HUD и расчётном листе. -->
<template lang="pug">
//- Корень — flex-ребёнок страницы «Аналитика»: KPI flex-none, графики flex-1
.flex.flex-col.flex-1.min-h-0
  //- KPI-карточки периода — селектор периода общий с вкладкой «Журнал»
  .grid.grid-cols-5.gap-3.px-4.pb-3.flex-none
    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60.flex.items-center.gap-1
        Wallet.w-3.h-3
        | Заработано
      .stat-value.text-2xl.font-bold.text-success {{ fmt(kpi.total) }} {{ currency }}

    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60.flex.items-center.gap-1
        TrendingUp.w-3.h-3
        | Бонусы
      .stat-value.text-2xl.font-bold.text-primary {{ fmt(kpi.bonuses) }} {{ currency }}

    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60.flex.items-center.gap-1
        TrendingDown.w-3.h-3
        | Штрафы
      .stat-value.text-2xl.font-bold.text-error {{ fmt(kpi.penalties) }} {{ currency }}

    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60.flex.items-center.gap-1
        CalendarDays.w-3.h-3
        | Смен
      .stat-value.text-2xl.font-bold.text-accent {{ kpi.shifts }}

    .stat.shadow-xl.bg-base-100.p-3.rounded-xl.border.border-base-300
      .stat-title.text-xs.opacity-60.flex.items-center.gap-1
        Receipt.w-3.h-3
        | Проводок
      .stat-value.text-2xl.font-bold.text-warning {{ kpi.entriesCount }}

  ClientOnly
    main.grid.grid-cols-12.gap-3.px-4.pb-4.flex-1.min-h-0
      //- ЛЕВАЯ КОЛОНКА: структура по правилам + топ правил
      .col-span-12.flex.flex-col.gap-3(class="md:col-span-3")
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(class="flex-2")
          .card-body.p-3.gap-2
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider.flex.items-center.gap-1
              ChartPie.w-3.h-3
              | По правилам
            .relative.w-full.h-full
              DoughnutChart(:data="rulesChartData" :options="doughnutOptions")
              .absolute.inset-0.flex.flex-col.items-center.justify-center.gap-1(v-if="!hasData" class="bg-base-100/80 rounded-box")
                ChartPie.w-8.h-8(class="text-base-content/20")
                p.text-xs(class="text-base-content/40") Нет начислений за период

        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(class="flex-1")
          .card-body.p-3.gap-1.overflow-hidden
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider.flex.items-center.gap-1
              Receipt.w-3.h-3
              | Топ правил
            .flex.flex-col.gap-1.overflow-y-auto.custom-scrollbar
              .flex.justify-between.items-center.gap-2.rounded-lg(v-for="r in topRules" :key="r.code" class="hover:bg-base-200 p-1.5 transition-colors")
                span.text-sm.truncate.min-w-0
                  | {{ r.title }}
                  span.text-xs.opacity-50 ×{{ r.count }}
                span.text-sm.font-semibold.flex-none(:class="r.kind === 'penalty' ? 'text-error' : 'text-success'") {{ r.sign }}{{ fmt(r.amount) }}
              .text-center.text-xs.opacity-40.py-2(v-if="!topRules.length") Нет данных

      //- ЦЕНТРАЛЬНАЯ КОЛОНКА: динамика по сменам
      .col-span-12.flex.flex-col(class="md:col-span-6")
        .card.shadow-xl.bg-base-100.flex-1.min-h-0.border.border-base-300
          .card-body.p-4.h-full.flex.flex-col.gap-2
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider.flex.items-center.gap-1
              ChartColumn.w-3.h-3
              | Начисления по сменам
            .text-xxs(class="text-base-content/40") Ставка — по текущим настройкам оплаты; штрафы уходят вниз от нуля
            .relative.w-full.flex-1.min-h-0
              BarChart(:data="shiftsChartData" :options="shiftsChartOptions")
              .absolute.inset-0.flex.flex-col.items-center.justify-center.gap-1(v-if="!hasData" class="bg-base-100/80 rounded-box")
                ChartColumn.w-8.h-8(class="text-base-content/20")
                p.text-xs(class="text-base-content/40") Нет начислений за период

      //- ПРАВАЯ КОЛОНКА: смены периода, клик — расчётный лист
      .col-span-12.flex.flex-col(class="md:col-span-3")
        .card.shadow-xl.bg-base-100.min-h-0.border.border-base-300(class="flex-1")
          .card-body.p-3.gap-1.overflow-hidden
            h4.text-xs.font-bold.text-base-content.opacity-70.uppercase.tracking-wider.flex.items-center.gap-1
              CalendarDays.w-3.h-3
              | Смены за период
            .flex.flex-col.gap-1.overflow-y-auto.custom-scrollbar
              button.w-full.text-left.flex.justify-between.items-center.gap-2.rounded-lg(v-for="s in shiftRows" :key="s.shiftId" @click="openPayslip(s)" class="hover:bg-base-200 p-1.5 transition-colors")
                span.min-w-0
                  span.text-sm.font-medium.block.truncate {{ s.dateLabel }}
                  span.text-xs.opacity-50.block.truncate {{ s.guardName }}
                span.text-sm.font-bold.flex-none(:class="s.total >= 0 ? 'text-success' : 'text-error'") {{ fmt(s.total) }} {{ currency }}
              .text-center.text-xs.opacity-40.py-2(v-if="!shiftRows.length") Нет смен с начислениями
    template(#fallback)
      .flex-1.flex.items-center.justify-center
        span.loading.loading-lg.loading-spinner.text-primary

  //- Расчётный лист по клику на смену — переиспользование компонента этапа 7
  PayrollPayslip(:open="payslipOpen" :summary="payslipSummary" :shift="payslipShift" @close="payslipOpen = false")
</template>

<script setup lang="ts">
// app/components/PayrollReports.vue — script
// Данные: движок usePayroll (проводки в памяти + getShiftSummary) и store
// 'shifts' (метаданные смен). shiftHistory композабла useShift урезан до
// 10 записей — периоду «Месяц» этого мало, читаем store целиком.
// Период приходит пропсом со страницы «Аналитика» — один селектор на обе
// вкладки. Компонент монтируется только при активной вкладке «Оплата»
// (v-if на вызывающей стороне), поэтому данные всегда свежие на входе.
import { ref, computed, onMounted } from 'vue'
import { Bar as BarChart, Doughnut as DoughnutChart } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend
} from 'chart.js'
// Аннотирование опций литеральным типом — строковые поля (position/mode)
// иначе не проходят контравариантную проверку
import type { ChartOptions } from 'chart.js'
// Иконки: имена проверены экспортом @lucide/vue 1.52
import {
  Wallet, TrendingUp, TrendingDown, CalendarDays, Receipt, ChartPie, ChartColumn
} from '@lucide/vue'
import { usePayroll } from '~/composables/usePayroll'
import { useDatabase } from '~/composables/useDatabase'
import type { PayrollShiftSummary } from '~/types/payroll'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const props = defineProps<{ period: string }>()

const { entries, config, init, getShiftSummary } = usePayroll()
const { getAllItems } = useDatabase()

const currency = computed(() => config.value.currency)
const fmt = (n: number): string => Math.round(n).toLocaleString('ru-RU')

const shiftsAll = ref<any[]>([])
onMounted(async () => {
  // init() идемпотентен (app.vue уже звал) — гарантирует конфиг и проводки
  // в памяти движка, без него getShiftSummary вернул бы нули
  await init()
  try {
    const all = await getAllItems('shifts')
    shiftsAll.value = (all || []).filter((s: any) => s.end_time != null)
  } catch (e) {
    console.error('[PayrollReports] не удалось прочитать смены', e)
  }
})

// Граница периода — та же семантика, что на вкладке «Журнал» страницы
const periodStart = (): number => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (props.period === 'day') return startOfDay
  const d = new Date()
  if (props.period === 'week') {
    d.setDate(d.getDate() - 7)
    return d.getTime()
  }
  d.setMonth(d.getMonth() - 1)
  return d.getTime()
}

// Проводки периода — база «топа правил» и пустых состояний графиков
const periodEntries = computed(() => {
  const start = periodStart()
  return entries.value.filter(e => e.ts >= start)
})

const hasData = computed(() => periodEntries.value.length > 0)

// Правило могли удалить из конфига — показываем код с запасной
// классификацией (та же политика, что в getShiftSummary движка)
const ruleOf = (code: string) => {
  const rule = config.value.rules.find(r => r.code === code)
  return rule
    ? { title: rule.title, kind: rule.kind }
    : { title: code, kind: 'bonus' as const }
}

// --- Смены периода: итог каждой — через движок («суммы считает движок») ---
const fmtDateTime = (ts: number): string =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

interface ShiftRow {
  shiftId: number
  start: number
  dateLabel: string
  guardName: string
  base: number
  bonuses: number
  penalties: number
  total: number
}

const shiftRows = computed<ShiftRow[]>(() => {
  const start = periodStart()
  return shiftsAll.value
    .filter(s => s.start_time >= start)
    .map(s => {
      const sum = getShiftSummary(Number(s.id))
      return {
        shiftId: Number(s.id),
        start: s.start_time,
        dateLabel: fmtDateTime(s.start_time),
        guardName: s.guard_name || 'Охранник',
        base: sum.baseSalary,
        bonuses: sum.bonuses,
        penalties: sum.penalties,
        total: sum.total,
      }
    })
    .sort((a, b) => b.start - a.start)
})

const kpi = computed(() => {
  let total = 0
  let bonuses = 0
  let penalties = 0
  for (const r of shiftRows.value) {
    total += r.total
    bonuses += r.bonuses
    penalties += r.penalties
  }
  return {
    total,
    bonuses,
    penalties,
    shifts: shiftRows.value.length,
    entriesCount: periodEntries.value.length,
  }
})

// --- Структура по правилам (doughnut + список): агрегат уже начисленных
// проводок — движок здесь ничего не решает, отображаем содержимое store ---
interface RuleRow {
  code: string
  title: string
  kind: 'bonus' | 'penalty'
  count: number
  amount: number
}

const ruleRows = computed<RuleRow[]>(() => {
  const agg = new Map<string, { count: number; amount: number }>()
  for (const e of periodEntries.value) {
    const a = agg.get(e.rule_code) || { count: 0, amount: 0 }
    a.count++
    a.amount += e.amount
    agg.set(e.rule_code, a)
  }
  return [...agg.entries()]
    .map(([code, a]) => {
      const r = ruleOf(code)
      return { code, title: r.title, kind: r.kind, count: a.count, amount: a.amount }
    })
    .sort((x, y) => y.amount - x.amount)
})

const topRules = computed(() =>
  ruleRows.value.slice(0, 5).map(r => ({
    ...r,
    sign: r.kind === 'penalty' ? '−' : '+',
  })),
)

// Палитра: бонусы — зелёные оттенки, штрафы — красные; «Прочее» — серый
const PALETTE: Record<'bonus' | 'penalty', string[]> = {
  bonus: ['rgba(34, 197, 94, 0.85)', 'rgba(34, 197, 94, 0.62)', 'rgba(34, 197, 94, 0.42)'],
  penalty: ['rgba(239, 68, 68, 0.85)', 'rgba(239, 68, 68, 0.62)', 'rgba(239, 68, 68, 0.42)', 'rgba(239, 68, 68, 0.28)'],
}
const colorFor = (kind: 'bonus' | 'penalty', idx: number): string => {
  const list = PALETTE[kind]
  return list[idx % list.length] ?? 'rgba(120, 120, 120, 0.6)'
}

const rulesChartData = computed(() => {
  const top = ruleRows.value.slice(0, 6)
  const rest = ruleRows.value.slice(6)
  const labels: string[] = []
  const data: number[] = []
  const colors: string[] = []
  const kindCounter: Record<'bonus' | 'penalty', number> = { bonus: 0, penalty: 0 }
  for (const r of top) {
    labels.push(r.title)
    data.push(r.amount)
    colors.push(colorFor(r.kind, kindCounter[r.kind]))
    kindCounter[r.kind]++
  }
  const restAmount = rest.reduce((s, r) => s + r.amount, 0)
  if (restAmount > 0) {
    labels.push('Прочее')
    data.push(restAmount)
    colors.push('rgba(120, 120, 120, 0.6)')
  }
  return { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, spacing: 2 }] }
})

const doughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  layout: { padding: 0 },
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.label}: ${fmt(Number(ctx.raw))} ${currency.value}`,
      },
    },
  },
}

// --- Динамика по сменам: ставка/бонусы вверх, штрафы вниз от нуля ---
const shiftsChartData = computed(() => {
  // Последние 14 смен по возрастанию — ось времени слева направо
  const rows = [...shiftRows.value].sort((a, b) => a.start - b.start).slice(-14)
  return {
    labels: rows.map(r => r.dateLabel),
    datasets: [
      { label: 'Ставка', data: rows.map(r => r.base), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 2 },
      { label: 'Бонусы', data: rows.map(r => r.bonuses), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderRadius: 2 },
      { label: 'Штрафы', data: rows.map(r => -r.penalties), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderRadius: 2 },
    ],
  }
})

// Итог смены для футера тултипа: label → total. Дубли меток (две смены
// в одну минуту) маловероятны, берётся последняя — точность тултипа не критична
const totalByLabel = computed(() => {
  const map = new Map<string, number>()
  for (const r of shiftRows.value) map.set(r.dateLabel, r.total)
  return map
})

const shiftsChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  layout: { padding: { top: 5, bottom: 0, left: 0, right: 0 } },
  scales: {
    x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
    y: {
      stacked: true,
      ticks: { font: { size: 10 }, callback: (v: any) => Math.abs(Number(v)) },
      grid: { color: 'rgba(0,0,0,0.05)' },
    },
  },
  plugins: {
    legend: { position: 'top', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx: any) =>
          `${ctx.dataset.label}: ${Number(ctx.raw) < 0 ? '−' : '+'}${fmt(Math.abs(Number(ctx.raw)))} ${currency.value}`,
        footer: (items: any[]) => {
          if (!items.length) return ''
          const total = totalByLabel.value.get(String(items[0]?.label))
          return total != null ? `Итого за смену: ${fmt(total)} ${currency.value}` : ''
        },
      },
    },
  },
}

// --- Расчётный лист по клику на смену (переиспользование этапа 7) ---
const payslipOpen = ref(false)
const payslipSummary = ref<PayrollShiftSummary | null>(null)
const payslipShift = ref<{ guard_name?: string; start_time?: number; end_time?: number | null; notes?: string | null } | null>(null)

const openPayslip = (row: ShiftRow) => {
  const meta = shiftsAll.value.find(s => Number(s.id) === row.shiftId)
  // Итог считает движок; метаданные — копия записи store 'shifts'
  payslipSummary.value = getShiftSummary(row.shiftId)
  payslipShift.value = meta ? { ...meta } : null
  payslipOpen.value = true
}
</script>
