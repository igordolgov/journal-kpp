<!-- app/components/settings/SettingsPlaces.vue -->
<template lang="pug">
.card.mb-6.shadow.bg-base-100
  .card-body
    h4.card-title.mb-4 Популярные места назначения
    p.text-sm.text-gray-500.mb-4 Эти кнопки будут отображаться при фиксации выхода/прибытия.
    .form-control
      .join.mb-4.w-full
        input.join-item.input.input-bordered.flex-1(
          v-model="newPlace"
          placeholder="Например: Склад, Банк, Отпуск"
          @keyup.enter="addPlace"
        )
        button.join-item.btn.btn-primary(@click="addPlace") Добавить
    .divider.mt-0.mb-2 Список мест
    .flex.flex-wrap.gap-2(v-if="destinations.length")
      .badge.badge-lg.gap-2.shadow-sm.badge-primary(
        v-for="(place, index) in destinations"
        :key="index"
      )
        | {{ place }}
        button.btn.btn-ghost.btn-xs.p-0.h-auto(@click="removePlace(index)")
          svg.h-4.w-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")
    .text-gray-400(v-else) Список пуст. Добавьте часто используемые места.
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfig } from '~/composables/useConfig'

const configStore = useConfig()
const newPlace = ref('')

const destinations = computed({
  get: () => configStore.config.value.destinations || [],
  set: (val) => configStore.config.value.destinations = val
})

const addPlace = () => {
  const val = newPlace.value.trim()
  if (val && !destinations.value.includes(val)) {
    destinations.value = [...destinations.value, val]
    newPlace.value = ''
  }
}

const removePlace = (index: number) => {
  const updated = [...destinations.value]
  updated.splice(index, 1)
  destinations.value = updated
}
</script>