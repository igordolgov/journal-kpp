<!-- app/components/database/VehicleFormModal.vue -->
<!-- Модальное окно: Создание/Редактирование транспортного средства.
    [UI/UX Фаза 3]:
      1. Единый паттерн: шапка (кружок-иконка + тайтл + X), футер (Отмена/Сохранить);
      2. [FIX] поле id в форме (шаблон использует form.id для emit('delete'));
      3. [UX] владелец автоматически добавляется в допущенные водители
        при смене владельца;
      4. Валидация тостами; type-only props; Lucide. -->
<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-lg.p-0.overflow-hidden.rounded-xl(
    class="bg-base-100 shadow-2xl border border-base-200/50"
  )
    //- HEADER — единый паттерн
    .flex.items-center.justify-between.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2.min-w-0
        .w-8.h-8.rounded-full.flex.items-center.justify-center.shrink-0(
          class="bg-primary/10 text-primary"
        )
          Car.w-4.h-4
        div.min-w-0
          h3.text-base.font-bold.truncate
            | {{ form.plate || 'Новый авто' }}
          p.text-xs(
            class="text-base-content/60"
          )
            | {{ form.model || 'Модель не указана' }}
      button.btn.btn-ghost.btn-circle.btn-xs(
        type="button"
        @click="$emit('close')"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    //- BODY
    form.p-4.space-y-4(
      @submit.prevent="onSave"
    )
      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text.font-semibold Гос. номер
          input.input.w-full.input-bordered.input-md(
            v-model="form.plate"
            placeholder="А 000 АА 00"
            class="font-mono uppercase"
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
            UiAppHint(
              text="Владелец автоматически добавляется в список допущенных водителей."
              side="top"
            )
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
      .divider.mt-2
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
                :aria-label="`Убрать ${driver.fio}`"
              )
                X.w-3.h-3
        .text-sm(class="text-base-content/50" v-else)
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
            ul.menu.menu-sm.w-full.bg-base-100
              li(
                v-for="p in foundDrivers"
                :key="p.id"
              )
                a(@click="addDriver(p)")
                  UserRound.w-4.h-4.mr-1.inline
                  | {{ p.fio }}

      //- FOOTER — единый паттерн
      .flex.justify-end.gap-2.p-3(
        class="bg-base-200/30 border-base-200 border-t"
      )
        button.btn.btn-ghost(
          type="button"
          @click="$emit('close')"
        ) Отмена
        button.btn.btn-primary(
          type="submit"
        )
          Save.w-4.h-4.mr-1
          | Сохранить

    //- Деструктив — отдельно, вне формы
    .px-3.pb-3
      button.btn.btn-ghost.btn-sm.btn-block(
        type="button"
        class="hover:bg-error/10 text-error/70 hover:text-error"
        @click="$emit('delete', form.id)"
      )
        Trash2.w-4.h-4.mr-1
        | Удалить транспорт
</template>

<script setup lang="ts">
// app/components/database/VehicleFormModal.vue — script
// [Фаза 3]: авто-допуск владельца при смене; тосты валидации; Lucide; паттерн.
import { ref, computed, watch } from 'vue'
import { Car, X, Save, Trash2, UserRound } from '@lucide/vue'
import { useToast } from '~/composables/useToast'

// --- Props ---
const props = withDefaults(defineProps<{
  isOpen?: boolean
  vehicle?: any
  allPeople?: any[]
  adultPeople?: any[]
}>(), {
  isOpen: false,
  vehicle: null,
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

// Следим за прошлым owner_id — реагируем только на СМЕНУ владельца
let prevOwnerId: number | null = null

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
  prevOwnerId = form.value.owner_id
}, { immediate: true })

// [UX] владелец автоматически допускается к управлению (при смене владельца)
watch(() => form.value.owner_id, (newOwner) => {
  if (newOwner == null) return
  if (!form.value.allowed_driver_ids) return
  // прежнего владельца не отчисляем — он мог быть допущен вручную
  if (prevOwnerId === newOwner) return
  if (!form.value.allowed_driver_ids.includes(newOwner)) {
    form.value.allowed_driver_ids.push(newOwner)
  }
  prevOwnerId = newOwner
})

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

// Сохранение: валидация тостами
const onSave = () => {
  if (!form.value.plate.trim()) {
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