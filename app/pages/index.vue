<!-- app/pages/index.vue -->
<!-- Главная страница: Журнал событий. -->

<template lang="pug">
//- Основной контейнер страницы.
.dashboard-page.flex.h-full.min-h-0.gap-4(
  class="lg:flex-row"
  :style="isSimulatorOpen ? { paddingBottom: simulatorDockStyle.height } : {}"
)

  //- 1. БОКОВАЯ ПАНЕЛЬ
  ClientOnly
    JournalSidebar.h-full.min-h-0(
      v-model:selectedItem="selectedItem"
      :people-list="peopleList"
      :vehicles-list="vehiclesList"
      :processed-journal="processedJournal"
      @action="handleSimpleAction"
      @group-action="handleGroupAction"
    )

  //- 2. ОСНОВНАЯ ОБЛАСТЬ
  .flex-1.min-h-0.flex.flex-col
    .card.flex-1.min-h-0.flex.flex-col.overflow-hidden.shadow-xl(
      class="bg-base-100"
    )
      .card-body.flex.flex-col.h-full.p-0

        //- ЗАГОЛОВОК с вкладками
        .flex-none.p-4(
          class="border-base-300 border-b"
        )
          .flex.justify-between.items-center
            div
              h3.card-title Журнал событий
              p.mt-1.text-xs(class="text-base-content/50")
                | Все въезды и выезды. Оформите поездку слева: выберите человека или автомобиль.
            .tabs.tabs-boxed.p-1(
              class="bg-base-200"
            )
              button.tab.text-xs(
                class="bg-base-100"
                :class="displayMode === 'group' ? 'tab-active' : 'bg-transparent'"
                @click="handleGroupClick"
              )
                | По дням
              button.tab.text-xs(
                class="bg-base-100"
                :class="displayMode === 'timeline' ? 'tab-active' : 'bg-transparent'"
                @click="displayMode = 'timeline'"
              )
                | Лента

        //- Область таблицы
        .flex-1.min-h-0.overflow-y-auto(
          ref="scrollContainer"
        )
          ClientOnly
            JournalTable(
              :processed-journal="processedJournal"
              :visible-columns="visibleColumns"
              :display-mode="displayMode"
              :sort-field="sortField"
              :sort-order="sortOrder"
              :table-classes="getTableClasses"
              :table-font-style="getTableFontStyle"
              :column-widths="columnWidths"
              @sort="setSort"
              @resize="startResize"
              @person="openPersonCard"
              @edit="openEditJournal"
              @return="openReturnModal"
              @exit="handleTableExit"
            )
            template(#fallback)
              .flex.justify-center.items-center.h-full
                span.loading.loading-dots.loading-lg.text-primary

//- МОДАЛЬНЫЕ ОКНА

//- 1. Детальная карточка человека
dialog.modal.modal-open(
  v-if="isPersonDetailOpen"
)
  .modal-box.max-w-lg.p-0.overflow-hidden(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    .flex.justify-between.items-center.p-4(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-3
        .avatar.placeholder
          .bg-neutral.text-neutral-content.rounded-full.w-10
            span.text-lg {{ detailPerson.fio?.charAt(0) || 'U' }}
        div
          h3.text-lg.font-bold.text-base-content {{ detailPerson.fio }}
          p.text-xs(
            class="text-base-content/60"
          ) Карточка сотрудника

      button.btn.btn-ghost.btn-circle.btn-sm(
        @click="isPersonDetailOpen = false"
        aria-label="Закрыть"
      )
        X.h-5.w-5

    .p-4.text-sm
      .grid.grid-cols-2.gap-x-4.gap-y-2
        .flex.flex-col
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Должность
          span.font-medium {{ detailPerson.position || '—' }}

        .flex.flex-col
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Отдел
          span.font-medium {{ detailPerson.department || '—' }}

        .flex.flex-col.col-span-2.mt-2
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Транспорт
          span.font-medium.flex.items-center.gap-1
            ArrowLeftRight.w-4.h-4.shrink-0(class="opacity-60")
            | {{ formatVehicleDisplay(detailPerson) }}

        .flex.flex-col.col-span-2.mt-2(
          v-if="detailPerson.phone"
        )
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Контакты
          span.font-medium.flex.items-center.gap-1
            Phone.w-4.h-4.shrink-0(class="opacity-60")
            | {{ detailPerson.phone }}

        .flex.flex-col.col-span-2.mt-2
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Статус
          .badge.mt-1(
            :class="detailPersonInside ? 'badge-success badge-outline' : 'badge-warning badge-outline'"
          )
            | {{ detailPersonInside ? 'На объекте' : 'За территорией' }}

    .modal-action.p-3(
      class="bg-base-100 border-base-200 border-t"
    )
      button.btn.btn-primary.btn-sm.btn-block(
        @click="isPersonDetailOpen = false"
      ) Закрыть

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isPersonDetailOpen = false"
  )
    button close

//- 2. Модалка Выезда
//- [UX] в шапке — КТО выезжает; дети у попутчиков помечены; кнопка защищена
//- saving-флагом от двойной фиксации
dialog.modal.modal-open(
  v-if="isExitModalOpen"
)
  .modal-box.max-w-xs.p-0.overflow-hidden(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    .flex.justify-between.items-center.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2.min-w-0
        .w-8.h-8.rounded-full.flex.items-center.justify-center.shrink-0(
          class="bg-info/10 text-info"
        )
          LogOut.w-4.h-4
        div.min-w-0
          h3.text-base.font-bold Фиксация выезда
          //- [UX] КТО выезжает — крупно, не теряется
          p.text-xs.font-semibold.truncate(
            class="text-base-content/70"
          ) {{ exitForm.person_fio }}
      button.btn.btn-ghost.btn-circle.btn-xs(
        type="button"
        @click="isExitModalOpen = false"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    form.form-control.gap-3(
      @submit.prevent="handleSaveExit"
    )
      .p-4
        .form-control
          label.label.py-1
            span.label-text.text-xs Место назначения
          input.input.input-bordered.w-full(
            class="bg-base-200 border-0 text-sm input-sm"
            v-model="exitForm.destination"
            placeholder="Куда выехал?"
          )

        //- Секция: Попутчики
        div(v-if="exitForm.groupCandidates && exitForm.groupCandidates.length > 0")
          .flex.justify-between.items-center.mb-1
            label.label.py-1.px-0
              span.text-xs.font-bold Попутчики (выйдут на этом же транспорте):
            button.btn.btn-xs.btn-ghost.py-0.h-4(
              type="button"
              @click="selectAllExitCandidates"
            ) Все

          .flex.flex-col.gap-1.max-h-32.overflow-y-auto
            label.label.cursor-pointer.justify-between.p-2.rounded-lg(
              v-for="c in exitForm.groupCandidates"
              :key="c.id"
              class="hover:bg-base-200/50 border border-transparent"
              :class="exitForm.selectedGroupIds.includes(c.id) ? 'bg-primary/5 border-primary/20!' : 'bg-base-100'"
            )
              .flex.items-center.gap-2
                input.checkbox.checkbox-xs(
                  class="checkbox-primary"
                  type="checkbox"
                  :value="c.id"
                  v-model="exitForm.selectedGroupIds"
                )
                //- [UX] дети помечены жёлтым — заметно при тапе
                span.text-sm(
                  :class="{ 'text-warning font-semibold': c.isChild }"
                )
                  | {{ c.fio }}
                  span.pl-1.text-xs(class="opacity-60" v-if="c.isChild") (ребёнок)

      .modal-action.p-3(
        class="bg-base-200/30 border-base-200 border-t"
      )
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="isExitModalOpen = false"
        ) Отмена
        button.btn.btn-primary.btn-sm(
          type="submit"
          :disabled="isSavingExit"
        )
          span.loading.loading-spinner.loading-xs(v-if="isSavingExit")
          LogOut.w-4.h-4.mr-1(v-else)
          | {{ isSavingExit ? 'Сохранение...' : 'Подтвердить' }}

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="!isSavingExit && (isExitModalOpen = false)"
  )
    button close

//- 3. Модалка Возврата
dialog.modal.modal-open(
  v-if="isReturnModalOpen"
)
  .modal-box.max-w-md.p-0.overflow-hidden(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    .flex.justify-between.items-center.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2.min-w-0
        .w-8.h-8.rounded-full.flex.items-center.justify-center.shrink-0(
          class="bg-success/10 text-success"
        )
          LogIn.w-4.h-4
        div.min-w-0
          h3.text-base.font-bold.text-base-content Возврат
          p.text-xs.font-semibold.truncate(
            class="text-base-content/70"
          ) {{ returnForm.person_fio }}
      button.btn.btn-ghost.btn-circle.btn-xs(
        type="button"
        @click="isReturnModalOpen = false"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    .px-4.py-3.space-y-1.overflow-y-auto(
      class="max-h-[55vh]"
    )
      div
        label.label.py-1.px-0.justify-start.gap-2
          span.text-xs.font-bold Транспорт:

        .flex.flex-wrap.gap-2.mt-1
          button.flex.items-center.p-2.rounded-lg(
            v-for="v in availableVehicles"
            :key="v.id"
            class="gap-1.5 border transition-all duration-200"
            :class="returnForm.vehicle_in === v.plate ? 'border-primary bg-primary/10 shadow-sm' : 'border-base-300 hover:border-base-400 bg-base-100'"
            @click="returnForm.vehicle_in = v.plate"
          )
            Car.w-4.h-4.shrink-0(class="opacity-70")
            span.font-mono.text-xs.font-bold(
              :class="returnForm.vehicle_in === v.plate ? 'text-primary' : 'text-base-content'"
            ) {{ v.plate }}

          button.flex.items-center.p-2.rounded-lg(
            class="gap-1.5 border transition-all duration-200"
            :class="isWalkingSelected ? 'border-success bg-success/10 shadow-sm' : 'border-base-300 hover:border-base-400 bg-base-100'"
            @click="returnForm.vehicle_in = ''"
          )
            Footprints.w-4.h-4.shrink-0(
              :class="isWalkingSelected ? 'text-success' : 'text-base-content/70'"
            )
            span.text-xs.font-bold(
              :class="isWalkingSelected ? 'text-success' : 'text-base-content'"
            ) Пешком

      div(
        v-if="returnForm.groupCandidates.length > 0"
      )
        .flex.justify-between.items-center.mb-1
          label.label.py-1.px-0
            span.text-xs.font-bold Попутчики:
          button.btn.btn-xs.btn-ghost.py-0.h-4(
            type="button"
            @click="selectAllReturnCandidates"
          ) Все

        .flex.flex-col.gap-1.max-h-48.overflow-y-auto
          label.label.cursor-pointer.justify-between.rounded-lg(
            v-for="c in returnForm.groupCandidates"
            :key="c.id"
            class="hover:bg-base-200/50 p-1.5 border border-transparent"
            :class="returnForm.selectedGroupIds.includes(c.id) ? 'bg-primary/5 border-primary/20!' : 'bg-base-100'"
          )
            .flex.items-center.gap-2
              input.checkbox.checkbox-xs(
                class="checkbox-secondary"
                type="checkbox"
                :value="c.id"
                v-model="returnForm.selectedGroupIds"
              )
              span.text-sm(
                :class="{ 'text-warning': c.isChild }"
              )
                | {{ c.fio }}
                span.pl-1.opacity-70(v-if="c.relation") ({{ c.relation }})

      div
        label.label.py-1.px-0
          span.text-xs.font-bold Заметка:
        textarea.textarea.textarea-bordered.w-full.h-14.text-sm(
          class="bg-base-100 focus:bg-base-100 transition-colors resize-none"
          v-model="returnForm.note"
          placeholder="Примечание..."
        )

    .modal-action.px-3.py-3(
      class="bg-base-200/30 border-base-200 border-t"
    )
      button.btn.btn-ghost.btn-sm(
        type="button"
        @click="isReturnModalOpen = false"
      ) Отмена
      button.btn.btn-success.btn-sm(
        type="button"
        class="shadow-md shadow-success/20"
        :disabled="isSavingReturn"
        @click="handleSaveReturn"
      )
        span.loading.loading-spinner.loading-xs(v-if="isSavingReturn")
        Check.w-4.h-4.mr-1(v-else)
        | {{ isSavingReturn ? 'Сохранение...' : 'Зафиксировать' }}

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="!isSavingReturn && (isReturnModalOpen = false)"
  )
    button close

//- 4. Модалка Редактирования записи
//- [UX] «Удалить» отделён от «Отмена/Сохранить» (деструктив не рядом)
dialog.modal.modal-open(
  v-if="isEditJournalOpen"
)
  .modal-box.max-w-xs.p-0.overflow-hidden(
    class="bg-base-100 shadow-2xl border border-base-200/50 rounded-xl"
  )
    .flex.justify-between.items-center.p-3(
      class="bg-base-200/50 border-base-200 border-b"
    )
      .flex.items-center.gap-2
        .w-8.h-8.rounded-full.flex.items-center.justify-center(
          class="bg-warning/10 text-warning"
        )
          Pencil.w-4.h-4
        h3.text-base.font-bold Редактирование
      button.btn.btn-ghost.btn-circle.btn-xs(
        type="button"
        @click="isEditJournalOpen = false"
        aria-label="Закрыть"
      )
        X.w-4.h-4

    .p-4
      .form-control.gap-3
        .form-control
          label.label.py-1
            span.label-text.text-xs Место назначения
          input.input.input-bordered(
            class="bg-base-200 border-0 text-sm input-sm"
            v-model="editForm.destination"
            placeholder="Место назначения"
          )
        .form-control
          label.label.py-1
            span.label-text.text-xs Заметка
          textarea.textarea.textarea-bordered(
            class="bg-base-200 border-0 h-16 text-sm resize-none"
            v-model="editForm.note"
            placeholder="Заметка"
          )

    //- [UX] футер: Сохранить справа, Отмена рядом, Удалить — ОСОБОЙ строкой
    //- ниже, отделён (нельзя промахнуться с «Отмены» на «Удалить»)
    .p-3(
      class="bg-base-200/30 border-base-200 border-t"
    )
      .modal-action
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="isEditJournalOpen = false"
        ) Отмена
        button.btn.btn-primary.btn-sm(
          type="button"
          :disabled="isSavingEdit"
          @click="handleSaveEdit"
        )
          span.loading.loading-spinner.loading-xs(v-if="isSavingEdit")
          Save.w-4.h-4.mr-1(v-else)
          | {{ isSavingEdit ? 'Сохранение...' : 'Сохранить' }}

      button.btn.btn-ghost.btn-sm.btn-block.mt-2(
        type="button"
        class="hover:bg-error/10 text-error/70 hover:text-error"
        @click="handleDeleteEntry"
      )
        Trash2.w-4.h-4.mr-1
        | Удалить запись

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isEditJournalOpen = false"
  )
    button close
</template>

<script setup lang="ts">
// app/pages/index.vue — script
// Логика главной страницы (журнал).
// [MIGRATION] lucide-vue-next -> @lucide/vue
import { onMounted, ref, computed, useState } from '#imports'
// [UI/UX] Lucide: модалки журнала
import {
  X, ArrowLeftRight, Phone, Car, Footprints, Check,
  Trash2, Save, LogOut
} from '@lucide/vue'

// Компоненты
import JournalTable from '../components/JournalTable.vue'

// Composables
import { useJournal } from '../composables/useJournal'
import { useConfig } from '../composables/useConfig'
import { useJournalPage } from '../composables/useJournalPage'

definePageMeta({
  ssr: false
})

// --- Инициализация Stores ---
const {
  processedJournal,
  peopleList,
  loadData,
  sortField,
  sortOrder,
  displayMode
} = useJournal()

const {
  getVisibleColumns,
  getTableClasses,
  getTableFontStyle,
  loadConfig
} = useConfig()

const pageLogic = useJournalPage()

// --- Состояние страницы ---
const globalSearch = useState<string>('kpp-global-search', () => '')
const visibleColumns = computed(() => getVisibleColumns())

// --- Связь с Layout (Симулятор) ---
const isSimulatorOpen = useState<boolean>('simulator-is-open')
const simulatorDockStyle = ref({ height: '0px' }) // Заглушка для стиля докера

// --- Загрузка данных ---
onMounted(async () => {
  await loadConfig()
  await loadData()
  await pageLogic.loadVehicles()
})

// --- Проброс данных и методов из PageLogic ---
const {
  selectedItem,
  vehiclesList,
  isExitModalOpen,
  isReturnModalOpen,
  isEditJournalOpen,
  isPersonDetailOpen,
  exitForm,
  returnForm,
  editForm,
  columnWidths,
  detailPerson,
  suggestedVehicles,
  availableVehicles,
  isWalkingSelected,
  isSavingExit,
  isSavingReturn,
  isSavingEdit,
  openPersonCard,
  openExitModal,
  handleSaveExit,
  openReturnModal,
  handleSaveReturn,
  selectAllReturnCandidates,
  selectAllExitCandidates,
  openEditJournal,
  handleSaveEdit,
  handleDeleteEntry,
  handleSimpleAction,
  handleGroupAction,
  handleTableExit
} = pageLogic

// --- Логика отображения Транспорта ---
// Возвращает строку транспорта. Если въезд и выезд отличаются — выводит через слеш.
const formatVehicleDisplay = (person: any) => {
  if (!person) return '—'

  const vOut = person.vehicle_out // Транспорт выезда
  const vIn = person.vehicle_in   // Транспорт въезда

  // Если есть оба и они разные
  if (vOut && vIn && vOut !== vIn) {
    return `${vOut} / ${vIn}`
  }

  // Если есть оба и они одинаковые, или есть только один
  return vOut || vIn || '—'
}

// --- Статус человека в карточке ---
// [FIX] активная поездка в журнале (timestamp_out есть, timestamp_in нет)
// = снаружи; иначе — по полю location ('В городе' = снаружи).
const detailPersonInside = computed(() => {
  const p = detailPerson.value
  if (!p) return false
  const activeTrip = processedJournal.value.find((e: any) =>
    String(e.person_id) === String(p.id) && e.timestamp_out && !e.timestamp_in
  )
  if (activeTrip) return false
  return (p.location || '').trim() !== 'В городе'
})

// --- Логика сортировки ---
const setSort = (field: string) => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value * -1
  } else {
    sortField.value = field
    sortOrder.value = 1
  }
}

const handleGroupClick = () => {
  if (displayMode.value === 'group' && sortField.value === 'date') {
    sortOrder.value = sortOrder.value * -1
  } else {
    displayMode.value = 'group'
    sortField.value = 'date'
    sortOrder.value = -1 // новые дни сверху
  }
}

// --- Логика ресайза колонок ---
const scrollContainer = ref<HTMLElement | null>(null)
const resizingKey = ref<string | null>(null)
const startX = ref(0)
const startWidth = ref(0)

const startResize = (e: MouseEvent, key: string) => {
  resizingKey.value = key
  startX.value = e.pageX
  startWidth.value = columnWidths.value[key] || 100

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
}

const onResizeMove = (e: MouseEvent) => {
  if (!resizingKey.value) return
  columnWidths.value[resizingKey.value] = Math.max(50, startWidth.value + (e.pageX - startX.value))
}

const stopResize = () => {
  resizingKey.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}
</script>

<style scoped>
/* Дополнительные стили не требуются, использованы утилитарные классы */
</style>