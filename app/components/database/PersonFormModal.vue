<!-- app/components/database/PersonFormModal.vue -->
<!-- Модальное окно: Создание/Редактирование профиля человека.
     Содержит поля ФИО, локации, категории выхода, родственных связей,
     ДОЛЖНОСТИ и ОТДЕЛА (раньше поля были только в карточке журнала —
     заполнить их было негде).
     [UI/UX Фаза 3]: единый паттерн модалок (кружок-иконка + тайтл + X),
     тосты валидации; типизированные props. -->
<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-2xl.p-0.overflow-hidden(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    //- Header — единый паттерн
    .flex.justify-between.items-center.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2
        .w-8.h-8.rounded-full.flex.items-center.justify-center(
          class="bg-primary/10 text-primary"
        )
          UserRound.w-4.h-4
        div
          h3.text-base.font-bold {{ form.id ? 'Редактировать' : 'Новый человек' }}
          p.text-xs(
            class="text-base-content/60"
          ) Карточка появится в журнале и симуляторе
      button.btn.btn-ghost.btn-circle.btn-sm(
        type="button"
        @click="$emit('close')"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    //- BODY: Форма
    form.p-4.space-y-4(
      @submit.prevent="onSave"
    )
      //- Секция: Основное
      .grid.grid-cols-2.gap-4
        .form-control.col-span-2
          label.label
            span.label-text ФИО (полностью)
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.fio"
            required
          )

        .form-control
          label.label
            span.label-text Проживание
            UiAppHint(
              text="«На территории» — живёт здесь. «В городе» — гость/проживает вне объекта."
              side="top"
            )
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.location"
          )
            option(value="На территории")
              | На территории
            option(value="В городе")
              | В городе

        .form-control
          label.label
            span.label-text Телефон
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.phone"
            type="tel"
          )

      //- Секция: Работа (новые поля — заполняли карточку, а не форму)
      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text Должность
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.position"
            placeholder="Сторож, слесарь..."
          )
        .form-control
          label.label
            span.label-text Отдел
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.department"
            placeholder="ОХР, АХО..."
          )

      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text Пол
          select.select.w-full.select-bordered.bg-base-100(
            v-model="form.gender"
          )
            option(value="male")
              | Мужской
            option(value="female")
              | Женский

        .form-control
          label.label
            span.label-text Дата рождения
          input.input.w-full.input-bordered.bg-base-100(
            v-model="form.birth_date"
            type="date"
          )

      .grid.grid-cols-2.gap-4
        .form-control
          label.label
            span.label-text Статус (исключение из симуляции)
            UiAppHint(
              text="Человек с статусом не участвует в автоматической симуляции трафика."
              side="top"
            )
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
            span.label-text Категория выхода
            UiAppHint(
              text="Ограничения самостоятельного выхода: «small» — только со взрослым, «independent» — до 21:00, «escort» — с сопровождающим."
              side="top"
            )
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

      //- Выбор типа родства (только если выбран родственник)
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
</template>

<script setup lang="ts">
// app/components/database/PersonFormModal.vue — script
// [Фаза 3]: добавлены поля position/department (карточка журнала их показывала,
// а заполнять было негде); единый паттерн шапки/футера; тост валидации;
// type-only props. UiAppHint на сложных полях.
import { reactive, watch, computed } from 'vue'
import { UserRound, X, Save } from '@lucide/vue'
import { useToast } from '~/composables/useToast'

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
const toast = useToast()

// --- Config ---
const relationOptions = [
  'Супруг', 'Супруга', 'Сын', 'Дочь',
  'Отец', 'Мать', 'Брат', 'Сестра', 'Племянник', 'Племянница'
]

// --- State ---
// [Фаза 3] добавлены position/department — раньше их нельзя было заполнить
const form = reactive({
  id: null as number | null,
  fio: '',
  location: 'На территории',
  phone: '',
  position: '',
  department: '',
  birth_date: '',
  exit_category: null as string | null,
  status: null as string | null,
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
      location: newVal.location || 'На территории',
      phone: newVal.phone || '',
      position: newVal.position || '',
      department: newVal.department || '',
      birth_date: newVal.birth_date || '',
      exit_category: newVal.exit_category || null,
      status: newVal.status === undefined ? null : newVal.status,
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
      position: '',
      department: '',
      birth_date: '',
      exit_category: null,
      status: null,
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
  // [UI/UX] валидация тостом (alert убраны)
  if (!form.fio.trim()) {
    toast.warning('Введите ФИО')
    return
  }

  // [FIX] spread-типизация: payload как копия формы + вычисляемый fio_short
  const payload: typeof form & { fio_short?: string } = { ...form }

  if (!payload.main_family_id) payload.relation = ''

  const parts = payload.fio.trim().split(/\s+/)
  const first = parts[0]
  if (parts.length >= 2 && parts[1]) {
    payload.fio_short = `${first} ${parts[1].charAt(0)}.`
  } else if (first) {
    payload.fio_short = first
  }

  emit('save', payload)
}
</script>