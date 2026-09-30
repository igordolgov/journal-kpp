<!-- app/components/database/PersonFormModal.vue -->
<!-- Модальное окно: Создание/Редактирование профиля человека.
    Содержит поля ФИО, локации, категории выхода и родственных связей.
-->

<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-2xl.p-0.bg-base-200
    //- HEADER: Заголовок
    .flex.justify-between.items-center.p-6.border-b.rounded-t-2xl.bg-base-100
      h3.text-lg.font-bold
        | {{ form.id ? 'Редактировать' : 'Новый человек' }}
      button.btn.btn-circle.btn-sm.btn-ghost(
        @click="$emit('close')"
      )
        | ✕

    //- BODY: Форма
    form.p-6(
      @submit.prevent="onSave"
    )
      //- Секция: Основное
      .grid.grid-cols-2.gap-4.mb-4
        .form-control.col-span-2
          label.label
            | ФИО (полностью)
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.fio"
            required
          )

        .form-control
          label.label
            | Проживание
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.location"
          )
            option(value="На территории")
              | На территории
            option(value="В городе")
              | В городе

        .form-control
          label.label
            | Телефон
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.phone"
          )

      .grid.grid-cols-2.gap-4.mb-4
        .form-control
          label.label
            | Пол
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.gender"
          )
            option(value="male")
              | Мужской
            option(value="female")
              | Женский

        .form-control
          label.label
            | Дата рождения
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.birth_date"
            type="date"
          )

      .grid.grid-cols-2.gap-4.mb-4
        .form-control
          label.label
            | Статус (исключение из симуляции)
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.status"
          )
            option(:value="null")
              | Нет (участвует)
            option(value="Отпуск")
              | 🏖 Отпуск
            option(value="Командировка")
              | 💼 Командировка
            option(value="Болен")
              | 🤒 Болен

        .form-control
          label.label
            | Категория выхода
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.exit_category"
          )
            option(:value="null")
              | Взрослый (без ограничений)
            option(value="escort")
              | Только с сопровождающим
            option(value="small")
              | Маленький (до 14 лет)
            option(value="independent")
              | Самостоятельный (до 21:00)

      //- Секция: Родственные связи
      .divider
        | Родственные связи

      .form-control
        label.label.mb-2
          | Является родственником для
        select.select.w-full.text-lg.select-bordered.bg-base-100(
          v-model="form.main_family_id"
        )
          option(:value="null")
            | Нет (отдельная запись / Глава семьи)
          option(
            v-for="p in relatives"
            :key="p.id"
            :value="p.id"
          )
            | {{ p.fio }}

      //- Выбор типа родства (показываем только если выбран родственник)
      .flex.flex-wrap.gap-2.mt-2(
        v-if="form.main_family_id"
      )
        button.btn.btn-sm.rounded-lg.btn-outline(
          v-for="rel in relationOptions"
          :key="rel"
          type="button"
          class="border-gray-400/60"
          :class="{ 'btn-primary': form.relation === rel }"
          @click="form.relation = rel"
        )
          | {{ rel }}

      //- FOOTER: Кнопки
      .flex.justify-end.gap-2.p-4.mt-6.border-t.rounded-b-2xl.bg-base-100
        button.btn.btn-ghost(
          type="button"
          @click="$emit('close')"
        )
          | Отмена
        button.btn.btn-primary(
          type="submit"
        )
          | Сохранить
</template>

<script setup lang="ts">
// app/components/database/PersonFormModal.vue — script
// [ИСПРАВЛЕНО] type-only props (runtime Object/Array давали Object/unknown[]),
// fio_short добавлен в тип payload (вычислялся, но отсутствовал в форме),
// charAt(0) вместо индекса строки.
import { reactive, watch, computed } from 'vue'

// --- Props & Emits ---
const props = withDefaults(defineProps<{
  isOpen?: boolean
  person?: any
  allPeople?: any[]
}>(), {
  isOpen: false,
  person: null,
  allPeople: () => []
})

const emit = defineEmits(['close', 'save'])

// --- Config ---
const relationOptions = [
  'Супруг', 'Супруга', 'Сын', 'Дочь',
  'Отец', 'Мать', 'Брат', 'Сестра', 'Племянник', 'Племянница'
]

// --- State ---
const form = reactive({
  id: null as number | null,
  fio: '',
  location: 'На территории',
  phone: '',
  birth_date: '',
  exit_category: null as string | null,
  status: null as string | null, // Исключение из симуляции
  gender: 'male',
  main_family_id: null as number | null,
  relation: ''
})

// --- Watchers ---
watch(() => props.person, (newVal) => {
  if (newVal) {
    Object.assign(form, {
      id: newVal.id,
      fio: newVal.fio,
      location: newVal.location,
      phone: newVal.phone || '',
      birth_date: newVal.birth_date || '',
      exit_category: newVal.exit_category || null,
      status: newVal.status === undefined ? null : newVal.status, // undefined -> null
      gender: newVal.gender || 'male',
      main_family_id: newVal.main_family_id,
      relation: newVal.relation || ''
    })
  } else {
    Object.assign(form, {
      id: null,
      fio: '',
      location: 'На территории',
      phone: '',
      birth_date: '',
      exit_category: null,
      status: null, // Сброс статуса
      gender: 'male',
      main_family_id: null,
      relation: ''
    })
  }
}, { immediate: true })

// --- Computed ---
const relatives = computed(() => {
  if (!props.allPeople) return []
  return props.allPeople.filter(p => p.id !== form.id)
})

// --- Methods ---
const onSave = () => {
  // [ИСПРАВЛЕНО] fio_short — вычисляемое поле, отсутствовавшее в типе формы
  const payload: typeof form & { fio_short?: string } = { ...form }

  if (!payload.main_family_id) payload.relation = ''

  if (payload.fio) {
    const parts = payload.fio.trim().split(/\s+/)
    const first = parts[0]
    if (parts.length >= 2 && parts[1]) {
      // [ИСПРАВЛЕНО] charAt(0) — индекс строки даёт string | undefined
      payload.fio_short = `${first} ${parts[1].charAt(0)}.`
    } else if (first) {
      payload.fio_short = first
    }
  }

  emit('save', payload)
}
</script>