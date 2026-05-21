<template lang='pug'>
  dialog.modal(class="modal-open")
    .modal-box.max-w-md
      h3.font-bold.text-lg.mb-4 📊 Детализация счета
      
      .overflow-y-auto.max-h-96
        ul.timeline.timeline-vertical.timeline-compact
          li(v-for='(msg, idx) in log' :key='idx')
            hr(v-if='idx > 0')
            .timeline-start.text-xs.opacity-70 
            .timeline-middle
              svg.h-4.w-4(:class='msg.includes("❌") ? "text-error" : (msg.includes("✅") ? "text-success" : "text-info")' fill='none' stroke='currentColor' viewBox='0 0 24 24')
                path(v-if='msg.includes("❌")' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12')
                path(v-else-if='msg.includes("✅")' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z')
                path(v-else stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z')
            .timeline-end.text-sm.mb-2(v-html='msg')
      
      .modal-action
        button.btn(@click='$emit("close")') Закрыть
    form.modal-backdrop(@click='$emit("close")')
</template>

<script setup lang="ts">
defineProps({
  log: { type: Array, required: true }
})
defineEmits(['close'])
</script>