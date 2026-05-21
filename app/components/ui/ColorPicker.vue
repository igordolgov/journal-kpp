<template lang="pug">
.div
  .flex.flex-wrap.gap-2.mb-2(v-if="palette && palette.length")
    button.w-6.h-6.rounded-md.border-2.transition-all.duration-100.shadow-sm(
      v-for="c in palette" :key="c"
      :style="{ background: c }"
      :class="modelValue === c ? 'border-blue-400 scale-110 ring-1 ring-blue-400/50' : 'border-transparent hover:border-gray-400'"
      @click="updateColor(c)"
    )
    //- Кнопка произвольного цвета
    label.relative.cursor-pointer.w-6.h-6.rounded-md.border-2.border-dashed.border-gray-500.flex.items-center.justify-center.text-gray-400.transition-colors(class="hover:border-blue-400 hover:text-blue-400")
      span.text-xs.font-bold +
      input.absolute.opacity-0.w-0.h-0(
        type="color" 
        :value="modelValue || defaultColor"
        @input="updateColor($event.target.value)"
      )
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  palette?: string[]
  defaultColor?: string
}>()

const emit = defineEmits(['update:modelValue'])

const updateColor = (color: string) => {
  emit('update:modelValue', color)
}
</script>