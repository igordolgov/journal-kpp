// components/GeneratorControl.vue
<template lang="pug">
.card.bg-base-200.shadow-xl.mb-6
  .card-body
    h2.card-title
      i.fas.fa-users-gear.mr-2
      | Генератор тестовых данных
    
    p.text-sm.opacity-70.mb-4.
      Создает реалистичные семьи: Глава семьи, Супруга (с фамилией мужа), Дети (с отчеством и фамилией отца).

    .form-control
      label.label.cursor-pointer.justify-start.gap-3
        input(type="checkbox" v-model="clearBeforeGenerate" class="checkbox checkbox-sm checkbox-error")
        span.label-text 
          span.font-bold.text-error Очистить базу перед созданием
          span.text-xs.block (Удалит всех текущих жителей и записи журнала)

    .card-actions.justify-end.mt-4
      button.btn.btn-primary(
        @click="handleGenerate"
        :disabled="loading"
      )
        span(v-if="loading" class="loading loading-spinner loading-xs")
        span(v-else) Создать 10 семей (30-40 чел.)
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSeeder } from '~/composables/useSeeder'
import { useConfig } from '~/composables/useConfig'

const emit = defineEmits(['generated'])
const { generatePopulation } = useSeeder()
const { config } = useConfig() // Получаем доступ к конфигу

const loading = ref(false)
const clearBeforeGenerate = ref(true) 

const handleGenerate = async () => {
  if (loading.value) return
  
  loading.value = true
  
  try {
    // Передаем количество семей из настроек (или дефолт)
    // Примечание: generatePopulation теперь сам читает настройки, но мы можем передать количество явно если хотим
    const result = await generatePopulation(config.value.seeder?.familiesCount || 10, clearBeforeGenerate.value)
    
    if (result.success) {
      alert(`Успех! Создано ${result.count} человек.`)
      emit('generated')
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