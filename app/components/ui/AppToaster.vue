<!-- app/components/ui/AppToaster.vue -->
<!-- Назначение: глобальный контейнер тостов (монтируется в app.vue).
    [v3] по фидбеку «широкая карточка, крестик посередине»:
    - причина: DaisyUI .alert — это display:grid с justify-items:center,
      крестик центрировался в своей grid-колонке;
    - фикс: класс flex перекрывает grid (utilities-слой Tailwind выше
      components-слоя DaisyUI), flex-1 на тексте прижимает крестик вправо;
    - ширина: w-96 -> w-80 (320px), на узких экранах — вьюпорт минус поля. -->
<template lang="pug">
.toast-container.fixed.flex.flex-col.gap-2.p-1(
  class="top-16 right-3 z-70 w-auto max-w-[calc(100vw-1.5rem)] pointer-events-none"
  aria-live="polite"
)
  transition-group(name="toast")
    .alert.flex.items-center.gap-3.shadow-xl.pointer-events-auto(
      v-for="t in toasts"
      :key="t.id"
      :class="alertClass(t.type)"
      role="alert"
    )
      //- flex-1 прижимает кнопку закрытия к правому краю
      .flex-1.min-w-0.text-sm.font-medium.leading-snug.break-words {{ t.message }}
      button.btn.btn-xs.btn-circle.btn-ghost.shrink-0(
        type="button"
        @click="dismiss(t.id)"
        aria-label="Закрыть"
      ) ✕
</template>

<script setup lang="ts">
import { useToast, type ToastType } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

// Тип тоста -> цветовой вариант DaisyUI alert
const alertClass = (type: ToastType): string => {
  const map: Record<ToastType, string> = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  }
  return map[type] || 'alert-info'
}
</script>

<style scoped>
/* Появление/уход: выезд справа + мягкая посадка (люкс-моушн) */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.97);
}
/* Перестановка стека при удалении соседа */
.toast-move {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>