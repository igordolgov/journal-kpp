<!-- app/components/settings/SettingsUi.vue -->
<template lang="pug">
.card.mb-6.shadow.bg-base-100
  .card-body
    h4.card-title Общий вид
    .flex.items-end.justify-between.mb-6
      .form-control
        label.label
          span.label-text.font-bold Тема оформления
        .flex.flex-wrap.gap-2.mt-2
          button.btn.rounded-lg(
            v-for="t in availableThemes"
            :key="t.id"
            :class="theme === t.id ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
            @click="theme = t.id"
          ) {{ t.name }}
      .form-control
        label.label.mb-2
          span.label-text.font-bold Общий размер шрифта ({{ fontSize }}px)
        input.range.range-sm.rounded-full.range-primary(
          type="range" min="12" max="20" step="1"
          v-model.number="fontSize"
          class="bg-primary/20"
        )
    .divider.mt-0 Таблица журнала
    .flex.items-end.justify-between.mb-6
      .form-control
        label.label
          span.label-text.font-bold Плотность строк
        .flex.gap-2.mt-2
          button.btn.btn-sm.rounded-lg(
            :class="uiSettings.tableDensity === 'compact' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
            @click="uiSettings.tableDensity = 'compact'"
          ) Компактная
          button.btn.btn-sm.rounded-lg(
            :class="uiSettings.tableDensity === 'normal' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
            @click="uiSettings.tableDensity = 'normal'"
          ) Стандартная
          button.btn.btn-sm.rounded-lg(
            :class="uiSettings.tableDensity === 'comfortable' ? 'btn-primary' : 'btn-outline border-2 border-secondary/50'"
            @click="uiSettings.tableDensity = 'comfortable'"
          ) Комфортная
      .form-control
        label.label.mb-2
          span.label-text.font-bold Размер шрифта в таблице ({{ uiSettings.tableFontSize }}px)
        input.range.range-sm.rounded-full.range-primary(
          type="range" min="10" max="18" step="1"
          v-model.number="uiSettings.tableFontSize"
          class="bg-primary/20"
        )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '~/composables/useConfig'
import { useTheme } from '~/composables/useTheme'

const configStore = useConfig()
const { theme, fontSize, availableThemes } = useTheme()
const uiSettings = computed(() => configStore.config.value.ui)
</script>