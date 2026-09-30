<!-- app/components/settings/SettingsGenerator.vue -->
<template lang="pug">
.card.mb-6.shadow.bg-base-100
  .card-body
    h4.card-title.mb-2
      | 🧬 Генератор тестовых данных
      span.text-sm.text-gray-500.ml-4 Настройки структуры семей и запуск генерации населения.
    .grid.gap-4.mb-2(class="grid-cols-1 md:grid-cols-4")
      //- Кол-во семей
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 🏠 Объем
        .form-control.mb-2
          label.label
            span.label-text Кол-во семей
            input.input.input-sm.input-bordered(type="number" v-model.number="seederSettings.familiesCount")
        .form-control.mb-2
          label.label
            span.label-text Мин. детей
            input.input.input-sm.input-bordered(type="number" v-model.number="seederSettings.minKids")
        .form-control
          label.label
            span.label-text Макс. детей
            input.input.input-sm.input-bordered(type="number" v-model.number="seederSettings.maxKids")
      //- Глава семьи
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 👑 Глава семьи
        .form-control.mb-2
          label.label
            span.label-text Вероятность мужчины (0-1)
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.headIsMaleChance")
        .form-control
          label.label
            span.label-text Вероятность пенсионера (0-1)
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.headIsSeniorChance")
      //- Родственники
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 👨‍👩‍👧‍👦 Родственники (0-1)
        .form-control.mb-2
          label.label
            span.label-text Супруг(а)
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.spouseChance")
        .form-control.mb-2
          label.label
            span.label-text Братья/Сестры
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.siblingChance")
        .form-control.mb-2
          label.label
            span.label-text Супруги брата/сестры
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.siblingSpouseChance")
        .form-control.mb-2
          label.label
            span.label-text Племянники
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.nephewChance")
        .form-control
          label.label
            span.label-text Родители главы
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.parentsChance")
      //- Транспорт
      .border-2.border-neutral-600.p-4.rounded-lg.bg-base-200
        h5.font-bold.mb-3 🚗 Транспорт
        .form-control.mb-2
          label.label
            span.label-text Регион (код)
            input.input.input-sm.input-bordered(type="text" maxlength="3" v-model="seederSettings.vehicleRegionCode" placeholder="77")
        .form-control.mb-2
          label.label
            span.label-text Шанс авто у взрослых
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.vehicleChanceAdult")
        .form-control
          label.label
            span.label-text Шанс авто у пенсионеров
            input.input.input-sm.input-bordered(type="number" step="0.1" min="0" max="1" v-model.number="seederSettings.vehicleChanceSenior")
    //- Блок запуска
    .alert.shadow-lg.bg-base-300
      .flex-1
        .form-control
          label.label.cursor-pointer.justify-start.gap-3
            input.checkbox.checkbox-sm.checkbox-error(type="checkbox" v-model="clearBeforeGenerate")
            span.label-text 
              span.font-bold.text-error Очистить базу перед созданием
              span.text-xs.block (Удалит всех текущих жителей и записи журнала)
      .flex-none
        button.btn.btn-primary.btn-wide(@click="handleGenerate" :disabled="loading")
          span.loading.loading-spinner.loading-xs(v-if="loading")
          span(v-else) ▶️ Создать семьи
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfig } from '~/composables/useConfig'
import { useSeeder } from '~/composables/useSeeder'

const configStore = useConfig()
const { generatePopulation } = useSeeder()
const loading = ref(false)
const clearBeforeGenerate = ref(true)

const seederSettings = computed(() => configStore.config.value.seeder)

const handleGenerate = async () => {
  if (loading.value) return
  if (clearBeforeGenerate.value) {
    if (!confirm('Внимание! Будут удалены все текущие жители и записи журнала. Продолжить?')) return
  }
  loading.value = true
  try {
    const count = seederSettings.value.familiesCount || 10
    const result = await generatePopulation(count, clearBeforeGenerate.value)
    if (result.success) {
      alert(`Успех! Создано ${result.count} человек.`)
    } else {
      alert('Ошибка генерации.')
    }
  } catch (e) {
    console.error(e)
    alert('Критическая ошибка')
  } finally {
    loading.value = false
  }
}
</script>