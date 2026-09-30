<!-- app/components/settings/SettingsColumns.vue -->
<template lang="pug">
.card.mb-5.shadow.bg-base-100
  .card-body.max-w-lg
    h4.card-title.mb-0 Порядок колонок
    table.table.w-full.table-zebra
      thead
        tr
          th.w-16 Вид.
          th Поле
          th.w-20 Действия
      tbody
        tr(v-for="(col, index) in columns" :key="col.key")
          td
            input.checkbox(type="checkbox" v-model="col.visible")
          td {{ configStore.getLabel(col.key) }}
          td
            .join
              button.join-item.btn.btn-xs.btn-outline(
                @click="configStore.moveItem('journalColumns', index, -1)"
              ) ▲
              button.join-item.btn.btn-xs.btn-outline(
                @click="configStore.moveItem('journalColumns', index, 1)"
              ) ▼
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

const configStore = useConfig()
const columns = computed(() => configStore.config.value.journalColumns)
</script>