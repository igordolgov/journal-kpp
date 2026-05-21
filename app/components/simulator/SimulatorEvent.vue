<template lang='pug'>
  .text-center.w-full
    //- СОСТОЯНИЕ: Connected
    div(v-if='event.stage === "connected"')
      .alert.p-2.shadow-lg.backdrop-blur-sm(class="alert-info bg-blue-900 bg-opacity-70 text-white")
        .font-bold.text-sm {{ event.initialMessage }}
        .divider.my-1
        .text-xs
          div(v-if='event.type === "vehicle"')
            div.font-bold {{ event.hiddenData.driver }}
            div.mt-1(v-if='event.hiddenData.passengers.length')
              span.badge.badge-xs.ml-1(v-for='p in event.hiddenData.passengers' :class='!p.hasRight ? "badge-error" : "badge-ghost"') {{ p.fio }}
          div(v-else)
            span.font-bold {{ event.hiddenData.fio }}
            span.text-red-400(v-if='!event.hiddenData.hasRight') (🚫 Нарушение)
        
        .mt-2.flex.flex-wrap.justify-center.gap-1
          template(v-if='event.type === "vehicle"')
            button.btn.btn-success.btn-xs(@click.stop='$emit("open-gate", event)') Открыть
            button.btn.btn-error.btn-xs(@click.stop='$emit("reject", event)') Отказ
          template(v-else)
            button.btn.btn-success.btn-xs(@click.stop='$emit("open-wicket", event)') Открыть
            button.btn.btn-warning.btn-xs(@click.stop='$emit("wait", event)') Ждите
            button.btn.btn-error.btn-xs(@click.stop='$emit("reject", event)') Отказ

    //- СОСТОЯНИЕ: Ringing
    div(v-else-if='event.stage === "ringing"')
      .text-yellow-300.font-bold.text-lg 🔔 ВЫЗОВ!
    
    //- СОСТОЯНИЕ: Missed
    div(v-else-if='event.stage === "missed"')
      .text-red-400.font-bold ПРОПУСК
</template>

<script setup lang="ts">
defineProps<{
  event: any
}>()

defineEmits(['open-gate', 'reject', 'open-wicket', 'wait'])
</script>