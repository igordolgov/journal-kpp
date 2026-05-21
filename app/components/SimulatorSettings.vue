<template lang='pug'>
  .fixed.inset-0.z-50.flex.items-center.justify-center.bg-black.bg-opacity-60.backdrop-blur-sm(@click.self='$emit("close")')
    .bg-gray-800.rounded-lg.shadow-xl.p-6.w-full.max-w-2xl.overflow-y-auto.text-gray-200(class="max-h-[90vh]")
      h2.text-xl.font-bold.mb-4.border-b.border-gray-700.pb-2 ⚙️ Настройки симулятора
      
      .space-y-6.mt-4
        
        //- Секция: Человек
        div
          h3.text-lg.font-semibold.text-blue-400.mb-2 👤 Параметры человека
          .grid.grid-cols-2.gap-4.bg-gray-900.p-3.rounded
            div
              label.block.text-sm.text-gray-400 Ширина (px)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scene.personWidth')
            div
              label.block.text-sm.text-gray-400 Высота (px)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scene.personHeight')
            
            div.col-span-2
              label.block.text-sm.text-gray-400 Скорость движения (пикс/мс)
                span.text-xs.text-gray-500.ml-1 (0.01 - медленно, 0.05 - быстро)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' step='0.005' v-model.number='form.scene.personSpeed')
            
            div.col-span-2
              label.block.text-sm.text-gray-400 Точка остановки Y (%)
                span.text-xs.text-gray-500.ml-1 (Где стоит перед калиткой)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scene.personStopY')

        //- Секция: Внешний вид сцены
        div
          h3.text-lg.font-semibold.text-green-400.mb-2 🎨 Внешний вид
          .grid.grid-cols-3.gap-4.bg-gray-900.p-3.rounded
            div
              label.block.text-sm.text-gray-400 Цвет неба (верх)
              input.input.input-sm.input-bordered.w-full.mt-1(type='color' v-model='form.scene.skyColorTop')
            div
              label.block.text-sm.text-gray-400 Цвет неба (низ)
              input.input.input-sm.input-bordered.w-full.mt-1(type='color' v-model='form.scene.skyColorBottom')
            div
              label.block.text-sm.text-gray-400 Цвет травы
              input.input.input-sm.input-bordered.w-full.mt-1(type='color' v-model='form.scene.grassColor')
            div
              label.block.text-sm.text-gray-400 Цвет дороги
              input.input.input-sm.input-bordered.w-full.mt-1(type='color' v-model='form.scene.roadColor')
            div
              label.block.text-sm.text-gray-400 Цвет решетки
              input.input.input-sm.input-bordered.w-full.mt-1(type='color' v-model='form.scene.barColor')
            div
              label.block.text-sm.text-gray-400 Ширина ворот (%)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scene.gateWidthPercent')

        //- Секция: Тайминги
        div
          h3.text-lg.font-semibold.text-yellow-400.mb-2 ⏱ Тайминги
          .grid.grid-cols-2.gap-4.bg-gray-900.p-3.rounded
            div
              label.block.text-sm.text-gray-400 Мин. интервал событий (мс)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.eventIntervalMin')
            div
              label.block.text-sm.text-gray-400 Макс. интервал событий (мс)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.eventIntervalMax')
            div
              label.block.text-sm.text-gray-400 Время открытия ворот (мс)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.gateOpenTime')

        //- Секция: Геймплей
        div
          h3.text-lg.font-semibold.text-red-400.mb-2 🎮 Геймплей
          .grid.grid-cols-2.gap-4.bg-gray-900.p-3.rounded
            div
              label.block.text-sm.text-gray-400 Шанс нарушения (%)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.violationChance')
            div
              label.block.text-sm.text-gray-400 Шанс машины (%)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.vehicleChance')
            div
              label.block.text-sm.text-gray-400 Шанс хвоста (Tailgating %)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.tailgatingChance')
            
            div
              label.block.text-sm.text-gray-400 Очки за успех
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scoreSuccess')
            div
              label.block.text-sm.text-gray-400 Штраф за ошибку
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scoreError')
            div
              label.block.text-sm.text-gray-400 Критическая ошибка (балл)
              input.input.input-sm.input-bordered.w-full.mt-1(type='number' v-model.number='form.scoreCriticalError')

      .flex.justify-end.mt-6.gap-3.border-t.border-gray-700.pt-4
        button.btn.btn-ghost.text-gray-400(@click='$emit("close")') Отмена
        button.btn.btn-primary(@click='save') 💾 Сохранить

</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  settings: any
}>()

const emit = defineEmits(['close'])

// Глубокая копия настроек для локального редактирования
const form = ref<any>({})

watch(() => props.settings, (newVal) => {
  if (newVal) {
    // Создаем полную копию, чтобы не ломать реактивность основного объекта при вводе
    form.value = JSON.parse(JSON.stringify(newVal))
  }
}, { immediate: true, deep: true })

const save = () => {
  if (!form.value) return
  
  // Вручную обновляем каждый уровень вложенности, чтобы сохранить реактивность props.settings
  
  // Обновляем корневые свойства
  Object.keys(form.value).forEach(key => {
    if (key !== 'scene') {
      props.settings[key] = form.value[key]
    }
  })

  // Обновляем scene
  if (form.value.scene) {
    // Сохраняем структуру scene, обновляя только значения
    Object.keys(form.value.scene).forEach(key => {
      props.settings.scene[key] = form.value.scene[key]
    })
  }

  emit('close')
}
</script>