<!-- app/pages/index.vue -->
<!-- Главная страница: Журнал событий. -->

<template lang="pug">
//- Основной контейнер страницы.
.dashboard-page.flex.h-full.min-h-0.gap-4(
  class="lg:flex-row"
  :style="isSimulatorOpen ? { paddingBottom: simulatorDockStyle.height } : {}"
)
  
  //- 1. БОКОВАЯ ПАНЕЛЬ (Фильтры и поиск)
  ClientOnly
    JournalSidebar.h-full.min-h-0(
      v-model:selectedItem="selectedItem"
      :people-list="peopleList"
      :vehicles-list="vehiclesList"
      :processed-journal="processedJournal"
      @action="handleSimpleAction"
      @group-action="handleGroupAction"
    )

  //- 2. ОСНОВНАЯ ОБЛАСТЬ (Таблица)
  .flex-1.min-h-0.flex.flex-col
    .card.flex-1.min-h-0.flex.flex-col.overflow-hidden.shadow-xl(
      class="bg-base-100"
    )
      .card-body.flex.flex-col.h-full.p-0
        
        //- ЗАГОЛОВОК с вкладками
        .flex-none.p-4(
          class="border-b border-base-300"
        )
          .flex.justify-between.items-center
            h3.card-title Журнал событий
            .tabs.tabs-boxed.p-1(
              class="bg-base-200"
            )
              button.tab.text-xs(
                class="tab-active bg-base-100"
                :class="displayMode === 'group' ? '' : 'bg-transparent'"
                @click="handleGroupClick"
              )
                | По дням
              button.tab.text-xs(
                class="tab-active bg-base-100"
                :class="displayMode === 'timeline' ? '' : 'bg-transparent'"
                @click="displayMode = 'timeline'"
              )
                | Лента
        
        //- Область таблицы с прокруткой
        .flex-1.min-h-0.overflow-y-auto(
          ref="scrollContainer"
        )
          ClientOnly
            JournalTable(
              :processed-journal="processedJournal"
              :visible-columns="visibleColumns"
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

//- МОДАЛЬНЫЕ ОКНА (Compact & Premium UI)

//- 1. Детальная карточка человека
dialog.modal.modal-open(
  v-if="isPersonDetailOpen"
)
  //- Уменьшена ширина и отступы
  .modal-box.max-w-lg.p-0.overflow-hidden(
    class="bg-base-100 rounded-xl shadow-2xl border border-base-200/50"
  )
    //- Header
    .flex.justify-between.items-center.p-4(
      class="bg-base-200/50 border-b border-base-200"
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
      )
        svg.h-5.w-5(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        )
          path(
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          )

    //- Body: Реальные данные
    .p-4.text-sm
      .grid.grid-cols-2.gap-x-4.gap-y-2
        //- Строка: Должность
        .flex.flex-col
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Должность
          span.font-medium {{ detailPerson.position || '—' }}
        
        //- Строка: Отдел
        .flex.flex-col
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Отдел
          span.font-medium {{ detailPerson.department || '—' }}

        //- Строка: Транспорт (Логика: Слеш если разные)
        .flex.flex-col.col-span-2.mt-2
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Транспорт
          span.font-medium.flex.items-center.gap-1
            svg.h-4.w-4(
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            )
              path(
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              )
            | {{ formatVehicleDisplay(detailPerson) }}

        //- Строка: Телефон
        .flex.flex-col.col-span-2.mt-2(
          v-if="detailPerson.phone"
        )
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Контакты
          span.font-medium.flex.items-center.gap-1
            svg.h-4.w-4(
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            )
              path(
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              )
            | {{ detailPerson.phone }}

        //- Строка: Статус
        .flex.flex-col.col-span-2.mt-2
          span.text-xs.font-medium.uppercase.tracking-wider(
            class="text-base-content/50"
          ) Статус
          .badge.mt-1(
            :class="detailPerson.isInside ? 'badge-success badge-outline' : 'badge-warning badge-outline'"
          )
            | {{ detailPerson.isInside ? 'На объекте' : 'За территорией' }}

    //- Footer
    .modal-action.p-3(
      class="bg-base-100 border-t border-base-200"
    )
      button.btn.btn-primary.btn-sm.btn-block(
        @click="isPersonDetailOpen = false"
      )
        | Закрыть

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isPersonDetailOpen = false"
  )
    button close

//- 2. Модалка Выезда/Въезда (Simple)
dialog.modal.modal-open(
  v-if="isExitModalOpen"
)
  .modal-box.max-w-xs.p-0.overflow-hidden(
    class="bg-base-100 rounded-xl shadow-2xl border border-base-200/50"
  )
    //- ИСПРАВЛЕНО: form обертывает весь контент и кнопки
    form.form-control.gap-3(
      @submit.prevent="handleSaveExit"
    )
      .p-4
        h3.text-lg.font-bold.mb-3 Фиксация выезда
        
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
              span.text-xs.font-bold Попутчики:
            button.btn.btn-xs.btn-ghost.btn-sm.py-0.h-4(
              type="button"
              @click="selectAllExitCandidates" 
            )
              | Все
          
          .flex.flex-col.gap-1.max-h-32.overflow-y-auto
            label.label.cursor-pointer.justify-between.p-2.rounded-lg(
              class="hover:bg-base-200/50 border border-transparent"
              v-for="c in exitForm.groupCandidates"
              :key="c.id"
              :class="exitForm.selectedGroupIds.includes(c.id) ? 'bg-primary/5 !border-primary/20' : 'bg-base-50'"
            )
              .flex.items-center.gap-2
                input.checkbox.checkbox-xs(
                  class="checkbox-primary"
                  type="checkbox"
                  :value="c.id"
                  v-model="exitForm.selectedGroupIds"
                )
                span.text-sm {{ c.fio }}

      .modal-action.p-3(
        class="bg-base-200/30 border-t border-base-200"
      )
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="isExitModalOpen = false"
        )
          | Отмена
        button.btn.btn-primary.btn-sm(
          type="submit"
        )
          | Подтвердить

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isExitModalOpen = false"
  )
    button close

//- 3. Модалка Возврата
dialog.modal.modal-open(
  v-if="isReturnModalOpen"
)
  .modal-box.max-w-md.p-0.overflow-hidden(
    class="bg-base-100 rounded-xl shadow-2xl border border-base-200/50"
  )
    //- Header
    .relative.p-4(
      class="bg-gradient-to-br from-primary/5 to-secondary/5 border-b border-base-200"
    )
      button.absolute.top-3.right-3.btn.btn-ghost.btn-circle.btn-xs(
        @click="isReturnModalOpen = false"
      )
        svg.h-4.w-4(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        )
          path(
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
      )
      
      h3.text-lg.font-bold.text-base-content Возврат
      p.text-lg(
        class="text-base-content/60"
      ) {{ returnForm.person_fio }}

    //- Body
    .px-4.space-y-1
      //- Секция: Транспорт
      div
        label.label.py-1.px-0.justify-start.gap-2
          span.text-xs.font-bold Транспорт:
        
        .flex.flex-wrap.gap-2.mt-1
          //- Кнопки реального транспорта (отфильтрованного)
          button.flex.items-center.p-2.rounded-lg(
            class="gap-1.5 border transition-all duration-200"
            v-for="v in availableVehicles"
            :key="v.id"
            :class="returnForm.vehicle_in === v.plate ? 'border-primary bg-primary/10 shadow-sm' : 'border-base-300 hover:border-base-400 bg-base-50'"
            @click="returnForm.vehicle_in = v.plate"
          )
            span.text-base 🚗
            span.font-mono.text-xs.font-bold(
              :class="returnForm.vehicle_in === v.plate ? 'text-primary' : 'text-base-content'"
            ) {{ v.plate }}

          //- Кнопка "Пешком" (используем новую логику)
          button.flex.items-center.p-2.rounded-lg(
            class="gap-1.5 border transition-all duration-200"
            :class="isWalkingSelected ? 'border-success bg-success/10 shadow-sm' : 'border-base-300 hover:border-base-400 bg-base-50'"
            @click="returnForm.vehicle_in = ''"
          )
            span.text-base 🚶
            span.text-xs.font-bold(
              :class="isWalkingSelected ? 'text-success' : 'text-base-content'"
            ) Пешком

      //- Секция: Попутчики
      div(
        v-if="returnForm.groupCandidates.length > 0"
      )
        .flex.justify-between.items-center.mb-1
          label.label.py-1.px-0
            span.text-xs.font-bold Попутчики:
          button.btn.btn-xs.btn-ghost.btn-sm.py-0.h-4(
            @click="selectAllReturnCandidates"
          )
            | Все
        
        .flex.flex-col.gap-0.max-h-48.overflow-y-auto
          label.label.cursor-pointer.justify-between.rounded-lg(
            class="p-[0.5] hover:bg-base-200/50 border border-transparent"
            v-for="c in returnForm.groupCandidates"
            :key="c.id"
            :class="returnForm.selectedGroupIds.includes(c.id) ? 'bg-primary/5 !border-primary/20' : 'bg-base-50'"
          )
            .flex.items-center.gap-2
              input.checkbox.checkbox-xs(
                class="checkbox-secondary"
                type="checkbox"
                :value="c.id"
                v-model="returnForm.selectedGroupIds"
              )
              //- Подсветка детей и вывод родства
              span.text-sm(
                :class="{ 'text-warning': c.isChild }"
              ) 
                | {{ c.fio }}
                span.pl-1.opacity-70(v-if="c.relation") ({{ c.relation }})

      //- Секция: Заметка
      div
        label.label.py-1.px-0
          span.text-xs.font-bold Заметка:
        textarea.textarea.textarea-bordered.w-full.h-14.text-sm(
          class="bg-base-50 focus:bg-base-100 transition-colors resize-none"
          v-model="returnForm.note"
          placeholder="Примечание..."
        )

    //- Footer
    .modal-action.px-3.my-3(
      class="bg-base-200/30 border-t border-base-200"
    )
      button.btn.btn-ghost.btn-sm(
        @click="isReturnModalOpen = false"
      )
        | Отмена
      button.btn.btn-success.btn-sm(
        class="shadow-md shadow-success/20"
        @click="handleSaveReturn"
      )
        svg.h-4.w-4.mr-1(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        )
          path(
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
        )
        | Зафиксировать

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isReturnModalOpen = false"
  )
    button close

//- 4. Модалка Редактирования записи
dialog.modal.modal-open(
  v-if="isEditJournalOpen"
)
  .modal-box.max-w-xs.p-0.overflow-hidden(
    class="bg-base-100 rounded-xl shadow-2xl border border-base-200/50"
  )
    .p-4
      h3.text-lg.font-bold.mb-3 Редактирование
      
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
            class="bg-base-200 border-0 text-sm h-16 resize-none"
            v-model="editForm.note"
            placeholder="Заметка"
          )

    .modal-action.p-3(
      class="bg-base-200/30 border-t border-base-200"
    )
      button.btn.btn-error.btn-sm(
        @click="handleDeleteEntry"
      )
        svg.h-4.w-4.mr-1(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        )
          path(
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        )
        | Удалить
      .flex.gap-2
        button.btn.btn-ghost.btn-sm(
          @click="isEditJournalOpen = false"
        )
          | Отмена
        button.btn.btn-primary.btn-sm(
          @click="handleSaveEdit"
        )
          | Сохранить

  form.modal-backdrop(
    class="bg-black/40 backdrop-blur-sm"
    @click="isEditJournalOpen = false"
  )
    button close
</template>

<script setup lang="ts">
// app/pages/index.vue
// Логика главной страницы.

import { onMounted, ref, computed, useState } from '#imports'

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
  availableVehicles, // Добавлено для модалки возврата
  isWalkingSelected, // Добавлено для модалки возврата
  openPersonCard, 
  openExitModal, 
  handleSaveExit, 
  openReturnModal, 
  handleSaveReturn,
  selectAllReturnCandidates,
  selectAllExitCandidates, // ИСПРАВЛЕНО: добавлена отсутствующая функция
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
    sortOrder.value *= -1
  } else {
    displayMode.value = 'group'
    sortField.value = 'date'
    sortOrder.value = -1
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