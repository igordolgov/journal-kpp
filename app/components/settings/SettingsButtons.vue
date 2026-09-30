<!-- app/components/settings/SettingsButtons.vue -->
<template lang="pug">
.card.mb-6.shadow.bg-base-100
  .card-body.max-w-lg
    h4.card-title.mb-4 Кнопки действий
    table.table.w-full.table-zebra
      thead
        tr
          th.w-16 Вид.
          th Название
          th.w-20 Действия
      tbody
        tr(v-for="(btn, index) in buttons" :key="btn.key")
          td
            input.checkbox(type="checkbox" v-model="btn.visible")
          td
            input.input.w-full.input-sm.input-bordered(v-model="btn.label")
          td
            .join
              button.join-item.btn.btn-xs.btn-outline(
                @click="configStore.moveItem('actionButtons', index, -1)"
              ) ▲
              button.join-item.btn.btn-xs.btn-outline(
                @click="configStore.moveItem('actionButtons', index, 1)"
              ) ▼
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

const configStore = useConfig()
const buttons = computed(() => configStore.config.value.actionButtons)
</script>