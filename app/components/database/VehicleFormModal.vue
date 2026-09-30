<!-- app/components/database/VehicleFormModal.vue -->
<!-- Модальное окно: Создание/Редактирование транспортного средства. -->

<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-lg.p-0.overflow-hidden.rounded-lg.bg-base-200
    //- HEADER
    .flex.items-center.justify-between.p-4.bg-primary.text-white
      .flex.items-center.gap-3
        .text-5xl 🚗
        div
          h2.text-2xl.font-bold
            | {{ form.plate || 'Новый авто' }}
          p.text-sm(
            class="text-white/80"
          )
            | {{ form.model || 'Модель не указана' }}
      button.btn.btn-circle.btn-sm.btn-ghost.text-white(
        type="button"
        @click="$emit('close')"
      )
        | ✕

    //- BODY
    .p-6.pb-1.space-y-4
      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text.font-semibold Гос. номер
          input.input.w-full.input-bordered.input-md(
            v-model="form.plate"
            placeholder="А 000 АА 00"
          )
        .form-control
          label.label
            span.label-text.font-semibold Тип
          select.select.w-full.select-bordered.select-md(
            v-model="form.type"
          )
            option(value="Личный") Личный
            option(value="Служебный") Служебный
            option(value="Грузовой") Грузовой

      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text.font-semibold Марка / Модель
          input.input.w-full.input-bordered.input-md(
            v-model="form.model"
            placeholder="Toyota Camry"
          )
        .form-control
          label.label
            span.label-text.font-semibold Владелец
          select.select.w-full.select-bordered.select-md(
            v-model="form.owner_id"
          )
            option(:value="null" disabled)
              | Выберите владельца
            option(
              v-for="p in adultPeople"
              :key="p.id"
              :value="p.id"
            )
              | {{ p.fio_short || p.fio }} ({{ p.category }})

      //- Секция: Допущенные водители
      .divider.mt-6
        | Допущенные водители

      .p-3.min-h-1.transition-all.rounded-box.border-2.border-dashed.border-base-300.bg-base-200(
        :class="currentDrivers.length ? '' : 'flex items-center justify-center'"
      )
        template(v-if="currentDrivers.length")
          .flex.flex-wrap.gap-2
            .badge.badge-lg.gap-2.font-semibold.badge-primary(
              v-for="driver in currentDrivers"
              :key="driver.id"
            )
              | {{ driver.fio_short || driver.fio }}
              button.btn.btn-ghost.btn-xs.p-0.w-4.h-4(
                type="button"
                @click.prevent="removeDriver(driver.id)"
              )
                svg.h-3.w-3(
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                )
                  path(
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M6 18L18 6M6 6l12 12"
                  )
        .text-sm.text-gray-400(v-else)
          | Нет допущенных водителей

      //- Добавление водителя (Поиск)
      .form-control.relative
        label.label.mr-2
          span.label-text(
            class="opacity-70 text-xs"
          )
            | Добавить водителя
        input.input.w-full.pr-8.input-sm.input-bordered(
          v-model="driverSearch"
          placeholder="Начните вводить ФИО..."
          @input="searchDrivers"
        )
        transition(name="slide-fade")
          .absolute.left-0.right-0.top-full.mt-1.shadow.z-50.max-h-48.overflow-y-auto.rounded-box.bg-base-100(
            v-if="foundDrivers.length"
          )
            ul.menu.menu-compact.w-full.bg-base-100
              li(
                v-for="p in foundDrivers"
                :key="p.id"
              )
                a(@click="addDriver(p)")
                  | 👤 {{ p.fio }}

    //- FOOTER
    .flex.items-center.gap-2.p-4.m-2.border-t.border-base-300.bg-base-200
      button.btn.btn-sm.btn-ghost.text-error.gap-1(
        type="button"
        @click="$emit('delete', form.id)"
      )
        svg.h-4.w-4(
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        )
          path(
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          )
        | Удалить
      .flex-1
      button.btn.btn-sm.btn-ghost(
        type="button"
        @click="$emit('close')"
      )
        | Отмена
      
      button.btn.btn-sm.btn-primary(
        type="button"
        @click="onSave"
      )
        | Сохранить
</template>

<script setup lang="ts">
// app/components/database/VehicleFormModal.vue — script
// Создание/редактирование ТС: номер, тип, владелец, допущенные водители.
// [UI/UX] alert() заменены на тосты. Нативный confirm() удаления — в template
// ($emit('delete')), заменит ConfirmDialog отдельным шагом.
// [FIX] поле id в типе form — шаблон использует form.id для emit('delete').
import { ref, computed, watch } from 'vue'
import { useToast } from '~/composables/useToast'

// --- Props ---
const props = withDefaults(defineProps<{
  isOpen?: boolean
  vehicle?: any
  allPeople?: any[]
  adultPeople?: any[]
}>(), {
  isOpen: false,
  allPeople: () => [],
  adultPeople: () => []
})

// --- Emits ---
const emit = defineEmits(['close', 'save', 'delete'])

const toast = useToast()

// --- State ---
const form = ref<{ id?: number | null; plate: string; model: string; type: string; owner_id: number | null; allowed_driver_ids: number[] }>({
  plate: '',
  model: '',
  type: 'Личный',
  owner_id: null,
  allowed_driver_ids: []
})

const driverSearch = ref('')
const foundDrivers = ref<any[]>([])

// --- Watchers ---
watch(() => props.vehicle, (val) => {
  if (val) {
    form.value = { ...val }
    if (!form.value.allowed_driver_ids) form.value.allowed_driver_ids = []
  } else {
    form.value = { plate: '', model: '', type: 'Личный', owner_id: null, allowed_driver_ids: [] }
  }
}, { immediate: true })

// --- Computed ---
const currentDrivers = computed(() => {
  if (!form.value.allowed_driver_ids) return []
  return props.allPeople.filter(p => form.value.allowed_driver_ids.includes(p.id))
})

// --- Methods ---
const searchDrivers = () => {
  const q = driverSearch.value.toLowerCase()
  if (!q) { foundDrivers.value = []; return }
  foundDrivers.value = props.adultPeople.filter(p =>
    p.fio.toLowerCase().includes(q) && !form.value.allowed_driver_ids.includes(p.id)
  ).slice(0, 5)
}

const addDriver = (p: any) => {
  if (!form.value.allowed_driver_ids.includes(p.id)) {
    form.value.allowed_driver_ids.push(p.id)
  }
  driverSearch.value = ''
  foundDrivers.value = []
}

const removeDriver = (id: number) => {
  form.value.allowed_driver_ids = form.value.allowed_driver_ids.filter(d => d !== id)
}

// Сохранение: вызывается напрямую по клику.
// [UI/UX] alert() -> warning-тосты (валидация не блокирует поток).
const onSave = () => {
  if (!form.value.plate) {
    toast.warning('Введите гос. номер')
    return
  }
  if (!form.value.owner_id) {
    toast.warning('Выберите владельца')
    return
  }

  emit('save', { ...form.value })
}
</script>

<style scoped>
.slide-fade-enter-active { transition: all 0.2s ease-out; }
.slide-fade-leave-active { transition: all 0.1s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-10px); opacity: 0; }
</style>