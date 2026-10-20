<!-- app/components/SimulatorPayrollHud.vue -->
<!-- Назначение: живой HUD баланса смены поверх холста симулятора.
    Почему отдельный компонент и вне scale-обёртки: сцена масштабируется
    transform'ом — HUD сжимался бы вместе с ней; pointer-events-none,
    чтобы чип не перекрывал клики по воротам/калитке.
    Суммы показывает только движок (shiftBalance/shiftTotals из usePayroll) —
    HUD лишь отображает, сам ничего не считает (регламент «суммы считает
    движок»). Базовая ставка тут не показывается: она начисляется один раз
    в расчётном листе, HUD — про живую динамику. -->
<template lang="pug">
//- HUD v2 (фикс компиляции): py-1.5 и bg-gray-900/90 — только через
//- атрибут class="...". Почему: pug режет dot-класс .py-1.5 на «py-1» + «5»,
//- а класс с одной цифры запрещён («Class names must contain at least one
//- letter or underscore»). Атрибуты в одну строку — без многострочных
//- скобок: меньше предположений о возможностях pug-интеграции.
.absolute.top-2.right-2.z-30.pointer-events-none(v-if="visible")
  .rounded-lg.px-3.shadow-lg.text-right(class="py-1.5 bg-gray-900/90 border border-white/10")
    .flex.items-center.gap-2
      span.text-sm 💰
      span.font-bold.text-sm.tabular-nums(:class="balance >= 0 ? 'text-success' : 'text-error'") {{ displayBalance }}
      span.text-xxs(class="text-base-content/50") {{ currency }}
      span.text-xxs(v-if="isPaused" title="Перерыв — начисления на паузе") ⏸
    .text-xxs(class="text-base-content/40")
      | бонусы +{{ fmt(totals.bonuses) }} · штрафы −{{ fmt(totals.penalties) }}
</template>

<script setup lang="ts">
// app/components/SimulatorPayrollHud.vue — script
import { computed, onUnmounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { usePayroll } from '~/composables/usePayroll'
import { useToast } from '~/composables/useToast'

const { config, shiftBalance, shiftTotals, shiftEntries, activeShiftId, isInitialized, isPaused } = usePayroll()
const toast = useToast()

const visible = computed(() =>
  isInitialized.value && config.value.enabled && activeShiftId.value != null,
)
const currency = computed(() => config.value.currency)
const balance = computed(() => shiftBalance.value)
const totals = shiftTotals

const fmt = (n: number): string => n.toLocaleString('ru-RU')

// GSAP count-up: анимируем прокси-объект, а ref обновляем в onUpdate —
// gsap ничего не знает про Vue-реактивность, прямой твин по ref не сработает.
// ReturnType вместо gsap.core.Tween — устойчиво к вариациям типов gsap
const shown = ref(0)
let tween: ReturnType<typeof gsap.to> | null = null
watch(balance, (to) => {
  tween?.kill()
  const proxy = { v: shown.value }
  tween = gsap.to(proxy, {
    v: to,
    duration: 0.6,
    ease: 'power1.out',
    onUpdate: () => { shown.value = Math.round(proxy.v) },
  })
})
onUnmounted(() => tween?.kill())

// Знак только для положительных: отрицательные несут минус сами
const displayBalance = computed(() => {
  const v = shown.value
  return (v > 0 ? '+' : '') + fmt(v)
})

// Тост на каждое живое начисление. Diff по dedupe_key, а не по длине:
// движок может добавить две проводки синхронно (верная запись + быстрая
// запись) — watcher увидит +2 и сравнение длины промолчало бы.
// Свежесть по ts: восстановление истории из БД после F5 не должно тостить
watch(shiftEntries, (list, old) => {
  const prev = new Set((old ?? []).map(e => e.dedupe_key))
  const fresh = list.filter(e => !prev.has(e.dedupe_key))
  for (const entry of fresh) {
    if (Date.now() - entry.ts > 10_000) continue
    const rule = config.value.rules.find(r => r.code === entry.rule_code)
    const isPenalty = rule?.kind === 'penalty'
    const sign = isPenalty ? '−' : '+'
    const text = `${sign}${entry.amount} ${config.value.currency} — ${rule?.title ?? entry.rule_code}`
    if (isPenalty) toast.warning(text)
    else toast.success(text)
  }
})
</script>
