<!-- app/components/database/PersonDetailModal.vue -->
<!-- Модальное окно: Детальная карточка человека.
     [UI/UX Фаза 3]:
      1. [FIX] при открытии карточка перечитывает запись из БД (getItem) —
         раньше показывала кэш родителя: свежие position/department/статус
         появлялись только после перезагрузки страницы;
      2. [UX] футер пересобран: «Редактировать» (primary) + «Внешность» в
         основном ряду; «Родственник»/«Назначить авто» — ghost во втором;
         «Удалить» — ОТДЕЛЬНОЙ строкой снизу (деструктив не рядом с главными);
      3. [UX] смена статуса — с тостом (было молча);
      4. Lucide в кнопках; каскад: спецсимволы — только в class="". -->
<template lang="pug">
dialog.modal(
  v-if="isOpen"
  class="modal-open"
)
  .modal-box.max-w-4xl.p-0.bg-base-200
    //- HEADER: Заголовок и кнопка закрытия
    .flex.justify-between.items-center.p-6.border-b.rounded-t-2xl.bg-base-100
      div
        h3.text-2xl.font-bold
          | {{ card.fio }}
        .flex.gap-2.mt-1
          .badge.rounded-md.badge-outline
            | {{ displayCategory }}
      button.btn.btn-circle.btn-sm.btn-ghost(
        @click="$emit('close')"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    //- BODY: Основное содержимое
    .p-6

      //- ВЕРХНИЙ БЛОК: Превью аватара + Основная информация
      .flex.gap-6.mb-6.items-stretch

        // --- БЛОК АВАТАРА (Крупный план) ---
        .flex.flex-col.items-center.p-4.rounded-box.bg-base-100.shrink-0(
          style="width: 220px;"
        )
          .flex.items-start.justify-center.w-full.overflow-hidden(
            style="height: 170px; margin-top: -25px;"
          )
            template(v-if="card.skinTone")
              PersonAvatar(
                :appearance="card"
                :width="220"
                :height="440"
                view="front"
              )
            .text-gray-400.text-center(v-else)
              p.text-6xl.mb-2 🧍
              p.text-sm Аватар не настроен

        // --- ИНФОРМАЦИОННЫЕ КАРТОЧКИ ---
        .grid.grid-cols-2.gap-4.flex-1
          .p-4.rounded-box.bg-base-100
            span.text-sm.text-gray-500 Проживание
            p.text-lg.font-bold(
              :class="card.location === 'На территории' ? 'text-success' : 'text-info'"
            )
              | {{ card.location }}

            //- БЛОК: БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ СТАТУСА
            //- [UX] тост при смене (в setQuickStatus)
            .mt-3.rounded-box.bg-base-100.border.border-dashed.border-base-300
              span.text-sm.text-gray-500 Статус (исключение из симуляции)
              .flex.flex-wrap.gap-2.mt-2
                button.btn.btn-xs(
                  :class="!card.status ? 'btn-success text-white' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus(null)"
                ) Доступен
                button.btn.btn-xs(
                  :class="card.status === 'Отпуск' ? 'btn-warning' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Отпуск')"
                ) Отпуск
                button.btn.btn-xs(
                  :class="card.status === 'Командировка' ? 'btn-warning' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Командировка')"
                ) Командировка
                button.btn.btn-xs(
                  :class="card.status === 'Болен' ? 'btn-error' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Болен')"
                ) Болен

          .p-4.rounded-box.bg-base-100
            span.text-sm.text-gray-500 Телефон
            p.text-lg.font-bold
              | {{ card.phone || '—' }}
            .mt-4
              span.text-sm.text-gray-500 Должность / Отдел
              p.text-base.font-semibold(
                v-if="card.position || card.department"
              )
                | {{ [card.position, card.department].filter(Boolean).join(' · ') }}
              p.text-base(
                class="text-base-content/40"
                v-else
              ) —

      //- Блок: Владелец ТС
      div(v-if="ownedVehicles.length")
        h4.flex.items-center.gap-2.mb-3.font-bold
          span.text-xl 🔑
          | Владелец ТС ({{ ownedVehicles.length }})
        .flex.flex-wrap.gap-2
          .badge.badge-lg.p-3.gap-2.cursor-pointer.transition-transform.badge-neutral(
            v-for="v in ownedVehicles"
            :key="v.id"
            class="hover:scale-105"
            @click="$emit('edit-vehicle', v)"
          )
            span.badge.badge-xs.mr-1.rounded-sm(
              :class="getVehicleTypeBadgeClass(v.type)"
            )
              | {{ v.type || 'Личный' }}
            span.pl-2.pr-1.font-semibold.text-black.bg-neutral-400.border-2.border-gray-500.rounded-sm
              | {{ v.plate }}
            .text-xs.ml-1.opacity-60
              | ✎

      //- Блок: Допущен к управлению
      .mt-6(v-if="allowedVehicles.length")
        h4.flex.items-center.gap-2.mb-3.font-bold
          span.text-xl 🚗
          | Допущен к управлению ({{ allowedVehicles.length }})
        .flex.flex-wrap.gap-2
          .badge.badge-lg.p-3.gap-2.cursor-pointer.transition-transform.badge-outline(
            v-for="v in allowedVehicles"
            :key="v.id"
            class="hover:scale-105"
            @click="$emit('edit-vehicle', v)"
          )
            span.font-bold
              | {{ v.plate }}
            span.opacity-60
              | (Владелец: {{ v.owner_name }})

      //- Блок: Семья
      .mt-6(v-if="familyMembers.length")
        h4.flex.items-center.gap-2.mb-3.font-bold
          span.text-xl 👨‍👩‍👧‍👦
          | Семья ({{ familyMembers.length }})
        .flex.flex-wrap.gap-2
          .badge.p-2.rounded-lg.badge-lg.cursor-pointer(
            v-for="f in familyMembers"
            :key="f.id"
            :class="isChild(f) ? 'bg-yellow-400 text-yellow-950 border border-yellow-300' : 'badge-primary'"
            @click="$emit('open-person', f.id)"
          )
            | {{ f.fio }}
            span.opacity-60
              | ({{ f.relation }})

    //- FOOTER: пересобран [Фаза 3]
    //- Ряд 1: Редактировать (primary) + Внешность
    //- Ряд 2: Родственник + Назначить авто (ghost)
    //- Ряд 3: Удалить — отдельно, приглушённый деструктив
    .p-4.border-t.rounded-b-2xl.bg-base-100
      .flex.justify-end.gap-2
        button.btn.btn-primary.rounded-md(
          @click="$emit('edit', card)"
        )
          Pencil.w-4.h-4.mr-1
          | Редактировать
        button.btn.btn-warning.rounded-md(
          @click="isDesignerOpen = true"
        )
          Palette.w-4.h-4.mr-1
          | Внешность
      .flex.justify-end.gap-2.mt-2
        button.btn.btn-ghost.btn-sm.rounded-md(
          @click="showAddRelative = true"
        )
          UserPlus.w-4.h-4.mr-1
          | Родственник
        button.btn.btn-ghost.btn-sm.rounded-md(
          @click="$emit('assign')"
        )
          KeyRound.w-4.h-4.mr-1
          | Назначить авто
      button.btn.btn-ghost.btn-sm.btn-block.mt-3(
        class="hover:bg-error/10 text-error/70 hover:text-error"
        @click="$emit('delete', card.id)"
      )
        Trash2.w-4.h-4.mr-1
        | Удалить запись

  //- --- ВСПЛЫВАЮЩЕЕ ОКНО ДОБАВЛЕНИЯ РОДСТВЕННИКА ---
  dialog.modal(
    v-if="showAddRelative"
    class="modal-open"
  )
    .modal-box.max-w-md
      h3.mb-4.text-lg.font-bold
        | ➕ Добавить родственника
      p.mb-2.text-sm
        | Для: {{ card.fio }}
        span.text-gray-500
          | ({{ card.relation || 'Глава семьи' }})

      form.form-control.gap-3(
        @submit.prevent="saveNewRelative"
      )
        //- ВЫБОР РЕЖИМА
        .form-control
          label.label
            | Кто проходит?
          select.select.select-bordered(
            v-model="newRelative.mode"
            @change="onRelativeModeChange"
          )
            option(value="existing") Выбрать существующего (без семьи)
            option(value="new") Создать нового человека

        //- ЕСЛИ ВЫБРАЛИ "СОЗДАТЬ НОВОГО"
        .form-control.mt-2(v-if="newRelative.mode === 'new'")
          label.label
            | ФИО
          input.input.input-bordered(
            v-model="newRelative.fio"
            placeholder="Иванов Иван Иванович"
          )

        //- ЕСЛИ ВЫБРАЛИ "СУЩЕСТВУЮЩЕГО"
        .form-control.mt-2(v-else)
          label.label
            | Выберите из списка
          select.select.select-bordered(
            v-model="newRelative.existingId"
          )
            option(:value="null" disabled) -- Выберите человека --
            option(
              v-for="p in orphanAdults"
              :key="p.id"
              :value="p.id"
            ) {{ p.fio }}

        .form-control.mt-2
          label.label
            | Кем приходится?
          select.select.select-bordered(
            v-model="newRelative.type"
          )
            optgroup(label="Дети")
              option(value="Сын") Сын
              option(value="Дочь") Дочь
            optgroup(label="Супруги")
              option(value="Жена") Жена
              option(value="Муж") Муж
            optgroup(label="Родители")
              option(value="Отец") Отец
              option(value="Мать") Мать
            optgroup(label="Братья/Сестры")
              option(value="Брат") Брат
              option(value="Сестра") Сестра

        .modal-action.mt-4
          button.btn.btn-ghost(
            type="button"
            @click="showAddRelative = false"
          )
            | Отмена
          button.btn.btn-success(
            type="submit"
          )
            | Добавить

    form.modal-backdrop(
      @click="showAddRelative = false"
    )

  //- --- ИНТЕГРИРОВАННАЯ МОДАЛКА ДИЗАЙНЕРА ---
  DesignerModal(
    :is-open="isDesignerOpen"
    :person="card"
    @close="isDesignerOpen = false"
    @save="handleDesignerSave"
  )

</template>

<script setup lang="ts">
// app/components/database/PersonDetailModal.vue — script
// [FIX Фаза 3] card = локальная перечитанная копия: при открытии (isOpen)
// тянем свежую запись из БД (getItem) — props.person мог быть кэшем
// (старые position/department/статус показывались до F5).
import { computed, ref, reactive, watch } from 'vue'
import { useCompanions } from '~/composables/useCompanions'
import { useFamilyActions } from '~/composables/useFamilyActions'
import { useFamily } from '~/composables/useFamily'
import { useDatabase } from '~/composables/useDatabase'
import { useToast } from '~/composables/useToast'
// [UI/UX] Lucide
import { X, Pencil, Palette, UserPlus, KeyRound, Trash2, UserRound } from '@lucide/vue'

import PersonAvatar from '~/components/simulator/PersonAvatar.vue'
import DesignerModal from '~/components/designer/DesignerModal.vue'

// --- Props ---
const props = withDefaults(defineProps<{
  isOpen?: boolean
  person?: any
  vehicles?: any[]
  peopleList?: any[]
}>(), {
  isOpen: false,
  vehicles: () => [],
  peopleList: () => []
})

// --- Emits ---
const emit = defineEmits(['close', 'edit', 'delete', 'assign', 'edit-vehicle', 'update', 'open-person'])

// --- Composables ---
const { isChild } = useCompanions()
const { addRelative } = useFamilyActions()
const { getFullFamily } = useFamily()
const { updateItem, getItem } = useDatabase()
const toast = useToast()

// --- State ---
// [FIX] card — рабочий объект карточки. При открытии перезаписывается
// свежей записью из БД (watch isOpen).
const card = ref<any>({})

const showAddRelative = ref(false)
const newRelative = reactive({
  mode: 'existing' as 'existing' | 'new',
  fio: '',
  existingId: null as number | null,
  type: 'Сын'
})
const isDesignerOpen = ref(false)

// --- Перечитывание из БД при открытии ---
watch(() => props.isOpen, async (open) => {
  if (open && props.person?.id) {
    try {
      const fresh = await getItem('people', props.person.id)
      card.value = fresh || props.person
    } catch (e) {
      console.error('[PersonDetailModal] refresh error:', e)
      card.value = props.person
    }
  }
}, { immediate: true })

// --- Computed (читают card, не props.person) ---
const displayCategory = computed(() => {
  if (!card.value) return ''
  const p = card.value

  if (p.exit_category === 'escort') return 'Сопровождение'
  if (p.exit_category === 'small') return 'Ребенок'
  if (p.exit_category === 'independent') return 'Самостоятельный'
  if (p.exit_category === 'permission') return 'По разрешению'

  if (p.location && p.location.toLowerCase().includes('город')) return 'Гость'
  return 'Житель'
})

const familyMembers = computed(() => {
  if (!card.value || !props.peopleList) return []
  return getFullFamily(card.value, props.peopleList)
})

const ownedVehicles = computed(() => props.vehicles?.filter(v => v.owner_id === card.value?.id) || [])
const allowedVehicles = computed(() => props.vehicles?.filter(v => v.allowed_driver_ids?.includes(card.value?.id) && v.owner_id !== card.value?.id) || [])

// Список взрослых людей, не привязанных ни к какой семье
const orphanAdults = computed(() => {
  if (!props.peopleList) return []
  return props.peopleList.filter((p: any) => {
    if (p.main_family_id) return false // Уже в семье
    if (p.ageGroup === 'child' || p.exit_category === 'small' || p.is_child) return false // Это ребенок
    if (p.id === card.value?.id) return false // Это сам человек
    return true
  })
})

// --- Methods ---
const getVehicleTypeBadgeClass = (type: string) => {
  if (type === 'Служебный') return 'badge-warning'
  if (type === 'Грузовой') return 'badge-error'
  return 'badge-primary'
}

// --- Actions ---

// БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ СТАТУСА
// [UX] тост результата (было молча)
const setQuickStatus = async (newStatus: string | null) => {
  if (!card.value?.id) return

  const safeClone = JSON.parse(JSON.stringify(card.value, (key, value) => {
    if (typeof value === 'function') return undefined
    return value
  }))

  safeClone.status = newStatus
  await updateItem('people', safeClone)
  // [FIX] обновляем карточку локально — бейдж сменится мгновенно
  card.value = safeClone
  toast.success(newStatus ? `Статус: ${newStatus}` : 'Статус снят — доступен')
  emit('update')
}

// Очистка полей при смене режима
const onRelativeModeChange = () => {
  newRelative.fio = ''
  newRelative.existingId = null
}

// Сохранение с учетом существующих людей
const saveNewRelative = async () => {
  try {
    if (newRelative.mode === 'existing') {
      if (!newRelative.existingId) {
        toast.warning('Выберите человека из списка')
        return
      }

      const existingPerson = props.peopleList.find((p: any) => p.id === newRelative.existingId)
      if (!existingPerson) {
        toast.error('Человек не найден в базе')
        return
      }

      // Флаги для useFamilyActions: обновить существующего, а не создать с нуля
      await addRelative(card.value, newRelative.type, {
        ...existingPerson,
        _isExisting: true,
        _existingId: newRelative.existingId
      })
    } else {
      if (!newRelative.fio) {
        toast.warning('Введите ФИО')
        return
      }
      await addRelative(card.value, newRelative.type, { fio: newRelative.fio })
    }

    showAddRelative.value = false
    newRelative.fio = ''
    newRelative.existingId = null
    toast.success('Родственник добавлен')
    emit('update')
  } catch (e: any) {
    console.error('[PersonDetailModal] addRelative error:', e)
    toast.error('Ошибка: ' + (e?.message || 'не удалось добавить родственника'))
  }
}

// Сохранение данных после закрытия Дизайнера
const handleDesignerSave = async (updatedPersonData: any) => {
  try {
    const safeClone = JSON.parse(JSON.stringify(updatedPersonData, (key, value) => {
      if (typeof value === 'function') return undefined
      return value
    }))

    await updateItem('people', safeClone)
    isDesignerOpen.value = false
    // [FIX] обновляем карточку — аватар перерисуется без перечитывания
    card.value = safeClone
    toast.success('Внешность сохранена')
    emit('update')
  } catch (e: any) {
    console.error('[PersonDetailModal] Ошибка сохранения дизайнера:', e)
    toast.error('Ошибка сохранения внешности: ' + (e?.message || 'неизвестная ошибка'))
  }
}
</script>