<!-- app/components/JournalTable.vue -->
<!-- Компонент: Таблица журнала событий.
    [UI/UX Фаза 2]:
      1. [FIX-планшет] кнопки действий БЫЛИ opacity-0 (только hover) — на тач-экране
        недоступны. Теперь: видны всегда (приглушены), активируются на hover;
      2. [FIX-планшет] мета-инфо: dropdown-hover -> dropdown-end (по клику/тапу);
      3. [FIX] статус-бейджи: захардкоженные bg-red-900/bg-green-800 заменены
        на семантические DaisyUI (badge-warning/badge-success/badge-ghost);
      4. [FIX-планшет] ресайз-зона 2px -> 8px (невидимая, рабочая);
      5. Унификация: applyHighlight — алиас единой highlightText;
      6. Каскад по правилам Pug: классы со спецсимволами — только внутри class="";
      7. Режимы отображения: «По дням» (groupedRows) / «Лента» (timelineRows),
        выбор через displayRows (prop displayMode). -->
<template lang="pug">
.table-container.w-full.h-full.overflow-auto.relative.flex.flex-col
  //- Панель управления
  //- [Фаза 2] Сортировка ленты — в ОДНОМ ряду с чекбоксами:
  //-  слева чекбоксы (flex-1), справа селект (flex-none)
  .flex-none.p-2.flex.justify-between.items-center.gap-3.bg-base-200.border-b.border-base-300(
    v-if="processedJournal.length > 0"
  )
    .flex.flex-wrap.items-center.gap-3.flex-1
      .form-control.my-2
        label.label.cursor-pointer.gap-2
          input.checkbox.checkbox-sm.checkbox-primary(
            type="checkbox"
            v-model="showClosed"
          )
          span.label-text Показывать закрытые

      .form-control(v-if="showClosed")
        label.label.cursor-pointer.gap-2
          input.checkbox.checkbox-sm.checkbox-secondary(
            type="checkbox"
            v-model="keepActiveOnTop"
          )
          span.label-text Активные сверху

      //- Сортировка ЛЕНТЫ — справа, в том же ряду
      .form-control.flex-none(
        v-if="displayMode === 'timeline'"
      )
        select.select.select-sm(
          class="bg-base-100"
          v-model="timelineSort"
          aria-label="Сортировка ленты"
        )
          option(
            v-for="opt in timelineSortOptions"
            :key="opt.value"
            :value="opt.value"
          ) {{ opt.label }}

  //- [№15-UX] empty state: раньше пустой журнал рендерил пустой tbody — белое полотно
  .flex-1.overflow-auto(v-if="processedJournal.length === 0")
    .flex.flex-col.items-center.justify-center.h-full.text-center.p-8
      Inbox.w-12.h-12.mb-3(class="text-base-content/25")
      p.text-base.font-semibold(class="text-base-content/60") Журнал пуст
      p.text-sm(class="text-base-content/40") Записи появятся после первой фиксации прохода — в симуляторе или вручную

  //- Таблица
  .flex-1.overflow-auto(v-else)
    table.table.table-zebra.w-full(
      :class="tableClasses"
      :style="tableFontStyle"
    )
      thead.sticky.top-0.z-10.bg-base-200
        tr
          th.relative.cursor-pointer.select-none(
            v-for="col in visibleColumns"
            :key="col.key"
            :style="{ width: columnWidths[col.key] + 'px', minWidth: columnWidths[col.key] + 'px' }"
            @click="$emit('sort', col.key)"
          )
            .flex.items-center.gap-1.pr-4
              span {{ getLabel(col.key) }}
              span.text-xs.opacity-50(
                v-if="sortField === col.key"
              )
                | {{ sortOrder === 1 ? '▲' : '▼' }}

            //- [FIX-планшет] зона ресайза 8px: невидимая, но рабочая.
            //- Классы со спецсимволами (:, /) — только внутри class=""
            .resize-handle.absolute.top-0.bottom-0(
              class="z-20 hover:bg-primary/20 w-2 cursor-col-resize"
              style="right: -4px;"
              @pointerdown.stop="$emit('resize', $event, col.key)"
            )

          th(:style="{ width: '90px', minWidth: '90px' }")
            | Действия

      tbody
        template(v-for="item in displayRows" :key="item.uniqueId")

          //- ЗАГОЛОВОК ДНЯ
          tr.bg-base-200.border-t-4.border-base-300(
            v-if="item.type === 'header'"
          )
            td.p-2.text-base-content(
              colspan="100%"
              class="bg-opacity-70"
            )
              span.heading-eyebrow {{ item.dateLabel }}

          //- ОБЫЧНАЯ ЗАПИСЬ
          tr.hover(
            v-else
            class="group"
            :class="getRowClasses(item.data)"
          )
            td.truncate(
              v-for="col in visibleColumns"
              :key="col.key"
            )
              //- КОЛОНКА: ВЫШЕЛ
              template(v-if="col.key === 'time_out'")
                template(v-if="item.data.timestamp_in && !item.data.timestamp_out")
                  button.btn.btn-xs.btn-info(
                    @click="$emit('exit', item.data)"
                    title="Зафиксировать выход"
                  ) Вышел
                template(v-else-if="item.data.timestamp_out")
                  span {{ formatTime(item.data.timestamp_out) }}

              //- КОЛОНКА: ВЕРНУЛСЯ
              template(v-else-if="col.key === 'time_in'")
                template(v-if="item.data.timestamp_out && !item.data.timestamp_in")
                  button.btn.btn-xs.btn-success(
                    @click="$emit('return', item.data)"
                    title="Зафиксировать возвращение"
                  ) Вернулся
                template(v-else-if="item.data.timestamp_in")
                  span {{ formatTime(item.data.timestamp_in) }}

              //- КОЛОНКА: ТРАНСПОРТ
              template(v-else-if="col.key === 'vehicle'")
                .flex.flex-wrap.gap-1.items-center.font-semibold(
                  v-html="formatVehicleEntry(item.data, searchQuery)"
                )

              //- КОЛОНКА: ФИО
              template(v-else-if="col.key === 'fio'")
                span.cursor-pointer(
                  :title="item.data.person_fio || 'Нет данных'"
                  @click="$emit('person', item.data.person_id)"
                  :class="{ 'text-warning': isChild(item.data) }"
                  v-html="highlightText(getShortFio(item.data.person_fio), searchQuery)"
                )

              //- КОЛОНКА: СТАТУС
              //- [FIX] семантические DaisyUI-бейджи вместо захардкоженных цветов:
              //- снаружи = warning (нужен возврат), внутри = success, история = ghost
              template(v-else-if="col.key === 'status'")
                .badge.badge-sm(
                  :class="getStatusClass(item.data)"
                ) {{ getStatusText(item.data) }}

              //- Остальные
              template(v-else)
                span {{ item.data[col.key] || '—' }}

            //- Ячейка действий
            //- [FIX-планшет] кнопки видны всегда (opacity-30), ярко на hover:
            //- тач-пользователь видит и тапает, мышь — получает подсветку
            td.p-1
              .flex.items-center.gap-1.justify-center.relative
                button.btn.btn-ghost.btn-xs.opacity-30(
                  class="hover:opacity-100! group-hover:opacity-100 hover:text-primary"
                  @click="$emit('edit', item.data)"
                  title="Редактировать запись"
                )
                  Pencil.h-4.w-4

                //- [FIX-планшет] мета-инфо по клику (было dropdown-hover —
                //- только мышь), dropdown-end — не вылезает за правый край
                .dropdown.dropdown-left.dropdown-end
                  label.btn.btn-ghost.btn-xs.opacity-30(
                    class="group-hover:opacity-100"
                    tabindex="0"
                    title="Информация о записи"
                  )
                    Info.h-4.w-4
                  .dropdown-content.z-50.p-3.shadow.bg-base-100.rounded-box.w-64(translate="no")
                    .text-xs.space-y-1
                      .flex.justify-between.gap-2
                        span.font-bold.shrink-0 Создано:
                        span.text-right {{ formatMetaDate(item.data.created_at) }}
                      .flex.justify-between.gap-2
                        span.font-bold.shrink-0 Автор:
                        span.text-right {{ getAuthorName(item.data) }}

                      template(v-if="item.data.updated_at")
                        .divider.my-1
                        .flex.justify-between.gap-2
                          span.font-bold.shrink-0 Изменено:
                          span.text-right {{ formatMetaDate(item.data.updated_at) }}
                        .flex.justify-between.gap-2
                          span.font-bold.shrink-0 Редактор:
                          span.text-right {{ item.data.updated_by || 'Не указан' }}
  //- [№15-ПЕРФ] пагинация журнала
  .flex-none.p-2.flex.justify-between.items-center.gap-3.bg-base-200.border-t.border-base-300(
    v-if="totalRows > JOURNAL_PAGE_SIZE"
  )
    span.text-xs(class="text-base-content/60") Показано {{ pageRangeStart }}–{{ pageRangeEnd }} из {{ totalRows }}
    .flex.items-center.gap-2
      button.btn.btn-xs(
        :disabled="currentPage <= 1"
        @click="currentPage--"
        aria-label="Предыдущая страница"
      )
        ChevronLeft.w-4.h-4
      span.text-xs Стр. {{ currentPage }} из {{ totalPages }}
      button.btn.btn-xs(
        :disabled="currentPage >= totalPages"
        @click="currentPage++"
        aria-label="Следующая страница"
      )
        ChevronRight.w-4.h-4
</template>

<script setup lang="ts">
// app/components/JournalTable.vue — script
// [Фаза 2, Лента] timelineSort: сортировка ленты (date/fio/vehicle) —
// независима от сортировки режима «По дням», персист в localStorage.
import { computed, ref, unref, watch } from 'vue'
import { useState } from 'nuxt/app'
import { Pencil, Info, Inbox, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useJournal } from '../composables/useJournal'
// [№15-БЕЗОПАСНОСТЬ] подсветка с экранированием HTML (ФИО/транспорт идут в v-html)
import { highlightSearchText } from '../utils/journalHighlight'

const props = withDefaults(defineProps<{
  processedJournal?: any[]
  visibleColumns?: any[]
  displayMode?: 'group' | 'timeline'
  sortField?: string
  sortOrder?: number
  tableClasses?: string
  tableFontStyle?: Record<string, any>
  columnWidths?: Record<string, any>
}>(), {
  processedJournal: () => [],
  visibleColumns: () => [],
  displayMode: 'group',
  sortField: 'date',
  sortOrder: 1,
  tableClasses: '',
  tableFontStyle: () => ({}),
  columnWidths: () => ({})
})

const emit = defineEmits(['sort', 'resize', 'person', 'edit', 'return', 'exit'])

const { formatTime } = useJournal()

const searchQuery = useState<string>('kpp-global-search', () => '')
const showClosed = ref(true)
const keepActiveOnTop = ref(true)

// ============================================================
// ЛЕНТА: сортировка (персист в localStorage)
// ============================================================
const TIMELINE_SORT_KEY = 'journal-timeline-sort'
type TimelineSort = 'date' | 'fio' | 'vehicle'

const timelineSort = ref<TimelineSort>(
  (import.meta.client && (localStorage.getItem(TIMELINE_SORT_KEY) as TimelineSort)) || 'date'
)

watch(timelineSort, (val) => {
  if (import.meta.client) localStorage.setItem(TIMELINE_SORT_KEY, val)
})

// Подписи для селекта (template)
const timelineSortOptions: { value: TimelineSort; label: string }[] = [
  { value: 'date', label: 'По дате' },
  { value: 'fio', label: 'По алфавиту' },
  { value: 'vehicle', label: 'По транспорту' },
]

// ============================================================

const getLabel = (key: string) => {
  const labels: Record<string, string> = {
    fio: 'ФИО', time_out: 'Снаружи', time_in: 'Внутри', destination: 'Куда', vehicle: 'Транспорт', status: 'Статус'
  }
  return labels[key] || key
}

const mapKeyToField = (key: string) => {
  const map: Record<string, string> = {
    fio: 'person_fio',
    time_out: 'timestamp_out',
    time_in: 'timestamp_in',
    vehicle: 'vehicle_out',
    date: 'created_at'
  }
  return map[key] || key
}

const formatGroupDate = (date: Date) => {
  const dateStr = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
  const weekdayStr = date.toLocaleDateString('ru-RU', { weekday: 'long' })
  return `${dateStr} ${weekdayStr}`
}

// Сортировка строк (режим «По дням» — сортировка по заголовкам таблицы)
const sortedRows = computed(() => {
  let list = props.processedJournal

  if (!showClosed.value) {
    list = list.filter((row: any) => !(row.timestamp_out && row.timestamp_in))
  }

  const sortFn = (a: any, b: any) => {
    const field = mapKeyToField(props.sortField)
    let valA = a[field]
    let valB = b[field]

    if (valA === null || valA === undefined) valA = ''
    if (valB === null || valB === undefined) valB = ''

    const isDateField = field === 'timestamp_out' || field === 'timestamp_in' || field === 'created_at'

    if (isDateField) {
      const timeA = valA ? new Date(valA).getTime() : 0
      const timeB = valB ? new Date(valB).getTime() : 0
      const numA = isNaN(timeA) ? 0 : timeA
      const numB = isNaN(timeB) ? 0 : timeB

      if (numA < numB) return -1 * props.sortOrder
      if (numA > numB) return 1 * props.sortOrder
      return 0
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      valA = valA.toLowerCase()
      valB = valB.toLowerCase()
      if (valA < valB) return -1 * props.sortOrder
      if (valA > valB) return 1 * props.sortOrder
      return 0
    }
    return 0
  }

  if (keepActiveOnTop.value && showClosed.value) {
    const active = [] as any[]
    const closed = [] as any[]

    list.forEach((row: any) => {
      if (row.timestamp_out && row.timestamp_in) closed.push(row)
      else active.push(row)
    })

    active.sort(sortFn)
    closed.sort(sortFn)

    return [...active, ...closed]
  }

  return [...list].sort(sortFn)
})

// Группировка строк по дням (режим «По дням»).
// ВАЖНО: timelineRows/displayRows живут на уровне компонента (ниже).
const groupedRows = computed(() => {
  const result: any[] = []
  let lastDayStr = ''
  let headerIndex = 0

  // [№15-ПЕРФ] пагинация ДО группировки: страница = 100 записей,
  // день первой записи страницы получает свой заголовок
  const startIdx = (currentPage.value - 1) * JOURNAL_PAGE_SIZE
  const pagedSource = sortedRows.value.slice(startIdx, startIdx + JOURNAL_PAGE_SIZE)

  pagedSource.forEach((row: any) => {
    const dateVal = row.timestamp_out || row.timestamp_in || row.created_at
    if (!dateVal) return

    const dateObj = new Date(dateVal)
    const dayStr = dateObj.toDateString()

    if (dayStr !== lastDayStr) {
      result.push({
        type: 'header',
        dateLabel: formatGroupDate(dateObj),
        uniqueId: `header-${headerIndex++}`
      })
      lastDayStr = dayStr
    }

    result.push({
      type: 'row',
      data: row,
      uniqueId: row.id
    })
  })

  return result
})

// ============================================================
// ЛЕНТА: три стратегии сортировки
// ============================================================
const timelineRows = computed(() => {
  // Фильтр закрытых — общий с таблицей
  let list = props.processedJournal
  if (!showClosed.value) {
    list = list.filter((row: any) => !(row.timestamp_out && row.timestamp_in))
  }

  if (timelineSort.value === 'fio') {
    // По алфавиту: русская коллация, дети («+ ...») сортируются как все —
    // по факту фамилии с плюсом; при желании можно вынести их в конец отдельной группой
    return [...list]
      .sort((a, b) => String(a.person_fio || '').localeCompare(String(b.person_fio || ''), 'ru'))
      .map(x => ({ type: 'row', data: x, uniqueId: x.id }))
  }

  if (timelineSort.value === 'vehicle') {
    // По транспорту: пешие («🚶») — в конец списка
    const rank = (r: any) => {
      const v = String(r.vehicle_out || r.vehicle_in || '🚶')
      return v.includes('🚶') ? 1 : 0
    }
    return [...list]
      .sort((a, b) => {
        const ra = rank(a) - rank(b)
        if (ra !== 0) return ra
        return String(a.vehicle_out || a.vehicle_in || '')
          .localeCompare(String(b.vehicle_out || b.vehicle_in || ''), 'ru')
      })
      .map(x => ({ type: 'row', data: x, uniqueId: x.id }))
  }

  // date (по умолчанию): по последнему событию записи, новые сверху
  const withTime = list.map((row: any) => {
    const lastEvent = row.timestamp_in || row.timestamp_out || row.created_at
    return { row, lastEvent: lastEvent ? new Date(lastEvent).getTime() : 0 }
  })
  return withTime
    .sort((a, b) => b.lastEvent - a.lastEvent)
    .map(x => ({ type: 'row', data: x.row, uniqueId: x.row.id }))
})

// Единая точка рендера для v-for: группировка или лента.
// [№15-ПЕРФ] пагинация: раньше рендерились ВСЕ записи разом — при тысячах
// строк журнал начинал лагать (каждая строка — DOM-узлы с функциями в ячейках).
const JOURNAL_PAGE_SIZE = 100
const currentPage = ref(1)

const totalRows = computed(() =>
  props.displayMode === 'timeline' ? timelineRows.value.length : sortedRows.value.length
)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / JOURNAL_PAGE_SIZE)))
const displayRows = computed(() =>
  props.displayMode === 'timeline'
    ? timelineRows.value.slice((currentPage.value - 1) * JOURNAL_PAGE_SIZE, currentPage.value * JOURNAL_PAGE_SIZE)
    : groupedRows.value
)
const pageRangeStart = computed(() => (totalRows.value === 0 ? 0 : (currentPage.value - 1) * JOURNAL_PAGE_SIZE + 1))
const pageRangeEnd = computed(() => Math.min(currentPage.value * JOURNAL_PAGE_SIZE, totalRows.value))

// Смена фильтров/сортировки — к первой странице; защита от выхода за диапазон
watch([
  () => props.displayMode, () => props.sortField, () => props.sortOrder,
  timelineSort, searchQuery, showClosed,
], () => { currentPage.value = 1 })
watch(totalPages, (tp) => { if (currentPage.value > tp) currentPage.value = tp })
// ============================================================

const getShortFio = (fio: string) => {
  if (!fio) return '—'
  let str = String(fio).trim()
  let prefix = ''

  if (str.startsWith('+')) {
    prefix = '+ '
    str = str.substring(1).trim()
  }

  const parts = str.split(/\s+/).filter(p => p.length > 0)
  const surnamePart = parts[0]
  if (!surnamePart) return '—'

  const surname = surnamePart
  let initials = ''

  if (parts.length > 1) {
    initials = parts.slice(1).map(n => n.charAt(0) ? n.charAt(0).toUpperCase() + '.' : '').join(' ')
  }

  return `${prefix}${surname} ${initials}`.trim()
}

// Подсветка поискового вхождения — единая функция
// [№15-БЕЗОПАСНОСТЬ] перенос в utils/journalHighlight: текст экранируется ДО v-html.
// Раньше <img onerror=...> из ФИО/заметок исполнялся (в database.vue экранирование было).
const highlightText = (text: string, query: any) => highlightSearchText(text, query)

const applyHighlight = (text: string, queryVal: string) => highlightText(text, queryVal)

const isChild = (entry: any) => {
  const isChildCategory = entry.person_category === 'Ребенок'
  const fioHasPlus = String(entry.person_fio || '').startsWith('+')
  const isChildFlag = entry.is_child === true || entry.is_child === 'true'
  return isChildFlag || isChildCategory || fioHasPlus
}

const getStatusClass = (entry: any) => {
  if (entry.timestamp_out && entry.timestamp_in) return 'badge-ghost'
  if (entry.timestamp_out && !entry.timestamp_in) return 'badge-warning'
  if (entry.timestamp_in && !entry.timestamp_out) return 'badge-success'
  return 'badge-ghost'
}

const getStatusText = (entry: any) => {
  if (entry.timestamp_out && entry.timestamp_in) return 'Закрыто'
  if (entry.timestamp_out && !entry.timestamp_in) return 'Снаружи'
  if (entry.timestamp_in && !entry.timestamp_out) return 'Внутри'
  return '—'
}

const formatPlateHtml = (plateStr: string, queryVal: string) => {
  if (!plateStr) return ''
  if (plateStr.includes('🚶') || !/\d/.test(plateStr)) {
    return `<span class="text-base-content/50">${applyHighlight(plateStr, queryVal)}</span>`
  }

  const parts = plateStr.split(' ')
  const region = parts.length > 1 ? (parts.pop() ?? '') : ''
  const main = parts.join(' ')

  const highlightedMain = applyHighlight(main, queryVal)
  const highlightedRegion = applyHighlight(region, queryVal)

  return `
    <span class="inline-flex items-center bg-neutral px-1 border-2 border-base-content/20 rounded-sm h-6 font-mono text-xs plate-badge">
      <span class="text-neutral-content text-lg">${highlightedMain}</span>
      <sup class="ml-0.5 font-bold text-neutral-content">${highlightedRegion}</sup>
    </span>
  `
}

const getVehicleDisplay = (entry: any) => {
  const WALK = '🚶 Пеш.'
  const hasIn = !!entry.timestamp_in
  const hasOut = !!entry.timestamp_out
  const vIn = entry.vehicle_in || WALK
  const vOut = entry.vehicle_out || WALK

  if (hasIn && !hasOut) return vIn
  if (hasOut && !hasIn) return vOut
  if (vIn === vOut) return vIn
  return `${vOut} / ${vIn}`
}

const formatVehicleEntry = (entry: any, queryRef: any) => {
  const text = getVehicleDisplay(entry)
  const q = unref(queryRef) || ''

  if (text.includes('/')) {
    const chunks = text.split('/')
    const p1 = chunks[0] ?? ''
    const p2 = chunks[1] ?? ''
    return `${formatPlateHtml(p1.trim(), q)} <span class="mx-1 text-base-content/40">/</span> ${formatPlateHtml(p2.trim(), q)}`
  }

  return formatPlateHtml(text, q)
}

const getRowClasses = (entry: any) => {
  const classes = []
  if (entry.timestamp_out && entry.timestamp_in) {
    classes.push('row-is-faded')
  }
  return classes
}

const formatMetaDate = (date: string) => {
  if (!date) return 'н/д'
  try {
    return new Date(date).toLocaleString('ru-RU')
  } catch (e) {
    return 'н/д'
  }
}

const getAuthorName = (entry: any) => {
  const author = entry.created_by || entry.author || entry.user_name ||
                entry.guard_name || entry.shift_name || entry.created_by_name ||
                entry.username
  return author || 'Нет данных'
}
</script>

<style scoped>
/* 1. Блеклость закрытых записей (история) — через токены темы */
tr.row-is-faded {
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent) !important;
}
tr.row-is-faded td {
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent) !important;
}

/* 2. Полупрозрачность бейджа номера для закрытых строк */
tr.row-is-faded :deep(.plate-badge) {
  opacity: 0.5;
}

/* 3. Стили хэндлера ресайза */
.resize-handle {
  background-clip: padding-box;
}
</style>