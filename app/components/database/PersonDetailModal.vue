<!-- app/components/database/PersonDetailModal.vue -->
<!-- Модальное окно: Детальная карточка человека.
    Отображает крупный аватар (по пояс/голова), информацию, списки ТС, семью.
    Интегрирован вызов дизайнера внешности (DesignerModal).
-->

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
          | {{ person.fio }}
        .flex.gap-2.mt-1
          .badge.rounded-md.badge-outline
            | {{ displayCategory }}
      button.btn.btn-circle.btn-sm.btn-ghost(
        @click="$emit('close')"
      )
        | ✕

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
            template(v-if="person.skinTone")
              PersonAvatar(
                :appearance="person"
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
              :class="person.location === 'На территории' ? 'text-success' : 'text-info'"
            )

              | {{ person.location }}

            //- БЛОК: БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ СТАТУСА
            .mt-3.rounded-box.bg-base-100.border.border-dashed.border-base-300
              span.text-sm.text-gray-500 Статус (исключение из симуляции)
              .flex.flex-wrap.gap-2.mt-2
                button.btn.btn-xs(
                  :class="!person.status ? 'btn-success text-white' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus(null)"
                ) ✅ Доступен
                button.btn.btn-xs(
                  :class="person.status === 'Отпуск' ? 'btn-warning' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Отпуск')"
                ) 🏖 Отпуск
                button.btn.btn-xs(
                  :class="person.status === 'Командировка' ? 'btn-warning' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Командировка')"
                ) 💼 Командировка
                button.btn.btn-xs(
                  :class="person.status === 'Болен' ? 'btn-error' : 'btn-ghost border-2 border-gray-600'"
                  @click="setQuickStatus('Болен')"
                ) 🤒 Болен

          .p-4.rounded-box.bg-base-100
            span.text-sm.text-gray-500 Телефон
            p.text-lg.font-bold
              | {{ person.phone || '-' }}

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
          .badge.p-2.rounded-lg.badge-lg(
            v-for="f in familyMembers"
            :key="f.id"
            :class="isChild(f) ? 'bg-yellow-400 text-yellow-950 border border-yellow-300' : 'badge-primary'"
          )
            | {{ f.fio }}
            span.opacity-60
              | ({{ f.relation }})

    //- FOOTER: Кнопки действий
    .flex.justify-end.gap-2.p-4.border-t.rounded-b-2xl.bg-base-100
      button.btn.btn-success.rounded-md(
        @click="showAddRelative = true"
      )
        | ➕ Родственник
      button.btn.btn-info.rounded-md(
        @click="$emit('assign')"
      )
        | 🔑 Назначить авто
      button.btn.btn-outline.btn-error.rounded-md(
        @click="$emit('delete', person.id)"
      )
        | 🗑 Удалить
      button.btn.btn-warning.rounded-md(
        @click="isDesignerOpen = true"
      )
        | 🎨 Внешность
      button.btn.btn-primary.rounded-md(
        @click="$emit('edit', person)"
      )
        | ✎ Редактировать

  //- --- ВСПЛЫВАЮЩЕЕ ОКНО ДОБАВЛЕНИЯ РОДСТВЕННИКА ---
  dialog.modal(
    v-if="showAddRelative"
    class="modal-open"
  )
    .modal-box.max-w-md
      h3.mb-4.text-lg.font-bold
        | ➕ Добавить родственника
      p.mb-2.text-sm
        | Для: {{ person.fio }}
        span.text-gray-500
          | ({{ person.relation || 'Глава семьи' }})

      form.form-control.gap-3(
        @submit.prevent="saveNewRelative"
      )
        .form-control
          label.label
            | ФИО
          input.input.input-bordered(
            v-model="newRelative.fio"
            required
          )

        .form-control
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
    :person="person"
    @close="isDesignerOpen = false"
    @save="handleDesignerSave"
  )

</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import { useCompanions } from '~/composables/useCompanions'
import { useFamilyActions } from '~/composables/useFamilyActions'
import { useFamily } from '~/composables/useFamily'
import { useDatabase } from '~/composables/useDatabase'

import PersonAvatar from '~/components/simulator/PersonAvatar.vue'
import DesignerModal from '~/components/designer/DesignerModal.vue'

// --- Props ---
const props = defineProps({
  isOpen: Boolean,
  person: Object,
  vehicles: Array,
  peopleList: {
    type: Array,
    default: () => []
  }
})

// --- Emits ---
const emit = defineEmits(['close', 'edit', 'delete', 'assign', 'edit-vehicle', 'update'])

// --- Composables ---
const { isChild } = useCompanions()
const { addRelative } = useFamilyActions()
const { getFullFamily } = useFamily()
const { updateItem } = useDatabase()

// --- State ---
const showAddRelative = ref(false)
const newRelative = reactive({ fio: '', type: 'Сын' })
const isDesignerOpen = ref(false)

// --- Computed ---
const displayCategory = computed(() => {
  if (!props.person) return ''
  const p = props.person

  if (p.exit_category === 'escort') return 'Сопровождение'
  if (p.exit_category === 'small') return 'Ребенок'
  if (p.exit_category === 'independent') return 'Самостоятельный'
  if (p.exit_category === 'permission') return 'По разрешению'

  if (p.location && p.location.toLowerCase().includes('город')) return 'Гость'
  return 'Житель'
})

const familyMembers = computed(() => {
  if (!props.person || !props.peopleList) return []
  return getFullFamily(props.person, props.peopleList)
})

const ownedVehicles = computed(() => props.vehicles?.filter(v => v.owner_id === props.person.id) || [])
const allowedVehicles = computed(() => props.vehicles?.filter(v => v.allowed_driver_ids?.includes(props.person.id) && v.owner_id !== props.person.id) || [])

// --- Methods ---
const getVehicleTypeBadgeClass = (type: string) => {
  if (type === 'Служебный') return 'badge-warning'
  if (type === 'Грузовой') return 'badge-error'
  return 'badge-primary'
}

// --- Actions ---

// БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ СТАТУСА
const setQuickStatus = async (newStatus: string | null) => {
  if (!props.person?.id) return
  
  // Ручной безопасный сериализатор: отсекает Proxy, функции и невалидные для IndexedDB типы
  const safeClone = JSON.parse(JSON.stringify(props.person, (key, value) => {
    if (typeof value === 'function') return undefined
    return value
  }))
  
  // Меняем статус у чистого объекта
  safeClone.status = newStatus
  
  // Сохраняем в базу
  await updateItem('people', safeClone)
  
  // Подаем сигнал на обновление таблицы
  emit('update')
}

const saveNewRelative = async () => {
  if (!newRelative.fio) return
  try {
    await addRelative(props.person, newRelative.type, { fio: newRelative.fio })
    showAddRelative.value = false
    newRelative.fio = ''
    emit('update')
  } catch (e: any) {
    alert('Ошибка: ' + e.message)
  }
}

// Сохранение данных после закрытия Дизайнера
const handleDesignerSave = async (updatedPersonData: any) => {
  try {
    // Тот же безопасный сериализатор
    const safeClone = JSON.parse(JSON.stringify(updatedPersonData, (key, value) => {
      if (typeof value === 'function') return undefined
      return value
    }))

    await updateItem('people', safeClone)
    isDesignerOpen.value = false
    emit('update')
  } catch (e: any) {
    console.error('[PersonDetailModal] Ошибка сохранения дизайнера:', e)
    alert('Ошибка сохранения внешности: ' + e.message)
  }
}
</script>