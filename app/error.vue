<!-- app/error.vue -->
<!-- Глобальная страница ошибок Nuxt. -->
<!-- Отображается при 404, 500 и необработанных ошибках приложения. -->
<template lang="pug">
.min-h-screen.flex.items-center.justify-center.bg-base-200
  .text-center.p-8.max-w-md
    .text-6xl.mb-4 {{ error?.statusCode === 404 ? '🗺️' : '💥' }}
    h1.text-2xl.font-bold.mb-2 {{ title }}
    p.text-base-content.opacity-60.mb-6 {{ message }}
    .flex.gap-3.justify-center
      button.btn.btn-primary(@click="handleError") На главную
      button.btn.btn-ghost(@click="reload") Обновить страницу
</template>

<script setup lang="ts">
import { useError, clearError, useRouter } from '#imports'

const error = useError()
const router = useRouter()

const title = computed(() => {
  if (error.value?.statusCode === 404) return 'Страница не найдена'
  return 'Что-то пошло не так'
})

const message = computed(() => {
  if (error.value?.statusCode === 404) return 'Запрошенная страница не существует.'
  return error.value?.message || 'Произошла неожиданная ошибка. Попробуйте обновить страницу.'
})

const handleError = () => {
  clearError()
  router.push('/')
}

const reload = () => {
  clearError()
  window.location.reload()
}
</script>
