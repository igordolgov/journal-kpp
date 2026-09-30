<!-- app/components/database/AssignVehicleModal.vue -->
<!-- Модальное окно: Назначение транспортного средства человеку.
    Отображает список доступных авто с индикацией уже назначенных.
-->

<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-md
    h3.text-lg.font-bold.mb-4
      | 🚗 Выберите транспорт для {{ person?.fio }}

    //- Список ТС
    .flex.flex-col.gap-2.max-h-96.overflow-y-auto
      button.btn.w-full.justify-start(
        v-for="v in vehicles"
        :key="v.id"
        :class="isAssigned(v) ? 'btn-success' : 'btn-outline'"
        @click="$emit('assign', v)"
      )
        .flex.items-center.justify-between.w-full
          div
            .font-bold
              | {{ v.plate }}
            .text-xs.opacity-70
              | {{ v.model || 'Нет модели' }}

          //- Индикатор, если уже назначен
          .badge.badge-sm.badge-ghost(
            v-if="isAssigned(v)"
          )
            | ✓ Допущен

    .modal-action
      button.btn.btn-ghost(
        @click="$emit('close')"
      )
        | Закрыть
</template>

<script setup lang="ts">
// app/components/database/AssignVehicleModal.vue — script
// [ИСПРАВЛЕНО] type-only props: runtime-типы (Object/Array) давали
// props.person: Object — обращение props.person?.id было ошибкой.
const props = withDefaults(defineProps<{
  isOpen?: boolean
  person?: any
  vehicles?: any[]
}>(), {
  isOpen: false,
  person: null,
  vehicles: () => []
})

// --- Emits ---
defineEmits(['close', 'assign'])

// --- Methods ---
// Проверка, допущен ли человек к управлению данным ТС
const isAssigned = (vehicle: any) => {
  return vehicle.allowed_driver_ids?.includes(props.person?.id)
}
</script>