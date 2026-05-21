<!-- app/components/JournalTable.vue -->
<!-- Компонент: Таблица журнала событий. -->

<template lang="pug">
.table-container.w-full.h-full.overflow-auto.relative.flex.flex-col
  //- Панель управления
  .flex-none.p-2.flex.justify-between.items-center.bg-base-200.border-b.border-base-300(
    v-if="processedJournal.length > 0"
  )
    .flex.gap-3.items-center
      .form-control
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

  //- Таблица
  .flex-1.overflow-auto
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
            
            .resize-handle.absolute.top-0.bottom-0.w-2.cursor-col-resize(
              class="hover:bg-primary opacity-0 hover:opacity-100 transition-opacity z-20"
              style="right: 0;"
              @mousedown.stop="$emit('resize', $event, col.key)"
            )
          
          th(:style="{ width: '90px', minWidth: '90px' }")
            | Действия

      tbody
        template(v-for="(item, index) in groupedRows" :key="item.uniqueId")
          
          //- ЗАГОЛОВОК ДНЯ
          tr.bg-base-200.border-t-4.border-base-300(
            v-if="item.type === 'header'"
          )
            td.p-2.text-base-content(
              colspan="100%" 
              class="bg-opacity-70"
            )
              span.text-red-400 {{ item.dateLabel }}

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
                  )
                    | Вышел
                template(v-else-if="item.data.timestamp_out")
                  span {{ formatTime(item.data.timestamp_out) }}

              //- КОЛОНКА: ВЕРНУЛСЯ
              template(v-else-if="col.key === 'time_in'")
                template(v-if="item.data.timestamp_out && !item.data.timestamp_in")
                  button.btn.btn-xs.btn-success(
                    @click="$emit('return', item.data)"
                    title="Зафиксировать возвращение"
                  )
                    | Вернулся
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
              template(v-else-if="col.key === 'status'")
                .badge.badge-sm(
                  :class="getStatusClass(item.data)"
                )
                  | {{ getStatusText(item.data) }}
              
              //- Остальные
              template(v-else)
                span {{ item.data[col.key] || '—' }}

            //- Ячейка действий
            td.p-1
              .flex.items-center.gap-1.justify-center.relative
                button.btn.btn-ghost.btn-xs.text-gray-400(
                  class="hover:text-primary opacity-0 group-hover:opacity-100"
                  @click="$emit('edit', item.data)"
                  title="Редактировать запись"
                )
                  svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                    path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z")

                .dropdown.dropdown-left.dropdown-hover
                  label.btn.btn-ghost.btn-xs.text-gray-400(tabindex="0")
                    svg.h-4.w-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
                  .dropdown-content.z-50.p-3.shadow.bg-base-100.rounded-box.w-64(translate="no")
                    .text-xs.space-y-1
                      div
                        span.font-bold Создено: 
                        span {{ formatMetaDate(item.data.created_at) }}
                      div
                        span.font-bold Автор: 
                        span {{ getAuthorName(item.data) }}
                      
                      template(v-if="item.data.updated_at")
                        .divider.my-1
                        div
                          span.font-bold Изменено: 
                          span {{ formatMetaDate(item.data.updated_at) }}
                        div
                          span.font-bold Редактор: 
                          span {{ item.data.updated_by || 'Не указан' }}
</template>

<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { useState } from 'nuxt/app'
import { useJournal } from '../composables/useJournal'

const props = defineProps({
  processedJournal: { type: Array, default: () => [] },
  visibleColumns: { type: Array, default: () => [] },
  sortField: { type: String, default: 'date' },
  sortOrder: { type: Number, default: 1 },
  tableClasses: { type: String, default: '' },
  tableFontStyle: { type: Object, default: () => ({}) },
  columnWidths: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['sort', 'resize', 'person', 'edit', 'return', 'exit'])

const { formatTime } = useJournal()

const searchQuery = useState<string>('kpp-global-search', () => '')
const showClosed = ref(true)
const keepActiveOnTop = ref(true)

const getLabel = (key: string) => {
  const labels: Record<string, string> = {
    fio: 'ФИО', time_out: 'Вышел', time_in: 'Вернулся', destination: 'Куда', vehicle: 'Транспорт', status: 'Статус'
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

/**
 * Вычисляемое свойство: Сортировка.
 */
const sortedRows = computed(() => {
  let list = props.processedJournal

  if (!showClosed.value) {
    list = list.filter((row: any) => !(row.timestamp_out && row.timestamp_in))
  }

  const sortFn = (a: any, b: any) => {
    let field = mapKeyToField(props.sortField)
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

/**
 * ИСПРАВЛЕНО: Группировка строк.
 * Используем счетчик headerIndex для гарантии уникальности ключей.
 */
const groupedRows = computed(() => {
  const result: any[] = []
  let lastDayStr = ''
  let headerIndex = 0

  sortedRows.value.forEach((row: any) => {
    const dateVal = row.timestamp_out || row.timestamp_in || row.created_at
    if (!dateVal) return

    const dateObj = new Date(dateVal)
    const dayStr = dateObj.toDateString()
    
    // Вставляем заголовок ТОЛЬКО если изменилась дата
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

const getShortFio = (fio: string) => {
  if (!fio) return '—'
  let str = String(fio).trim()
  let prefix = ''

  if (str.startsWith('+')) {
    prefix = '+ '
    str = str.substring(1).trim()
  }

  const parts = str.split(/\s+/).filter(p => p.length > 0)
  if (parts.length === 0) return '—'
  
  const surname = parts[0]
  let initials = ''
  
  if (parts.length > 1) {
    initials = parts.slice(1).map(n => n[0] ? n[0].toUpperCase() + '.' : '').join(' ')
  }
  
  return `${prefix}${surname} ${initials}`.trim()
}

const highlightText = (text: string, query: any) => {
  const q = query.value || ''
  if (!q || !text) return text
  
  const searchTerm = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${searchTerm})`, 'gi')
  
  return String(text).replace(regex, '<span class="bg-yellow-200 text-black rounded px-0.5">$1</span>')
}

const isChild = (entry: any) => {
  const isChildCategory = entry.person_category === 'Ребенок'
  const fioHasPlus = String(entry.person_fio).startsWith('+')
  const isChildFlag = entry.is_child === true || entry.is_child === 'true'
  return isChildFlag || isChildCategory || fioHasPlus
}

const getStatusClass = (entry: any) => {
  if (entry.timestamp_out && entry.timestamp_in) return 'badge-ghost text-gray-400'
  if (entry.timestamp_out && !entry.timestamp_in) return 'bg-red-900 text-white'
  if (entry.timestamp_in && !entry.timestamp_out) return 'bg-green-800 text-white'
  return 'badge-ghost'
}

const getStatusText = (entry: any) => {
  if (entry.timestamp_out && entry.timestamp_in) return 'Закрыто'
  if (entry.timestamp_out && !entry.timestamp_in) return 'Снаружи'
  if (entry.timestamp_in && !entry.timestamp_out) return 'Внутри'
  return '—'
}

const applyHighlight = (text: string, queryVal: string) => {
  if (!queryVal || !text) return text
  const searchTerm = queryVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${searchTerm})`, 'gi')
  return text.replace(regex, '<span class="bg-yellow-200 text-black rounded px-0.5">$1</span>')
}

const formatPlateHtml = (plateStr: string, queryVal: string) => {
  if (!plateStr) return ''
  if (plateStr.includes('🚶') || !/\d/.test(plateStr)) {
    return `<span class="text-gray-500">${applyHighlight(plateStr, queryVal)}</span>`
  }

  const parts = plateStr.split(' ')
  const region = parts.length > 1 ? parts.pop() : ''
  const main = parts.join(' ')
  
  const highlightedMain = applyHighlight(main, queryVal)
  const highlightedRegion = applyHighlight(region, queryVal)
  
  return `
    <span class="plate-badge inline-flex items-center h-6 px-1 bg-neutral-200 border-2 border-gray-400 rounded-sm text-xs font-mono">
      <span class="text-black text-lg">${highlightedMain}</span>
      <sup class="text-black font-bold ml-0.5">${highlightedRegion}</sup>
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
    const [p1, p2] = text.split('/')
    return `${formatPlateHtml(p1.trim(), q)} <span class="mx-1 text-gray-400">/</span> ${formatPlateHtml(p2.trim(), q)}`
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
/* 1. Блеклость закрытых записей */
tr.row-is-faded {
  color: #5d6168 !important;
}
tr.row-is-faded td {
  color: #7d828b !important;
}

/* 2. Полупрозрачность бейджа номера для закрытых строк */
tr.row-is-faded :deep(.plate-badge) {
  opacity: 0.5;
}

/* 3. Фон номера авто в ячейке */
td :deep(.bg-neutral-200) {
  background-color: #bbbbbb; 
}

/* 4. Стили хэндлера ресайза */
.resize-handle {
  background-clip: padding-box;
}
</style>