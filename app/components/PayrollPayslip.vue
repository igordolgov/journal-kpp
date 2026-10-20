<!-- app/components/PayrollPayslip.vue -->
<!-- Назначение: расчётный лист закрытой смены (этап 7). Показывается после
    endShift, когда система оплаты включена. Суммы берёт из готовой сводки
    движка getShiftSummary() — сам ничего не считает (регламент «суммы
    считает движок»). Данные приходят через props: лист не должен знать про
    состояние смен — источник данных решает вызывающий (ShiftManagerModals).
    Pug-урок этапа 6: классы с точкой/слэшем (py-1.5, bg-x/50) — только
    через атрибут class="..."; здесь таких нет, поэтому dot-синтаксис.
    Минус сумм — U+2212 «−», а не дефис: знак совпадает с HUD. -->
<template lang="pug">
dialog.modal(:class="open ? 'modal-open' : ''" v-if="summary")
  .modal-box
    h3.font-bold.text-lg 🧾 Расчётный лист
    .text-sm.mt-1 {{ shift?.guard_name || 'Охранник' }}
    .text-xs.text-gray-500 {{ periodText }}
    .text-xs.text-gray-400(v-if="shift?.notes") Примечание: {{ shift.notes }}
    .divider.my-2
    .flex.justify-between.text-sm.py-1
      span Базовая ставка
      span.font-bold.text-success +{{ fmt(summary.baseSalary) }} {{ currency }}
    template(v-for="g in groups" :key="g.kind")
      .text-xs.uppercase.tracking-wide.text-gray-500.mt-3.mb-1 {{ g.title }}
      .flex.justify-between.text-sm.gap-3(v-for="row in g.rows" :key="row.rule.code")
        span.min-w-0
          | {{ row.rule.title }}
          span.text-gray-400 ×{{ row.count }}
        span.font-semibold(:class="g.cls") {{ g.sign }}{{ fmt(row.amount) }} {{ currency }}
      .text-xs.text-gray-400(v-if="g.rows.length === 0") {{ g.empty }}
    .divider.my-2
    .flex.justify-between.items-center.gap-3
      span.font-bold Итого за смену
      span.font-bold.text-lg(:class="summary.total >= 0 ? 'text-success' : 'text-error'") {{ fmt(summary.total) }} {{ currency }}
    .text-xs.text-gray-400.mt-1 Проводок за смену: {{ summary.entriesCount }}
    .modal-action
      button.btn.btn-primary(@click="close") Закрыть
</template>

<script setup lang="ts">
// app/components/PayrollPayslip.vue — script
import { computed } from 'vue'
import { usePayroll } from '~/composables/usePayroll'
import type { PayrollShiftSummary } from '~/types/payroll'

interface ShiftMeta {
  guard_name?: string
  start_time?: number
  end_time?: number | null
  notes?: string | null
}

const props = defineProps<{
  open: boolean
  summary: PayrollShiftSummary | null
  shift: ShiftMeta | null
}>()

const emit = defineEmits<{ (e: 'close'): void }>()
const close = () => emit('close')

const { config } = usePayroll()
const currency = computed(() => config.value.currency)

const fmt = (n: number): string => n.toLocaleString('ru-RU')
const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

// Период и длительность смены: end_time подставляет вызывающий в момент
// закрытия; если он не пришёл — считаем «сейчас» (лист всё равно показывается
// сразу после endShift)
const periodText = computed(() => {
  const s = props.shift
  if (!s?.start_time) return ''
  const end = s.end_time ?? Date.now()
  const mins = Math.max(1, Math.round((end - s.start_time) / 60000))
  const dur = mins >= 60 ? `${Math.floor(mins / 60)} ч ${mins % 60} мин` : `${mins} мин`
  return `Смена ${fmtTime(s.start_time)} — ${fmtTime(end)} (${dur})`
})

// Группировка итогов: бонусы и штрафы отдельными секциями. Правило могло
// быть удалено из конфига — getShiftSummary уже подложил запасной title.
const groups = computed(() => {
  const s = props.summary
  if (!s) return []
  return [
    {
      kind: 'bonus', title: 'Бонусы',
      rows: s.byRule.filter(r => r.rule.kind === 'bonus'),
      sign: '+', cls: 'text-success', empty: 'Бонусов не было',
    },
    {
      kind: 'penalty', title: 'Штрафы',
      rows: s.byRule.filter(r => r.rule.kind === 'penalty'),
      sign: '−', cls: 'text-error', empty: 'Штрафов не было',
    },
  ]
})
</script>
