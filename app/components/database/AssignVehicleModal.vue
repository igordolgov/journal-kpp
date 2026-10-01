<!-- app/components/database/AssignVehicleModal.vue -->
<!-- Модальное окно: Назначение транспортного средства человеку.
    Показывает список доступных авто с индикацией уже назначенных.
    [UI/UX Фаза 3]:
      1. Единый паттерн шапки (кружок-иконка + тайтл + X);
      2. [UX] ПОИСК по номеру/модели/владельцу — при 50+ авто листать невозможно;
      3. [UX] владелец в строке — видно, чьё авто (при назначении допуска
        важно: чужую машину допускать нельзя без согласования);
      4. [UX] блок «Машины этого человека» отдельно сверху — быстрый доступ;
      5. Каскад: спецсимволы — только в class="". -->
<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-md.p-0(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    //- HEADER — единый паттерн
    .flex.justify-between.items-center.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2.min-w-0
        .w-8.h-8.rounded-full.flex.items-center.justify-center.shrink-0(
          class="bg-primary/10 text-primary"
        )
          KeyRound.w-4.h-4
        div.min-w-0
          h3.text-base.font-bold.truncate
            | Назначить транспорт
          p.text-xs.font-semibold.truncate(
            class="text-base-content/70"
          )
            | {{ person?.fio }}
      button.btn.btn-ghost.btn-circle.btn-xs(
        type="button"
        @click="$emit('close')"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    //- BODY
    .p-4
      //- [UX] Поиск: номер / модель / владелец
      .form-control.relative.mb-3
        input.input.input-sm.input-bordered.w-full.pl-9(
          v-model="searchQuery"
          placeholder="Поиск: номер, модель, владелец..."
        )
        Search.absolute.pointer-events-none(
          class="top-1/2 left-3 w-4 h-4 text-base-content/40 -translate-y-1/2"
        )

      //- [UX] Быстрый блок: ТС самого человека (наверняка нужны в первую очередь)
      template(v-if="ownVehicles.length && !searchQuery")
        .text-xs.font-bold.uppercase.mb-1(
          class="text-base-content/40"
        ) Транспорт человека
        .flex.flex-col.gap-2.mb-4
          button.btn.w-full.justify-start(
            v-for="v in ownVehicles"
            :key="v.id"
            :class="isAssigned(v) ? 'btn-success' : 'btn-outline'"
            @click="$emit('assign', v)"
          )
            .flex.items-center.justify-between.w-full
              div
                .font-bold.font-mono
                  | {{ v.plate }}
                .text-xs.opacity-70
                  | {{ v.model || 'Нет модели' }}

              //- Индикатор, если уже назначен
              .badge.badge-sm.badge-ghost(
                v-if="isAssigned(v)"
              ) Допущен

      //- Общий список ТС
      .text-xs.font-bold.uppercase.mb-1(
        class="text-base-content/40"
      )
        | Все транспортные средства
      .flex.flex-col.gap-2.max-h-96.overflow-y-auto.pr-1
        button.btn.w-full.justify-start(
          v-for="v in filteredVehicles"
          :key="v.id"
          :class="isAssigned(v) ? 'btn-success' : 'btn-outline'"
          @click="$emit('assign', v)"
        )
          .flex.items-center.justify-between.w-full.min-w-0
            div.min-w-0.text-left
              .font-bold.font-mono
                | {{ v.plate }}
              .text-xs.opacity-70.truncate
                | {{ v.model || 'Нет модели' }}
                span.opacity-60(v-if="v.owner_name")
                  |  · {{ v.owner_name }}

            //- Индикатор, если уже назначен
            .badge.badge-sm.badge-ghost.shrink-0(
              v-if="isAssigned(v)"
            ) Допущен

        //- Пустой результат поиска
        .text-center.text-sm.py-4(
          v-if="filteredVehicles.length === 0"
          class="text-base-content/40"
        )
          | Ничего не найдено

    //- FOOTER — единый паттерн
    .flex.justify-end.p-3(
      class="bg-base-200/30 border-base-200 border-t"
    )
      button.btn.btn-ghost(
        type="button"
        @click="$emit('close')"
      ) Закрыть
</template>

<script setup lang="ts">
// app/components/database/AssignVehicleModal.vue — script
// [Фаза 3]: поиск по номеру/модели/владельцу; блок личных ТС; владелец
// в строке; type-only props; Lucide; паттерн шапки.
import { ref, computed, watch } from 'vue'
import { KeyRound, X, Search } from '@lucide/vue'

// --- Props ---
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
const emit = defineEmits(['close', 'assign'])

// --- State ---
const searchQuery = ref('')

// Сброс поиска при каждом открытии
watch(() => props.isOpen, (open) => {
  if (open) searchQuery.value = ''
})

// --- Computed ---

// Проверка, допущен ли человек к управлению данным ТС
const isAssigned = (vehicle: any) => {
  return vehicle.allowed_driver_ids?.includes(props.person?.id)
}

// ТС, владельцем которых человек уже является (быстрый блок)
const ownVehicles = computed(() =>
  props.vehicles?.filter(v => v.owner_id === props.person?.id) || []
)

// Общий список с фильтром по номеру/модели/владельцу
const filteredVehicles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = props.vehicles || []

  if (q) {
    list = list.filter((v: any) => {
      const plate = String(v.plate || '').toLowerCase()
      const model = String(v.model || '').toLowerCase()
      const owner = String(v.owner_name || '').toLowerCase()
      return plate.includes(q) || model.includes(q) || owner.includes(q)
    })
  }

  return list
})
</script>