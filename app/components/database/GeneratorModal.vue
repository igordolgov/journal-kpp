<!-- app/components/database/GeneratorModal.vue -->
<!-- Модальное окно: Генератор тестовых данных.
    Создает случайные записи людей и автомобилей для тестирования.
-->

<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.flex.flex-col.max-w-2xl.p-0.bg-base-200(
    class="max-h-[85vh]"
  )
    //- HEADER
    .flex.justify-between.items-center.flex-none.p-4.border-b.bg-base-100
      h3.text-lg.font-bold
        | ⚡ Генератор данных
      button.btn.btn-circle.btn-sm.btn-ghost(
        @click="$emit('close')"
      )
        | ✕

    //- BODY (Scrollable)
    .flex-1.overflow-y-auto.p-4.space-y-3
      //- Основные настройки
      .grid.grid-cols-3.gap-3
        .form-control
          label.label
            span.label-text.text-xs Семей
          input.input.input-sm.input-bordered(
            type="number"
            v-model.number="settings.families.count"
            min="1"
          )
        .form-control
          label.label
            span.label-text.text-xs Макс. в семье
          input.input.input-sm.input-bordered(
            type="number"
            v-model.number="settings.families.maxSize"
            min="2"
          )
        .form-control
          label.label
            span.label-text.text-xs Автомобилей
          input.input.input-sm.input-bordered(
            type="number"
            v-model.number="settings.vehicles.count"
            min="0"
          )

      //- Справочники (свернуты или компактно)
      .collapse.collapse-arrow.border.border-base-300.bg-base-100
        input(type="checkbox")
        .collapse-title.font-medium
          | Справочники имен и марок
        .collapse-content
          .grid.grid-cols-2.gap-2.mt-2
            .form-control
              label.label-text Мужские имена
              textarea.textarea.textarea-sm.h-16.input-bordered(
                v-model="settings.names.male"
              )
            .form-control
              label.label-text Женские имена
              textarea.textarea.textarea-sm.h-16.input-bordered(
                v-model="settings.names.female"
              )
            .form-control.col-span-2
              label.label-text Фамилии
              textarea.textarea.textarea-sm.h-12.input-bordered(
                v-model="settings.surnames"
              )
            .form-control.col-span-2
              label.label-text Марки авто
              input.input.input-sm.input-bordered(
                v-model="settings.vehicles.brands"
              )

      //- Превью результата
      .divider.m-0 Результат
      .flex.justify-center.gap-4
        .badge.badge-lg.badge-outline.badge-primary
          | 👤 {{ preview.people.length }} чел.
        .badge.badge-lg.badge-outline.badge-secondary
          | 🚗 {{ preview.vehicles.length }} авто

    //- FOOTER
    .flex.justify-end.gap-2.flex-none.p-4.border-t.bg-base-100
      button.btn.btn-sm.btn-ghost(
        @click="generateData"
      )
        | 🔄 Пересоздать
      button.btn.btn-sm.btn-primary(
        :disabled="preview.people.length === 0"
        @click="importData"
      )
        | 📥 Загрузить в БД
</template>

<script setup lang="ts">
// app/components/database/GeneratorModal.vue
// Логика генерации случайных данных для тестирования БД.

import { ref, reactive, computed, watch } from 'vue'
import { useDatabase } from '~/composables/useDatabase'
import { usePatronymic } from '~/composables/usePatronymic'

// --- Props & Emits ---
const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close', 'generated'])

// --- Composables ---
const { addItem } = useDatabase()
const { generatePatronymic } = usePatronymic()

// --- State: Настройки генерации ---
const settings = reactive({
  families: { count: 5, maxSize: 4 },
  vehicles: { count: 3, brands: 'Toyota Camry, BMW X5, Lada Vesta, Kia Rio, Hyundai Solaris' },
  names: {
    male: 'Иван\nПетр\nАлександр\nСергей\nДмитрий\nАндрей',
    female: 'Анна\nМария\nЕлена\nОльга\nНаталья\nИрина'
  },
  surnames: 'Иванов\nПетров\nСидоров\nКозлов\nНовиков\nМорозов'
})

// --- State: Превью сгенерированных данных ---
const preview = reactive<{ people: any[], vehicles: any[] }>({ people: [], vehicles: [] })

// --- Computed: Массивы данных из строк настроек ---
const maleNames = computed(() => settings.names.male.split('\n').map(s => s.trim()).filter(Boolean))
const femaleNames = computed(() => settings.names.female.split('\n').map(s => s.trim()).filter(Boolean))
const surnames = computed(() => settings.surnames.split('\n').map(s => s.trim()).filter(Boolean))
const brands = computed(() => settings.vehicles.brands.split(',').map(s => s.trim()).filter(Boolean))

// --- Methods: Генерация данных ---
const generateData = () => {
  preview.people = []
  preview.vehicles = []

  let personIdCounter = 1
  const generatedPeople: any[] = []

  for (let i = 0; i < settings.families.count; i++) {
    const familySurname = surnames.value[Math.floor(Math.random() * surnames.value.length)]

    // Папа (Глава семьи)
    const fatherName = maleNames.value[Math.floor(Math.random() * maleNames.value.length)]
    const headId = personIdCounter++ // Запоминаем ID главы
    
    generatedPeople.push({
      id: headId,
      fio: `${familySurname} ${fatherName} ${generatePatronymic(fatherName, 'male')}`,
      fio_short: `${familySurname} ${fatherName[0]}.`,
      category: 'Сотрудник',
      location: 'Город',
      gender: 'male',
      main_family_id: null,
      exit_category: 'adult',
      phone: generatePhone(),
      type: 'person',
      relation: null
    })

    // Мама (Супруга)
    const motherName = femaleNames.value[Math.floor(Math.random() * femaleNames.value.length)]
    // ИСПРАВЛЕНИЕ: Отчество жены формируется от имени ЕЁ отца (случайное мужское имя), а не от мужа
    const wifeFatherName = maleNames.value[Math.floor(Math.random() * maleNames.value.length)]
    
    generatedPeople.push({
      id: personIdCounter++,
      fio: `${getFemaleSurname(familySurname)} ${motherName} ${generatePatronymic(wifeFatherName, 'female')}`,
      fio_short: `${getFemaleSurname(familySurname)} ${motherName[0]}.`,
      category: 'Член семьи',
      location: 'Город',
      gender: 'female',
      main_family_id: headId, // Привязка к реальному ID папы (headId)
      exit_category: 'adult',
      phone: generatePhone(),
      type: 'person',
      relation: 'Супруга'
    })

    // Дети
    const childrenCount = Math.floor(Math.random() * Math.max(0, settings.families.maxSize - 2))
    for (let c = 0; c < childrenCount; c++) {
      const isBoy = Math.random() > 0.5
      const childName = isBoy
        ? maleNames.value[Math.floor(Math.random() * maleNames.value.length)]
        : femaleNames.value[Math.floor(Math.random() * femaleNames.value.length)]

      generatedPeople.push({
        id: personIdCounter++,
        fio: `${isBoy ? familySurname : getFemaleSurname(familySurname)} ${childName} ${generatePatronymic(fatherName, isBoy ? 'male' : 'female')}`,
        fio_short: `${isBoy ? familySurname : getFemaleSurname(familySurname)} ${childName[0]}.`,
        category: 'Ребенок',
        location: 'Город',
        gender: isBoy ? 'male' : 'female',
        main_family_id: headId, // Привязка к реальному ID папы (headId)
        exit_category: Math.random() < 0.3 ? 'small' : 'independent',
        type: 'person',
        relation: isBoy ? 'Сын' : 'Дочь'
      })
    }
  }
  preview.people = generatedPeople

  // Генерация машин
  const adults = generatedPeople.filter(p => p.category !== 'Ребенок')
  const regions = ['77', '50', '99', '63']
  const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']

  for (let v = 0; v < settings.vehicles.count; v++) {
    if (adults.length === 0) break
    const owner = adults[Math.floor(Math.random() * adults.length)]
    const plate = `${letters[Math.floor(Math.random() * letters.length)]}${Math.floor(100 + Math.random() * 900)}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]} ${regions[Math.floor(Math.random() * regions.length)]}`

    preview.vehicles.push({
      id: v + 1,
      plate,
      model: brands.value[Math.floor(Math.random() * brands.value.length)],
      owner_id: owner.id,
      type: 'vehicle'
    })
  }
}

// --- Methods: Импорт в БД ---
const importData = async () => {
  if (preview.people.length === 0) return

  // Сохраняем людей (удаляем временный id)
  for (const p of preview.people) {
    const { id, ...personData } = p
    await addItem('people', personData)
  }

  // Сохраняем машины (удаляем временный id)
  for (const v of preview.vehicles) {
    const { id, ...vehicleData } = v
    await addItem('vehicles', vehicleData)
  }

  emit('generated')
  emit('close')
}

// --- Helpers ---
const getFemaleSurname = (maleSurname: string) => {
  if (maleSurname.endsWith('ов') || maleSurname.endsWith('ев') || maleSurname.endsWith('ин')) return maleSurname + 'а'
  if (maleSurname.endsWith('ий') || maleSurname.endsWith('ый')) return maleSurname.slice(0, -2) + 'ая'
  return maleSurname + 'а'
}

const generatePhone = () => {
  const prefixes = ['906', '916', '926', '999']
  return `+7 ${prefixes[Math.floor(Math.random() * prefixes.length)]} ${Math.floor(1000000 + Math.random() * 9000000)}`
}

// --- Lifecycle ---
// Генерируем данные при первом открытии
watch(() => props.isOpen, (val) => {
  if (val && preview.people.length === 0) generateData()
})
</script>