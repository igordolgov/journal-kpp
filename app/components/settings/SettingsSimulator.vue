<!-- app/components/settings/SettingsSimulator.vue -->
<template lang="pug">
//- Параметры физики
.card.mb-6.shadow.bg-base-100
  .card-body
    h4.card-title.mb-4 ⚡ Параметры физики
    p.text-sm.text-gray-500.mb-4 Настройки движения и поведения машин в симуляции. Требуется перезапуск симуляции для применения.
    .grid.gap-6(class="grid-cols-1 md:grid-cols-4")
      //- Группа: Движение
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 🚗 Движение
        .form-control.mb-2
          label.label
            span.label-text Ускорение (px/сек²)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.ACCEL")
        .form-control.mb-2
          label.label
            span.label-text Торможение (px/сек²)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.DECEL")
        .form-control
          label.label
            span.label-text Порог прибытия (px)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.ARRIVE_THRESHOLD")
      //- Группа: Коллизии
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 💥 Коллизии
        .form-control.mb-2
          label.label
            span.label-text Время реакции (сек)
          input.input.input-sm.input-bordered(type="number" step="0.1" v-model.number="simSettings.REACTION_TIME")
        .form-control.mb-2
          label.label
            span.label-text Буфер безопасности (px)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.MIN_BUFFER")
        .form-control
          label.label
            span.label-text Дальность зрения (px)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.MAX_LOOKAHEAD")
      //- Группа: Тупики
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 🚧 Тупики и Реверс
        .form-control.mb-2
          label.label
            span.label-text Время до отката (сек)
          input.input.input-sm.input-bordered(type="number" step="0.5" v-model.number="simSettings.DEADLOCK_TIME")
        .form-control.mb-2
          label.label
            span.label-text Время реверса (сек)
          input.input.input-sm.input-bordered(type="number" step="0.1" v-model.number="simSettings.REVERSE_TIME")
        .form-control
          label.label
            span.label-text Скорость реверса (px/сек)
          input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.REVERSE_SPEED")
      //- Группа: Графика
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 🎨 Графика
        .form-control
          label.label
            span.label-text Смещение спрайта (радианы)
          input.input.input-sm.input-bordered(type="number" step="0.1" v-model.number="simSettings.SPRITE_ORIENTATION_OFFSET")
          label.label
            span.label-text-alt.text-xs 0=Вправо, 1.57=Вниз, 3.14=Влево, -1.57=Вверх

//- Общие настройки симуляции
.card.mb-6.shadow.bg-base-100
  .card-body
    h4.card-title.mb-4 ⚡ Настройки симуляции
    p.text-sm.text-gray-500.mb-6 Изменения применяются после перезапуска симуляции (кнопка «Запустить» в редакторе).
    .grid.grid-cols-1(class="lg:grid-cols-2 gap-6")
      .space-y-6
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🌍
            h5.font-bold Общие
          .grid.grid-cols-1(class="sm:grid-cols-2 gap-4")
            .form-control
              label.label
                span.label-text Включить трафик
                input.toggle.toggle-sm.toggle-primary(v-model="simSettings.enabled")
            .form-control
              label.label
                span.label-text Макс. агентов
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.maxAgents" min="1" max="100")
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🚶‍♂️
            h5.font-bold Спавн людей
          .grid.grid-cols-2.gap-4
            .form-control
              label.label
                span.label-text Мин. интервал (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.spawnIntervalMin" step="1" min="1")
            .form-control
              label.label
                span.label-text Макс. интервал (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.spawnIntervalMax" step="1" min="1")
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🚗
            h5.font-bold Спавн машин
          .grid.grid-cols-2.gap-4
            .form-control
              label.label
                span.label-text Мин. интервал (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpawnIntervalMin" step="1" min="1")
            .form-control
              label.label
                span.label-text Макс. интервал (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpawnIntervalMax" step="1" min="1")
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🧑‍🤝‍🧑
            h5.font-bold Люди
          .grid.grid-cols-2.gap-4
            .form-control
              label.label
                span.label-text Скорость (px/сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personSpeed" step="5" min="10")
            .form-control
              label.label
                span.label-text Вес "На территории"
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.locationWeightInside" step="0.1" min="0.5")
          .grid.grid-cols-2.gap-4.mt-2
            .form-control
              label.label
                span.label-text Ширина (px)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personWidth" step="5" min="20")
            .form-control
              label.label
                span.label-text Высота (px)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.personHeight" step="5" min="20")
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🚙
            h5.font-bold Машины
          .grid.grid-cols-2.gap-4
            .form-control
              label.label
                span.label-text Скорость (px/сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carSpeed" step="5" min="10")
            .form-control
              label.label
                span.label-text Ширина (px)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carWidth" step="5" min="20")
            .form-control
              label.label
                span.label-text Высота (px)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.carHeight" step="5" min="20")
      .space-y-6
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl 🚪
            h5.font-bold Ворота и калитка
          .grid.grid-cols-2.gap-4
            .form-control
              label.label
                span.label-text Закрытие ворот (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.gateCloseDelay" step="1" min="0")
            .form-control
              label.label
                span.label-text Закрытие калитки (сек)
              input.input.input-sm.input-bordered(type="number" v-model.number="simSettings.wicketCloseDelay" step="1" min="0")
          .grid.grid-cols-2.gap-4.mt-2
            .form-control
              label.label.cursor-pointer
                span.label-text Автооткрытие ворот
                input.toggle.toggle-sm.toggle-primary(v-model="simSettings.autoOpenGates")
            .form-control
              label.label.cursor-pointer
                span.label-text Автооткрытие калитки
                input.toggle.toggle-sm.toggle-primary(v-model="simSettings.autoOpenWicket")
        .border.border-base-300.rounded-xl.p-4.bg-base-200
          .flex.items-center.gap-2.mb-3
            span.text-xl ⚙️
            h5.font-bold Физика движения
          .grid.grid-cols-2.gap-x-4.gap-y-2
            .form-control
              label.label
                span.label-text Ускорение (px/сек²)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.ACCEL" step="10")
            .form-control
              label.label
                span.label-text Торможение (px/сек²)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.DECEL" step="10")
            .form-control
              label.label
                span.label-text Время реакции (сек)
              input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.REACTION_TIME")
            .form-control
              label.label
                span.label-text Буфер (px)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.MIN_BUFFER")
            .form-control
              label.label
                span.label-text Дальность (px)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.MAX_LOOKAHEAD")
            .form-control
              label.label
                span.label-text Время до отката (сек)
              input.input.input-xs.input-bordered(type="number" step="0.5" v-model.number="simSettings.DEADLOCK_TIME")
            .form-control
              label.label
                span.label-text Время реверса (сек)
              input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.REVERSE_TIME")
            .form-control
              label.label
                span.label-text Скорость реверса (px/сек)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.REVERSE_SPEED")
            .form-control
              label.label
                span.label-text Смещение спрайта (рад)
              input.input.input-xs.input-bordered(type="number" step="0.1" v-model.number="simSettings.SPRITE_ORIENTATION_OFFSET")
              span.label-text-alt.text-xs.mt-1 (0=вправо, 1.57=вниз)
            .form-control
              label.label
                span.label-text Порог прибытия (px)
              input.input.input-xs.input-bordered(type="number" v-model.number="simSettings.ARRIVE_THRESHOLD" step="0.5")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

const configStore = useConfig()
const simSettings = computed(() => configStore.config.value.simulator)
</script>