<!-- app/app.vue -->
<!-- Главный компонент приложения. Точка входа для рендеринга страниц и лейаутов. -->
<template lang="pug">
div.min-h-screen.bg-base-200
  NuxtLoadingIndicator(color="#570df8" :height="3")
  NuxtLayout
    NuxtPage

  //- Глобальный контейнер тостов
  UiAppToaster
  //- Глобальный диалог подтверждения (замена нативного confirm)
  UiConfirmDialog
  //- Глобальный диалог ввода (замена нативного prompt) [№15-UX]
  UiPromptDialog
</template>

<script setup lang="ts">
// Глобальная логика приложения
// [PAYROLL] Ранняя инициализация движка оплаты: страница настроек получает
// конфиг, симулятор — подписчика шины. init() идемпотентен (повторы — no-op),
// поэтому startShift дублирует вызов без риска двойной подписки.
import { onMounted } from 'vue'
import { usePayroll } from '~/composables/usePayroll'

onMounted(() => {
  usePayroll().init()
})
</script>