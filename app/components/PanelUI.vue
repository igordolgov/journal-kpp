//- components/PanelUI.vue
<!-- Назначение: runtime-панель управления (поп-аут) с абсолютным позиционированием контролов.
    [ИСПРАВЛЕНО] ControlElement не существует в types/scene.ts — локальный интерфейс
    (поля style/interaction/binding не входят в Control из редактора сцен). -->
<template lang="pug">
.panel-content.h-full.w-full.flex.flex-col.bg-gray-800
  //- Header
  .h-7.flex.items-center.justify-between.px-2.bg-gray-900.text-xs.font-bold.cursor-move
    span {{ panel.title }}
    .flex.gap-1
      button.btn.btn-xxs.btn-ghost(@click="$emit('popout')") ↗

  //- Body
  .flex-1.relative.overflow-hidden
    template(v-for="ctrl in panel.controls" :key="ctrl.id")
      button.absolute.transition-all(
        :style="getControlStyle(ctrl)"
        :class="ctrl.style?.shape === 'circle' ? 'rounded-full' : 'rounded'"
        @mousedown="onDown(ctrl)" @mouseup="onUp(ctrl)" @touchstart.prevent="onDown(ctrl)" @touchend="onUp(ctrl)"
      )
        .w-full.h-full.flex.flex-col.items-center.justify-center(
          :style="{ backgroundColor: ctrl.style?.bgColor, color: ctrl.style?.textColor }"
        )
          span(v-if="ctrl.icon") {{ ctrl.icon }}
          span.text-xxs {{ ctrl.label }}
</template>

<script setup lang="ts">
// Локальный тип контрола runtime-панели: позиция в процентах + стиль/поведение
interface ControlElement {
  id: string
  x: number
  y: number
  width: number
  height: number
  icon?: string
  label?: string
  style?: { shape?: string; bgColor?: string; textColor?: string }
  interaction?: 'click' | 'hold' | 'toggle'
  binding?: string
}

// Локальный тип панели (controls типизированы ControlElement, а не Control)
interface RuntimePanel {
  id?: string
  title?: string
  controls: ControlElement[]
}

const props = defineProps<{ panel: RuntimePanel }>()
const emit = defineEmits(['action', 'popout'])

const getControlStyle = (c: ControlElement) => ({
  left: `${c.x}%`, top: `${c.y}%`, width: `${c.width}px`, height: `${c.height}px`
})

// Interaction Logic
const onDown = (ctrl: ControlElement) => {
  if (ctrl.interaction === 'hold') {
    // Start repeating or hold state
    emit('action', ctrl.binding)
  } else if (ctrl.interaction === 'click' || ctrl.interaction === 'toggle') {
    emit('action', ctrl.binding)
  }
}
const onUp = (ctrl: ControlElement) => {
  if (ctrl.interaction === 'hold') {
    // Stop
  }
}
</script>