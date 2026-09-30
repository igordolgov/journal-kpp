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
</template>

<script setup lang="ts">
// Глобальная логика приложения (если нужна)
</script>