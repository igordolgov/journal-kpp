<!-- app/components/ui/AppHint.vue -->
<!-- Назначение: контекстная подсказка — маленькая иконка "?" с тултипом.
    Ставится рядом со сложными понятиями (категории выхода, настройки
    симулятора). Иконка — inline SVG: без зависимости от иконок-библиотек. -->
<template lang="pug">
span.inline-flex.items-center(
  :class="tooltipClass"
  :data-tip="text"
  tabindex="0"
  role="note"
  :aria-label="text"
)
  //- Кружок с вопросом — самодостаточная SVG, стилизуется через currentColor
  svg.inline-block.shrink-0.opacity-40.transition-opacity.cursor-help(
    :class="iconClass"
    class="hover:opacity-80"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  )
    path(fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd")
</template>

<script setup lang="ts">
// AppHint — презентационный компонент, логики нет
const props = withDefaults(defineProps<{
  /** Текст подсказки (показывается в тултипе) */
  text: string
  /** Сторона тултипа (DaisyUI tooltip-позиции) */
  side?: 'top' | 'bottom' | 'left' | 'right'
}>(), {
  side: 'top'
})

// Класс позиции тултипа (DaisyUI): tooltip-top / tooltip-bottom и т.д.
const tooltipClass = `tooltip tooltip-${props.side}`
// Размер иконки подстраивается под контекст (в лейблах — мельче)
const iconClass = 'w-3.5 h-3.5'
</script>