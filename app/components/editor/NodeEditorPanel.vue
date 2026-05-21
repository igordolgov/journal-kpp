<!-- components/editor/NodeEditorPanel.vue
Динамическая форма настроек для ноды сценария. -->
<template lang='pug'>
.form-control.text-xs.p-2
  //- 1. Название ноды
  label.label
    span.label-text.text-gray-500 Название (комментарий)
  input.input.input-sm.input-bordered.bg-gray-900.w-full(
    :value="node.label"
    @input="$emit('update:label', $event.target.value)"
    placeholder="Например: Проверка пропуска"
  )

  //- --- БЛОК ДЕЙСТВИЙ (ACTIONS) ---

  //- ДВИЖЕНИЕ (MOVE)
  template(v-if="node.type === 'move'")
    label.label.mt-3
      span.label-text.text-gray-400 Объект
    select.select.select-sm.select-bordered.bg-gray-900.w-full(
      v-model="params.targetId"
    )
      option(v-for="el in elements" :key="el.id" :value="el.id") {{ el.name || el.id }}
    
    label.label.mt-2
      span.label-text.text-gray-400 Цель
    select.select.select-sm.select-bordered.bg-gray-900.w-full(
      v-model="params.targetType"
    )
      option(value="point") В точку (X, Y)
      option(value="zone") В зону
      option(value="relative") Относительно текущей позиции
    
    .grid.grid-cols-2.gap-2.mt-1(v-if="params.targetType === 'point' || params.targetType === 'relative'")
      input.input.input-sm.input-bordered.bg-gray-900(
        type="number"
        v-model.number="params.x"
        placeholder="X"
      )
      input.input.input-sm.input-bordered.bg-gray-900(
        type="number"
        v-model.number="params.y"
        placeholder="Y"
      )

    select.select.select-sm.select-bordered.bg-gray-900.w-full.mt-1(
      v-if="params.targetType === 'zone'"
      v-model="params.targetId"
    )
      option(v-for="z in zones" :key="z.id" :value="z.id") Зона: {{ z.name || z.id }}

    label.label.mt-3
      span.label-text.text-gray-400 Физика движения
    .grid.grid-cols-2.gap-2
      div(class="tooltip hover:tooltip-open" data-tip="Скорость в пикселях в секунду")
        input.input.input-sm.input-bordered.bg-gray-900.w-full(
          type="number"
          v-model.number="params.speed"
          placeholder="Скорость"
        )
      input.input.input-sm.input-bordered.bg-gray-900.w-full(
        type="number"
        v-model.number="params.acceleration"
        placeholder="Ускорение"
      )
    
    label.label.mt-2
      span.label-text.text-gray-400 Режим выполнения
    select.select.select-sm.select-bordered.bg-gray-900.w-full(v-model="params.wait")
      option(:value="true") Ждать завершения
      option(:value="false") Параллельно с другими

  //- ВОРОТА (GATE)
  template(v-if="node.type === 'gate'")
    label.label.mt-2
      span.label-text.text-gray-400 Объект ворот
    select.select.select-sm.select-bordered.bg-gray-900.w-full(v-model="params.gateId")
      option(v-for="g in gates" :key="g.id" :value="g.id") {{ g.name || g.id }}
    
    label.label.mt-2
      span.label-text.text-gray-400 Действие
    .btn-group.w-full
      button.btn.btn-xs.flex-1(
        :class="params.gateAction === 'open' ? 'btn-active btn-primary' : ''"
        @click="params.gateAction = 'open'"
      ) Открыть
      button.btn.btn-xs.flex-1(
        :class="params.gateAction === 'close' ? 'btn-active btn-primary' : ''"
        @click="params.gateAction = 'close'"
      ) Закрыть

  //- СПАВН (SPAWN)
  template(v-if="node.type === 'spawn'")
    label.label.mt-2
      span.label-text.text-gray-400 Тип объекта
    select.select.select-sm.select-bordered.bg-gray-900.w-full(v-model="params.actorType")
      option(value="car") Машина
      option(value="human") Человек
    
    label.label.mt-2
      span.label-text.text-gray-400 Место появления (Зона)
    select.select.select-sm.select-bordered.bg-gray-900.w-full(v-model="params.spawnZoneId")
      option(v-for="z in zones" :key="z.id" :value="z.id") {{ z.name || z.id }}

    .form-control.mt-2
      label.label.cursor-pointer.justify-start
        input.checkbox.checkbox-sm.checkbox-primary.mr-2(
          type="checkbox"
          v-model="params.randomizeIdentity"
        )
        span.label-text Рандомизировать данные (Номер/Имя)

  //- ПАУЗА (WAIT)
  template(v-if="node.type === 'wait'")
    label.label.mt-2
      span.label-text.text-gray-400 Длительность (мс)
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      type="number"
      v-model.number="params.duration"
    )
    label.label.mt-2
      span.label-text.text-gray-400 Или рандом (от - до)
    .grid.grid-cols-2.gap-2
      input.input.input-sm.input-bordered.bg-gray-900(
        type="number"
        v-model.number="params.minVal"
        placeholder="Мин (мс)"
      )
      input.input.input-sm.input-bordered.bg-gray-900(
        type="number"
        v-model.number="params.maxVal"
        placeholder="Макс (мс)"
      )
  
  //- UI И ИНТЕРФЕЙС
  template(v-if="node.type === 'ui_message' || node.type === 'show_overlay'")
    label.label.mt-2
      span.label-text.text-gray-400 Текст сообщения
    textarea.textarea.textarea-sm.textarea-bordered.bg-gray-900.w-full(
      v-model="params.text"
      placeholder="Текст..."
    )
    label.label.mt-2(v-if="node.type === 'show_overlay'")
      span.label-text.text-gray-400 Тип окна
    select.select.select-sm.select-bordered.bg-gray-900.w-full(
      v-if="node.type === 'show_overlay'"
      v-model="params.overlayType"
    )
      option(value="info") Информация
      option(value="alert") Внимание
      option(value="modal") Модальное окно

  //- ВВОД ИГРОКА (WAIT FOR INPUT)
  template(v-if="node.type === 'wait_input'")
    label.label.mt-2
      span.label-text.text-gray-400 Текст кнопки
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      v-model="params.buttonLabel"
      placeholder="Открыть шлагбаум"
    )
    .alert.alert-info.mt-2.p-2
      span.text-xs Скрипт остановится здесь и будет ждать нажатия кнопки в UI.

  //- ЗВУК (SOUND)
  template(v-if="node.type === 'play_sound'")
    label.label.mt-2
      span.label-text.text-gray-400 ID Звука (файл)
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      v-model="params.soundId"
      placeholder="car_horn.mp3"
    )
    label.label.mt-2
      span.label-text.text-gray-400 Громкость (0.0 - 1.0)
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      type="number"
      step="0.1"
      v-model.number="params.volume"
    )

  //- ПЕРЕМЕННЫЕ (VARIABLES)
  template(v-if="node.type === 'set_var'")
    label.label.mt-2
      span.label-text.text-gray-400 Имя переменной
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      v-model="params.varName"
      placeholder="is_gate_open"
    )
    label.label.mt-2
      span.label-text.text-gray-400 Значение
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      v-model="params.varValue"
    )

  //- --- БЛОК УСЛОВИЙ (CONDITIONS) ---
  template(v-if="node.nodeType === 'condition'")
    template(v-if="node.type === 'random_chance'")
      label.label.mt-2
        span.label-text.text-gray-400 Шанс успеха (%)
      input.input.input-sm.input-bordered.bg-gray-900.w-full(
        type="number"
        v-model.number="params.chance"
      )
    
    template(v-if="node.type === 'check_var'")
      label.label.mt-2
        span.label-text.text-gray-400 Переменная
      input.input.input-sm.input-bordered.bg-gray-900.w-full(
        v-model="params.varName"
      )
      label.label.mt-2
        span.label-text.text-gray-400 Операция
      select.select.select-sm.select-bordered.bg-gray-900.w-full(v-model="params.compareOp")
        option(value="eq") Равно
        option(value="gt") Больше
        option(value="lt") Меньше
    
    .mt-3.p-2.bg-gray-800.rounded.text-gray-300
      p.text-xs.font-bold Ветки выполнения:
      p.text-xs.mt-1 • "Да" -> Выполнить, если условие истина.
      p.text-xs • "Нет" -> Выполнить, если ложь.

  //- --- БЛОК ЦИКЛОВ (LOOPS) ---
  template(v-if="node.nodeType === 'loop'")
    label.label.mt-2
      span.label-text.text-gray-400 Количество повторов
    input.input.input-sm.input-bordered.bg-gray-900.w-full(
      type="number"
      v-model.number="params.loopCount"
    )
    p.text-xs.text-gray-500.mt-1 Введите -1 для бесконечного цикла.

</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ScriptNode, SceneElement } from '../../types/scene'

const props = defineProps<{
  node: ScriptNode
  elements: SceneElement[]
}>()

const emit = defineEmits(['update:params', 'update:label'])

// Реактивная ссылка на параметры (упрощенная двусторонняя связь)
const params = computed({
  get: () => props.node.params,
  set: (val) => emit('update:params', val)
})

// Вычисляемые списки для селектов
const zones = computed(() => props.elements.filter(e => e.isZone))
const gates = computed(() => props.elements.filter(e => e.type === 'gate'))
</script>