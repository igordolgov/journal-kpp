<!-- app/pages/generator.vue -->
<!-- Назначение: конструктор тестовых данных КПП (семьи, люди, транспорт). -->
<template lang='pug'>
.container.mx-auto.p-4
  h1.text-2xl.font-bold.mb-6 Конструктор данных КПП

  .grid.grid-cols-1.gap-6(class="lg:grid-cols-2")

    //- Левая колонка: Настройки
    .card.bg-base-100.shadow-xl
      .card-body
        h2.card-title Настройки генерации

        .tabs.tabs-boxed.mb-4
          button.tab(
            :class="{ 'tab-active': activeTab === 'people' }"
            @click="activeTab = 'people'"
          ) Люди и Семьи
          button.tab(
            :class="{ 'tab-active': activeTab === 'vehicles' }"
            @click="activeTab = 'vehicles'"
          ) Автотранспорт

        //- --- ВКЛАДКА ЛЮДИ ---
        template(v-if="activeTab === 'people'")
          .form-control
            label.label
              span.label-text Количество семей
            input.input.input-bordered(type="number" v-model="settings.families.count" min="1" max="100")

          .form-control
            label.label
              span.label-text Состав семьи (разброс)
            .flex.gap-2
              input.input.input-bordered.w-20(type="number" v-model="settings.families.minSize" min="1")
              span.self-center —
              input.input.input-bordered.w-20(type="number" v-model="settings.families.maxSize" min="1")

          .divider Связи и категории
          .flex.flex-wrap.gap-2
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox" v-model="settings.relations.parents")
              span.label-text Родители
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox" v-model="settings.relations.children")
              span.label-text Дети
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox" v-model="settings.relations.grandparents")
              span.label-text Бабушки/Дедушки

          .form-control.mt-2
            label.label
              span.label-text Вероятность "Ребенка" (малыш, нужен взрослый)
            input.range.range-primary(type="range" v-model="settings.categories.childProbability" min="0" max="100" step="5")
            .flex.justify-between.text-xs.px-2
              span 0%
              span {{ settings.categories.childProbability }}%
              span 100%

          .divider Имена и Фамилии
          .collapse.collapse-arrow.bg-base-200
            input(type="checkbox")
            .collapse-title Список популярных имен (редактируемый)
            .collapse-content
              .grid.grid-cols-2.gap-2
                div
                  label.label-text Мужские имена
                  textarea.textarea.textarea-sm.h-40.w-full(v-model="settings.names.male" placeholder="Иван\nПетр\nСидор")
                div
                  label.label-text Женские имена
                  textarea.textarea.textarea-sm.h-40.w-full(v-model="settings.names.female" placeholder="Анна\nМария\nЕлена")

          .collapse.collapse-arrow.bg-base-200.mt-2
            input(type="checkbox")
            .collapse-title Список фамилий
            .collapse-content
              textarea.textarea.textarea-sm.h-40.w-full(v-model="settings.surnames" placeholder="Иванов\nПетров\nСидоров")

        //- --- ВКЛАДКА АВТО ---
        template(v-if="activeTab === 'vehicles'")
          .form-control
            label.label
              span.label-text Количество машин
            input.input.input-bordered(type="number" v-model="settings.vehicles.count" min="0")

          .form-control
            label.label
              span.label-text Распределение
            select.select.select-bordered(v-model="settings.vehicles.assignment")
              option(value="random") Случайным взрослым
              option(value="family_heads") Главам семей
              option(value="employees") Сотрудникам (основным)

          .divider Типы и Марки
          .form-control
            label.label
              span.label-text Марки авто (через запятую)
            input.input.input-bordered(v-model="settings.vehicles.brands" placeholder="Toyota, BMW, Lada")

          .flex.flex-wrap.gap-2.mt-2
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox" checked)
              span.label-text Легковые
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox")
              span.label-text Грузовые
            label.cursor-pointer.label.gap-2
              input.checkbox(type="checkbox")
              span.label-text Служебные

        .mt-6
          button.btn.btn-primary.btn-block(@click="generateData")
            | 🚀 Сгенерировать
          button.btn.btn-outline.btn-block.mt-2(@click="importData")
            | 📥 Загрузить в БД

    //- Правая колонка: Результат
    .card.bg-base-100.shadow-xl
      .card-body
        h2.card-title Результат (Превью)

        .tabs.tabs-boxed.mb-2(v-if="preview.people.length")
          button.tab(
            :class="{ 'tab-active': previewTab === 'people' }"
            @click="previewTab = 'people'"
          ) Люди ({{ preview.people.length }})
          button.tab(
            :class="{ 'tab-active': previewTab === 'vehicles' }"
            @click="previewTab = 'vehicles'"
          ) Авто ({{ preview.vehicles.length }})

        .overflow-y-auto(class="max-h-[60vh]")
          table.table.table-zebra.table-xs(v-if="previewTab === 'people'")
            thead
              tr
                th ФИО
                th Категория
                th Семья
            tbody
              tr(v-for="p in preview.people" :key="p.id")
                td {{ p.fio }}
                td {{ p.category }}
                td {{ p.family_id }}

          table.table.table-zebra.table-xs(v-if="previewTab === 'vehicles'")
            thead
              tr
                th Гос.номер
                th Марка
                th Владелец
            tbody
              tr(v-for="v in preview.vehicles" :key="v.id")
                td {{ v.plate }}
                td {{ v.model }}
                td {{ preview.people.find(p => p.id === v.owner_id)?.fio_short || '---' }}
</template>

<script setup lang="ts">
// app/pages/generator.vue — script
import { ref, reactive, computed } from 'vue'
import { useDatabase } from '../composables/useDatabase'
import { usePatronymic } from '../composables/usePatronymic'
import { useConfirm } from '../composables/useConfirm'

const toast = useToast()
const { confirmDialog } = useConfirm()

// [ИСПРАВЛЕНО] добавлен updateItem; getAllItems удалён (не использовался)
const { addItems, updateItem } = useDatabase()
const { generatePatronymic } = usePatronymic()

const activeTab = ref('people')
const previewTab = ref('people')

// Настройки по умолчанию
const settings = reactive({
  families: {
    count: 5,
    minSize: 2,
    maxSize: 4
  },
  relations: {
    parents: true,
    children: true,
    grandparents: false
  },
  categories: {
    childProbability: 20
  },
  names: {
    male: 'Иван\nПетр\nАлександр\nДмитрий\nСергей\nМихаил\nНиколай\nАндрей\nВладимир\nАртём\nАлексей\nМаксим',
    female: 'Анна\nМария\nЕлена\nОльга\nНаталья\nИрина\nЕкатерина\nСветлана\nЮлия\nДарья\nАлина\nВиктория'
  },
  surnames: 'Иванов\nПетров\nСидоров\nКозлов\nНовиков\nМорозов\nВолков\nСоколов\nЛебедев\nКузнецов\nПопов\nСмирнов',
  vehicles: {
    count: 10,
    assignment: 'random',
    brands: 'Toyota Camry, BMW X5, Lada Vesta, Kia Rio, Hyundai Solaris, ГАЗель, Ford Focus, Renault Duster'
  }
})

const preview = reactive<{
  people: any[]
  vehicles: any[]
}>({
  people: [],
  vehicles: []
})

// --- ЛОГИКА ГЕНЕРАЦИИ ---

const maleNames = computed(() => settings.names.male.split('\n').map(s => s.trim()).filter(Boolean))
const femaleNames = computed(() => settings.names.female.split('\n').map(s => s.trim()).filter(Boolean))
const surnames = computed(() => settings.surnames.split('\n').map(s => s.trim()).filter(Boolean))
const brands = computed(() => settings.vehicles.brands.split(',').map(s => s.trim()).filter(Boolean))

// [ДОБАВЛЕНО] Запасные значения: справочники редактируемые и могут быть
// очищены — пустой список давал undefined, который каскадом ломал
// generatePatronymic() и срезы имён
const FALLBACKS = { surname: 'Иванов', male: 'Иван', female: 'Анна' }
const pickFrom = (list: string[], fallback: string): string =>
  list.length > 0 ? (list[Math.floor(Math.random() * list.length)] ?? fallback) : fallback

const generateData = () => {
  preview.people = []
  preview.vehicles = []

  let familyIdCounter = 1
  let personIdCounter = 1
  const generatedPeople: any[] = []

  // 1. Генерация семей
  for (let i = 0; i < settings.families.count; i++) {
    const familyId = familyIdCounter++
    const familySurname = pickFrom(surnames.value, FALLBACKS.surname)

    // Папа
    const fatherName = pickFrom(maleNames.value, FALLBACKS.male)
    const father = {
      id: personIdCounter++,
      fio: `${familySurname} ${fatherName} ${generatePatronymic(fatherName, 'male')}`,
      fio_short: `${familySurname} ${fatherName.charAt(0)}.`,
      category: 'Сотрудник', // Основной сотрудник
      location: 'Город',
      gender: 'male',
      main_family_id: null, // Глава семьи
      family_id: familyId,
      exit_category: 'adult',
      phone: generatePhone(),
      type: 'person'
    }
    generatedPeople.push(father)

    // Мама
    const motherName = pickFrom(femaleNames.value, FALLBACKS.female)
    const motherSurname = getFemaleSurname(familySurname)
    const mother = {
      id: personIdCounter++,
      fio: `${motherSurname} ${motherName} ${generatePatronymic(fatherName, 'female')}`, // Отчество от имени отца (условность генератора)
      fio_short: `${motherSurname} ${motherName.charAt(0)}.`,
      category: 'Взрослый',
      location: 'Город',
      gender: 'female',
      main_family_id: father.id, // [ИСПРАВЛЕНО] был familyId (номер семьи) —
                                 // database.vue группирует по id главы
      family_id: familyId,
      exit_category: 'adult',
      phone: generatePhone(),
      type: 'person'
    }
    generatedPeople.push(mother)

    // Дети
    const childrenCount = Math.floor(Math.random() * (settings.families.maxSize - 2 + 1)) // Оставшиеся места
    for (let c = 0; c < childrenCount; c++) {
      const isBoy = Math.random() > 0.5
      const childName = isBoy
        ? pickFrom(maleNames.value, FALLBACKS.male)
        : pickFrom(femaleNames.value, FALLBACKS.female)

      const childSurname = isBoy ? familySurname : getFemaleSurname(familySurname)
      const child = {
        id: personIdCounter++,
        fio: `${childSurname} ${childName} ${generatePatronymic(fatherName, isBoy ? 'male' : 'female')}`,
        fio_short: `${childSurname} ${childName.charAt(0)}.`,
        category: 'Ребенок',
        location: 'Город',
        gender: isBoy ? 'male' : 'female',
        main_family_id: father.id, // [ИСПРАВЛЕНО] аналогично
        family_id: familyId,
        // С вероятностью делаем "маленьким"
        exit_category: Math.random() * 100 < settings.categories.childProbability ? 'small' : 'independent',
        type: 'person'
      }
      generatedPeople.push(child)
    }
  }

  // 2. Генерация одиночек (сотрудники без семьи)
  // ... можно добавить логику ...

  preview.people = generatedPeople

  // 3. Генерация машин
  const adults = generatedPeople.filter(p => p.category !== 'Ребенок')
  const vehicleList: any[] = []
  const regions = ['77', '50', '99', '63', '02', '116']
  const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х']

  for (let v = 0; v < settings.vehicles.count; v++) {
    if (adults.length === 0) break
    const owner = adults[Math.floor(Math.random() * adults.length)]

    // Генерация номера X000XX 00
    const plate = `${letters[Math.floor(Math.random() * letters.length)]}${Math.floor(100 + Math.random() * 900)}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]} ${regions[Math.floor(Math.random() * regions.length)]}`

    vehicleList.push({
      id: v + 1,
      plate,
      model: brands.value[Math.floor(Math.random() * brands.value.length)] ?? 'Lada Vesta',
      owner_id: owner.id,
      type: 'vehicle'
    })
  }
  preview.vehicles = vehicleList
}

// --- Импорт в БД ---
// [ИСПРАВЛЕНО] Раньше сохранялись ВРЕМЕННЫЕ id (1,2,3...) — при непустой БД
// store.add падал с ConstraintError, а связи family/owner указывали в никуда.
// Теперь: пакетная вставка без id -> map временных id -> ремап связей.
// --- Импорт в БД ---
// Пакетная вставка без id -> map временных id -> ремап связей.
// [UI/UX] alert()/confirm() заменены на тосты и ConfirmDialog.
const importData = async () => {
  if (!preview.people.length && !preview.vehicles.length) {
    toast.warning('Сначала сгенерируйте данные')
    return
  }
  // [UI/UX] нативный confirm -> ConfirmDialog
  const ok = await confirmDialog({
    title: 'Загрузить данные в базу?',
    message: `Будет добавлено: людей — ${preview.people.length}, машин — ${preview.vehicles.length}. Существующие записи не изменяются.`,
    confirmLabel: 'Загрузить'
  })
  if (!ok) return

  try {
    // Фаза 1: люди пакетом, БЕЗ временных id (иначе ConstraintError на занятых ключах)
    const cleanPeople = preview.people.map(({ id, ...rest }) => ({ ...rest }))
    const newIds = await addItems('people', cleanPeople)

    // Фаза 2: map временных id -> реальных (addItems сохраняет порядок)
    const idMap = new Map<number, number>()
    preview.people.forEach((p, i) => {
      const newId = newIds[i]
      if (newId) idMap.set(p.id, newId)
    })

    // Фаза 3: восстановление связей main_family_id (id главы-персоны)
    for (const p of preview.people) {
      const realId = idMap.get(p.id)
      if (!realId) continue
      const patch: any = { id: realId }
      if (p.main_family_id != null) {
        patch.main_family_id = idMap.get(p.main_family_id) ?? null
      }
      await updateItem('people', patch)
    }

    // Фаза 4: машины с ремапом владельца
    const cleanVehicles = preview.vehicles.map(({ id, owner_id, ...rest }) => ({
      ...rest,
      owner_id: idMap.get(owner_id) ?? null
    }))
    await addItems('vehicles', cleanVehicles)

    // [UI/UX] сводка вместо alert
    toast.success(`Импортировано: людей — ${preview.people.length}, машин — ${preview.vehicles.length}`)
  } catch (e: any) {
    console.error('[generator] Import error:', e)
    toast.error('Ошибка импорта: ' + (e?.message || 'неизвестная ошибка'))
  }
}

// --- Хелперы ---

const getFemaleSurname = (maleSurname: string) => {
  // Простейшая логика: Иванов -> Иванова, Сидоров -> Сидорова
  if (maleSurname.endsWith('ов') || maleSurname.endsWith('ев') || maleSurname.endsWith('ин')) {
    return maleSurname + 'а'
  }
  if (maleSurname.endsWith('ский') || maleSurname.endsWith('цкий')) {
    return maleSurname.slice(0, -2) + 'ая'
  }
  if (maleSurname.endsWith('ий') || maleSurname.endsWith('ый')) {
    return maleSurname.slice(0, -2) + 'ая'
  }
  return maleSurname + 'а' // По умолчанию
}

const generatePhone = () => {
  const prefixes = ['906', '916', '926', '999', '977']
  return `+7 ${prefixes[Math.floor(Math.random() * prefixes.length)]} ${Math.floor(1000000 + Math.random() * 9000000)}`
}
</script>