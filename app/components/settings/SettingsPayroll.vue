<!-- app/components/settings/SettingsPayroll.vue -->
<!-- Назначение: вкладка «Оплата» — тарифы бонусов/штрафов, пресеты сложности.
    Почему тарифы не в app_config: хранятся отдельной записью 'payroll_config'
    (usePayroll), чтобы экспорт/импорт и правки других вкладок не откатывали
    их. Общая кнопка «Сохранить изменения» (settings.vue) тоже пишет
    payroll_config, поэтому отдельной кнопки на вкладке не нужно.
    Капа maxPerShift: 0 в поле = «без лимита» (в конфиг уходит undefined) —
    движок с капой 0 заблокировал бы правило целиком, см. setMaxPerShift.
    severity не редактируется: это классификация для отчётов, а не тариф. -->
<template lang="pug">
//- Тарифы грузятся из IndexedDB асинхронно: форма появляется только после
//- init(), иначе правки ушли бы в дефолтный конфиг и затёрли сохранённый
div(v-if="!ready")
  .card.mb-6.shadow.bg-base-100
    .card-body.items-center
      span.loading.loading-spinner.loading-md
      | Загрузка тарифов...
template(v-else)
  //- Мастер-выключатель, валюта, ставка
  .card.mb-6.shadow.bg-base-100
    .card-body
      h4.card-title.mb-4 💰 Оплата труда
      p.text-sm.text-gray-500.mb-4
        | Начисления идут только во время смены и ставятся на паузу в перерыв.
        | Выключенная система не мешает журналу и симулятору — тарифы можно готовить заранее.
      .grid.grid-cols-1(class="sm:grid-cols-3 gap-4")
        .form-control
          label.label.cursor-pointer
            span.label-text Система оплаты включена
            input.toggle.toggle-sm.toggle-primary(type="checkbox" v-model="config.enabled")
        .form-control
          label.label
            span.label-text Валюта (символ)
          input.input.input-sm.input-bordered(type="text" maxlength="3" v-model="config.currency")
        .form-control
          label.label
            span.label-text Базовая ставка за смену
          input.input.input-sm.input-bordered(type="number" min="0" step="50" v-model.number="config.baseSalary")

  //- Пресеты сложности: applyPreset() применяет и сохраняет сразу —
  //- это осознанное действие, поэтому перед ним ConfirmDialog
  .card.mb-6.shadow.bg-base-100
    .card-body
      h4.card-title.mb-4 🎯 Пресеты сложности
      p.text-sm.text-gray-500.mb-4 Применяются сразу и перезаписывают ручные правки тарифов.
      .grid.grid-cols-1(class="sm:grid-cols-3 gap-4")
        button.btn.btn-outline.h-auto.items-start.gap-1.py-3.flex-col(
          v-for="p in presets"
          :key="p.key"
          :class="{ 'btn-primary': config.preset === p.key }"
          @click="confirmPreset(p.key)"
        )
          span.font-bold
            | {{ p.label }}
            span.badge.badge-sm.ml-2(v-if="config.preset === p.key") выбран
          span.text-xs.font-normal.whitespace-normal.text-left {{ p.hint }}

  //- Бонусы
  .card.mb-6.shadow.bg-base-100
    .card-body
      h4.card-title.mb-4 🎁 Бонусы
      p.text-sm.text-gray-500.mb-4 За своевременные ворота и качественные записи в журнале.
      .border.border-base-300.rounded-xl.p-4.bg-base-200.mb-3(
        v-for="r in bonusRules"
        :key="r.code"
        :class="{ 'opacity-50': !r.enabled }"
      )
        .flex.flex-wrap.items-center.gap-3
          input.toggle.toggle-sm.toggle-primary(type="checkbox" v-model="r.enabled")
          .flex-1.min-w-0
            .flex.items-center.gap-2
              span.font-bold.text-sm {{ r.title }}
            .text-xs.text-gray-500 {{ r.description }}
        .grid.grid-cols-2(class="sm:grid-cols-4 gap-3 mt-3")
          .form-control
            label.label
              span.label-text {{ amountLabel(r) }}
            input.input.input-sm.input-bordered(type="number" min="0" v-model.number="r.amount")
          .form-control(v-if="r.graceSeconds != null")
            label.label
              span.label-text {{ graceLabel(r) }}
            input.input.input-sm.input-bordered(type="number" min="0" step="5" v-model.number="r.graceSeconds")
          .form-control
            label.label
              span.label-text Лимит за смену (0 — нет)
            input.input.input-sm.input-bordered(
              type="number" min="0" step="50"
              :value="r.maxPerShift ?? 0"
              @input="setMaxPerShift(r, $event)"
            )
          .form-control(v-if="r.streakLength != null")
            label.label
              span.label-text Длина серии
            input.input.input-sm.input-bordered(type="number" min="2" v-model.number="r.streakLength")

  //- Штрафы
  .card.mb-6.shadow.bg-base-100
    .card-body
      h4.card-title.mb-4 ⚠️ Штрафы
      p.text-sm.text-gray-500.mb-4 За пропуски записей, ошибки и долгое удержание у шлагбаума.
      .border.border-base-300.rounded-xl.p-4.bg-base-200.mb-3(
        v-for="r in penaltyRules"
        :key="r.code"
        :class="{ 'opacity-50': !r.enabled }"
      )
        .flex.flex-wrap.items-center.gap-3
          input.toggle.toggle-sm.toggle-primary(type="checkbox" v-model="r.enabled")
          .flex-1.min-w-0
            .flex.items-center.gap-2
              span.font-bold.text-sm {{ r.title }}
              span.badge.badge-sm(
                v-if="r.severity"
                :class="severityClass[r.severity]"
              ) {{ severityLabel[r.severity] }}
            .text-xs.text-gray-500 {{ r.description }}
        .grid.grid-cols-2(class="sm:grid-cols-4 gap-3 mt-3")
          .form-control
            label.label
              span.label-text {{ amountLabel(r) }}
            input.input.input-sm.input-bordered(type="number" min="0" v-model.number="r.amount")
          .form-control(v-if="r.graceSeconds != null")
            label.label
              span.label-text {{ graceLabel(r) }}
            input.input.input-sm.input-bordered(type="number" min="0" step="5" v-model.number="r.graceSeconds")
          .form-control
            label.label
              span.label-text Лимит за смену (0 — нет)
            input.input.input-sm.input-bordered(
              type="number" min="0" step="50"
              :value="r.maxPerShift ?? 0"
              @input="setMaxPerShift(r, $event)"
            )
</template>

<script setup lang="ts">
// app/components/settings/SettingsPayroll.vue — script
// Почему здесь init(): вкладку можно открыть сразу после старта приложения,
// а app.vue вызывает init() в onMounted — гонка возможна. init()
// идемпотентен, повторный вызов просто дождётся загрузки конфига.
import { computed, onMounted, ref } from 'vue'
import { usePayroll } from '~/composables/usePayroll'
import { useConfirm } from '~/composables/useConfirm'
import { useToast } from '~/composables/useToast'
import type { PayrollPresetKey, PayrollRule, PayrollSeverity } from '~/types/payroll'

const { config, init, applyPreset } = usePayroll()
const { confirmDialog } = useConfirm()
const toast = useToast()

const ready = ref(false)
onMounted(async () => {
  await init()
  ready.value = true
})

const bonusRules = computed(() => config.value.rules.filter(r => r.kind === 'bonus'))
const penaltyRules = computed(() => config.value.rules.filter(r => r.kind === 'penalty'))

// Капа «0 = без лимита»: в конфиг уходит undefined. Прямой v-model здесь
// нельзя — ноль в maxPerShift движок трактует как «капа исчерпана» и
// молча заблокирует всё правило
const setMaxPerShift = (rule: PayrollRule, e: Event) => {
  const raw = Number((e.target as HTMLInputElement).value)
  rule.maxPerShift = raw > 0 ? Math.round(raw) : undefined
}

const amountLabel = (r: PayrollRule): string =>
  r.unit === 'per_minute_over'
    ? `За минуту сверх лимита, ${config.value.currency}`
    : `${r.kind === 'bonus' ? 'Бонус' : 'Штраф'} за событие, ${config.value.currency}`

const graceLabel = (r: PayrollRule): string =>
  r.unit === 'per_minute_over' ? 'Лимит ожидания, сек' : 'Норматив, сек'

// Словари без строгой типизации ключей: в шаблоне v-if не сужает тип,
// а undefined-индекс безопасно даёт пустую строку
const severityClass: Record<string, string> = {
  minor: 'badge-ghost',
  major: 'badge-warning',
  critical: 'badge-error',
}
const severityLabel: Record<string, string> = {
  minor: 'незначительно',
  major: 'серьёзно',
  critical: 'критично',
}

const presets: Array<{ key: PayrollPresetKey; label: string; hint: string }> = [
  { key: 'intern', label: '🎓 Стажёр', hint: 'Мягкие нормативы, сниженные штрафы, ставка 1000' },
  { key: 'duty', label: '🛡️ Дежурный', hint: 'Баланс по умолчанию, ставка 1500' },
  { key: 'veteran', label: '🎖️ Ветеран', hint: 'Строгие нормативы, повышенные штрафы, ставка 2000' },
]

const confirmPreset = async (key: PayrollPresetKey) => {
  const meta = presets.find(p => p.key === key)
  const ok = await confirmDialog({
    title: `Применить пресет «${meta?.label ?? key}»?`,
    message: 'Тарифы и базовая ставка будут перезаписаны значениями пресета. Применяется сразу, ручные правки будут потеряны.',
    confirmLabel: 'Применить',
  })
  if (!ok) return
  await applyPreset(key)
  toast.success(`Пресет «${meta?.label ?? key}» применён`)
}
</script>
