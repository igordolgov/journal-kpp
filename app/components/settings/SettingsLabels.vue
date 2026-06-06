<!-- app/components/settings/SettingsLabels.vue -->
<template lang="pug">
.card.mb-2.shadow.bg-base-100
  .card-body
    h4.card-title.mb-2 Переименование полей
    .grid.gap-2(class="grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-2")
      .form-control.flex.justify-between(
        v-for="(val, key) in labels"
        :key="key"
      )
        label.label.mr-2
          span.label-text.font-semibold.text-gray-500 {{ key }}:
        input.input.input-sm.input-bordered(v-model="labels[key]")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

const configStore = useConfig()
const labels = computed(() => configStore.config.value.labels)
</script>