<!-- app/components/editor/EditorSidebarLeft.vue -->
<template lang="pug">
aside(
  class="flex flex-col overflow-hidden flex-shrink-0 h-full border-r border-white/5 bg-gray-950 shadow-2xl shadow-black/50"
  :style="{ width: width + 'px' }"
)
  // Табы переключения режимов (Объекты / Пульты)
  .flex.backdrop-blur-sm.flex-shrink-0(
    class="mx-2 mt-2 p-1.5 rounded-xl bg-gray-900/80 border border-white/5"
  )
    button.flex-1(
      class="py-1.5 text-xs font-semibold rounded-lg border border-transparent transition-all duration-200 text-gray-500 hover:text-gray-300 hover:bg-white/5"
      :class="modelValue === 'scene' ? 'bg-blue-600/20 text-blue-400 shadow-sm shadow-blue-500/10 border-blue-500/20' : ''"
      @click="$emit('update:modelValue', 'scene')"
    )
      span.mr-1 📦
      span Объекты

    button.flex-1(
      class="py-1.5 text-xs font-semibold rounded-lg border border-transparent transition-all duration-200 text-gray-500 hover:text-gray-300 hover:bg-white/5"
      :class="modelValue === 'panels' ? 'bg-purple-600/20 text-purple-400 shadow-sm shadow-purple-500/10 border-purple-500/20' : ''"
      @click="$emit('update:modelValue', 'panels')"
    )
      span.mr-1 📟
      span Пульты

  .flex-1.overflow-hidden.mt-2

  // --- РЕЖИМ: СЦЕНА (ОБЪЕКТЫ) ---
  template(v-if="modelValue === 'scene'")
    .flex.flex-row.h-full
      // Колонка 1: Библиотека элементов
      .flex.flex-col.overflow-hidden.pr-1.w-full
        .flex-shrink-0(class="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-gray-600") Библиотека
        .flex-1.overflow-y-auto.scrollbar-thin(class="px-2 pb-4")
          
          // Секция "Мои персонажи" (кастомные из useCustomAssets)
          .mb-4(v-if="customPeople.length > 0")
            .mb-2.px-1(class="text-xs font-semibold text-gray-500") Мои персонажи
            .grid.grid-cols-4.w-full(class="gap-1.5")
              button.flex.flex-col.items-center.justify-center(
                class="group/person p-1.5 rounded-lg border border-blue-500/10 bg-blue-500/5 transition-all duration-200 hover:bg-blue-500/15 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 active:scale-95"
                v-for="item in customPeople" :key="item.id" @click="handleAddCustomPerson(item)"
              )
                .flex.items-center.justify-center.overflow-hidden.rounded-md.bg-gray-800.border.mb-1(class="w-9 h-9 border-white/5")
                  SimulatorPersonAvatar(:appearance="item" :width="36" :height="36" view="front")
                .w-full.text-center.truncate(class="text-xs text-blue-300/80 group-hover/person:text-blue-200") {{ item.name || 'Персонаж' }}

          // Группы библиотеки (Декор, Здания, Транспорт и т.д.)
          template(v-for="group in library" :key="group.name")
            .mb-4
              .mb-2.px-1.truncate(class="text-xs font-semibold text-gray-500") {{ group.icon }} {{ group.name }}
              .grid.grid-cols-4.w-full(class="gap-1.5")
                button.flex.flex-col.items-center.justify-center(
                  class="group/item p-1.5 rounded-lg border border-transparent transition-all duration-200 hover:bg-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20 active:scale-95"
                  v-for="item in group.items" :key="item.name" @click="$emit('add-element', item)"
                )
                  .flex.items-center.justify-center.rounded-md.bg-gray-800.border.mb-1.transition-all(
                    class="w-9 h-9 border-white/5 group-hover/item:border-white/10"
                    v-html="item.preview"
                  )
                  .w-full.text-center.truncate(class="text-xs text-gray-500 group-hover/item:text-gray-300") {{ item.name }}

      // Разделитель
      .flex-shrink-0.bg-gradient-to-b.from-transparent.via-gray-800.to-transparent(class="w-px mx-2")
      
      // Колонка 2: Слои (Список элементов на сцене)
      .flex.flex-col.overflow-hidden.flex-shrink-0(class="w-44 bg-gray-900/30")
        .flex-shrink-0.border-b(class="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-gray-600 border-white/5") Слои
        .flex-1.overflow-y-auto.scrollbar-thin(class="p-2")
          template(v-if="elements && elements.length > 0")
            // Элемент списка слоев
            .group.relative.flex.items-center.gap-2.cursor-pointer(
              class="layer-item px-3 py-2 rounded-lg border-l-2 transition-all duration-150"
              :class="selectedElementId === el.id ? 'bg-blue-500/10 text-white border-l-blue-400' : 'border-l-transparent text-gray-500 hover:bg-white/[0.03] hover:text-gray-200'"
              v-for="(el, index) in elements" :key="el.id" @click="$emit('select-element', el.id)"
            )
              // Кнопки сортировки (z-index)
              .flex.flex-col.gap-0.mr-1.flex-shrink-0
                button.flex.items-center.justify-center.round.text-xs.transition-colors(
                  class="w-4 h-4" :class="index === elements.length - 1 ? 'text-gray-700 cursor-default' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'"
                  :disabled="index === elements.length - 1" title="На передний план" @click.stop="$emit('move-element', el.id, -1)"
                ) ▲
                button.flex.items-center.justify-center.round.text-xs.transition-colors(
                  class="w-4 h-4" :class="index === 0 ? 'text-gray-700 cursor-default' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'"
                  :disabled="index === 0" title="На задний план" @click.stop="$emit('move-element', el.id, 1)"
                ) ▼
              
              .opacity-70.flex-shrink-0(class="w-4 h-4" v-html="getPreview(el)")
              span.flex-1.truncate.ml-1.text-xs {{ el.name || 'Элемент' }}
              
              // Кнопка удаления
              button.absolute.right-2.flex.items-center.justify-center.rounded-md.text-gray-700.opacity-0.transition-all.duration-150(
                class="w-5 h-5 group-hover/layer-item:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                title="Удалить" @click.stop="$emit('delete-element', el.id)"
              ) ✕
          
          // Заглушка пустой сцены
          .flex.flex-col.items-center.justify-center.h-full.text-gray-700(v-else)
            span.text-3xl.mb-2.opacity-30 📄
            span.text-xs.opacity-50 Сцена пуста

  // --- РЕЖИМ: ПАНЕЛИ (ПУЛЬТЫ) ---
  template(v-else-if="modelValue === 'panels'")
    .flex.flex-col.overflow-hidden.h-full
      .flex.flex-col.overflow-hidden.flex-1.min-h-0
        .flex-shrink-0(class="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-gray-600") Элементы
        .flex-1.overflow-y-auto.scrollbar-thin(class="px-2 pb-4")
          // Группы контролов (Управление, Индикация, Геометрия)
          template(v-for="group in panelLibrary" :key="group.name")
            .mb-4
              .mb-2.px-1(class="text-xs font-semibold text-gray-500") {{ group.name }}
              .grid.grid-cols-6.w-auto(class="gap-2")
                button.flex.flex-col.items-center.justify-center(
                  class="group/ctrl p-2 rounded-xl border border-white/5 bg-gray-900/50 transition-all duration-200 hover:bg-gray-800/80 hover:border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/5 active:scale-95"
                  v-for="item in group.items" :key="item.type" @click="handleAddControl(item)"
                )
                  // Превью контрола
                  .flex.items-center.justify-center.overflow-hidden.rounded-lg.border.transition-transform.duration-200(
                    class="w-full h-14 border-white/5 mb-1.5 group-hover/ctrl:scale-105" :style="getPreviewStyle(item)"
                  )
                    span.truncate.px-1.text-sm(v-if="item.settings.label") {{ item.settings.label }}
                  .w-full.text-center.truncate.transition-colors(class="text-xs text-gray-600 group-hover/ctrl:text-gray-300") {{ item.name }}

      // Секция списка панелей и контролов
      .flex.flex-col.overflow-hidden.flex-shrink-0.transition-all.duration-300.border-t(
        class="h-[45%] bg-gray-900/20 border-white/5" :class="highlightPanels ? 'ring-2 ring-inset ring-amber-400/50 bg-amber-900/10' : ''"
      )
        .flex.items-center.justify-between.flex-shrink-0(class="px-3 py-2")
          .text-xs.font-bold.uppercase.tracking-wider.text-gray-600 Панели
          .flex.items-center.gap-2
            // Предупреждение "Выберите цель"
            .flex.items-center.gap-1.font-medium.animate-pulse.text-amber-400(class="text-sm" v-if="highlightPanels")
              span ⚠️
              span Выберите цель
            button.flex.items-center.justify-center.rounded-lg.text-gray-600.border.transition-all.duration-200(
              class="w-6 h-6 border-white/5 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/10 active:scale-90"
              title="Создать панель" @click="$emit('add-panel')"
            ) +
        
        .flex-1.overflow-y-auto.scrollbar-thin(class="px-2 pb-2")
          template(v-if="panels && panels.length > 0")
            .mb-1(v-for="p in panels" :key="p.id")
              // Элемент списка Панелей
              .flex.items-center.justify-between.cursor-pointer.border.border-transparent.rounded-lg(
                class="px-3 py-2 transition-all duration-150"
                :class="selectedPanelId === p.id ? 'bg-purple-500/10 text-purple-200 border-purple-500/20' : 'text-gray-400 hover:bg-white/[0.03] hover:text-gray-200'"
                @click="$emit('select-panel', p.id)"
              )
                .flex.items-center.gap-2
                  span.text-sm 📟
                  span.truncate.text-xs.font-medium {{ p.title || 'Новая панель' }}
                button.flex.items-center.justify-center.rounded-md.text-gray-700.transition-all.duration-150(
                  class="w-5 h-5 hover:text-red-400 hover:bg-red-500/10" title="Удалить панель" @click.stop="$emit('delete-panel', p.id)"
                ) ✕

              // Список контролов внутри выбранной панели (Drag & Drop)
              .ml-3.mt-1.pl-3.border-l(class="border-white/5" v-if="selectedPanelId === p.id && p.controls && p.controls.length > 0")
                .group.flex.items-center.justify-between.cursor-grab.border.border-transparent.rounded-md(
                  class="ctrl-list px-2 py-1.5 my-0.5 transition-all duration-150"
                  :class="getCtrlClasses(c)"
                  v-for="c in p.controls" :key="c.id"
                  draggable="true"
                  @dragstart.stop="onDragStartCtrl($event, c.id)"
                  @dragover.prevent="onDragOverCtrl($event, c.id)"
                  @dragend="onDragEndCtrl"
                  @drop.stop="onDropCtrl($event, p.id, c.id)"
                  @click="$emit('select-control', {cId: c.id, pId: p.id})"
                )
                  .flex.items-center.gap-2.flex-1.min-w-0
                    span.w-3.text-center.text-gray-700.transition-colors(class="text-sm group-hover/ctrl-list:text-gray-400") ⠿
                    // Цветовой индикатор
                    .flex-shrink-0.rounded-sm.border(class="w-3 h-3 border-white/10" :style="{ backgroundColor: c.settings?.color || '#666666' }")
                    span.truncate.text-xs {{ c.settings?.label || c.type }}
                    // Индикатор горячей клавиши
                    span.ml-auto.mr-1.text-sm.font-mono.text-gray-600.truncate(v-if="c.settings?.hotkey" :title="'Горячая клавиша: ' + c.settings.hotkey") [{{ c.settings.hotkey }}]
                  
                  // Кнопка удаления контрола
                  button.flex.items-center.justify-center.rounded-md.text-gray-700.opacity-0.transition-all.duration-150.flex-shrink-0(
                    class="w-4 h-4 group-hover/ctrl-list:opacity-100 hover:text-red-400 hover:bg-red-500/10"
                    title="Удалить кнопку" @click.stop="$emit('delete-control', {pId: p.id, cId: c.id})"
                  ) ✕

          // Заглушка пустого списка
          .flex.flex-col.items-center.justify-center.h-full.text-gray-700(v-else)
            span.text-3xl.mb-2.opacity-30 📺
            span.text-xs.opacity-50 Нет панелей
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { LIBRARY_GROUPS } from '../../constants/library'
import { useCustomAssets } from '../../composables/useCustomAssets'
import type { Panel, SceneElement } from '../../types/scene'
import SimulatorPersonAvatar from '../simulator/PersonAvatar.vue'

/**
 * Библиотека шаблонов контролов для панелей.
 * Каждый элемент содержит:
 * - type: уникальный идентификатор типа
 * - name: название для отображения в UI
 * - settings: объект настроек по умолчанию
 */
const PANEL_LIBRARY = [
  { 
    name: 'Управление', 
    items: [
      // [НАСТРОЙКА] Кнопка открытия ворот
      { type: 'button-gate-open', name: 'Открыть', settings: { 
        width: 80, height: 80, label: '🚪', color: '#2563eb', textColor: '#ffffff', 
        borderRadius: 50, actionType: 'gate-open', 
      }},
      // [НАСТРОЙКА] Кнопка закрытия ворот
      { type: 'button-gate-close', name: 'Закрыть', settings: { 
        width: 80, height: 80, label: '🔒', color: '#dc2626', textColor: '#ffffff', 
        borderRadius: 50, actionType: 'gate-close', 
      }},
      // [НАСТРОЙКА] Кнопка открытия калитки
      { type: 'button-wicket-open', name: 'Калитка', settings: { 
        width: 60, height: 60, label: '🚶', color: '#16a34a', textColor: '#ffffff', 
        borderRadius: 50, actionType: 'wicket-open', 
      }},
      // [НАСТРОЙКА] Кнопка закрытия калитки
      { type: 'button-wicket-close', name: 'Закр.калитку', settings: { 
        width: 60, height: 60, label: '🚫', color: '#ea580c', textColor: '#ffffff', 
        borderRadius: 50, actionType: 'wicket-close', 
      }},
      // [НАСТРОЙКА] Кнопка СТОП
      { type: 'button-stop', name: 'Стоп', settings: { 
        width: 60, height: 60, label: '🛑', color: '#dc2626', textColor: '#ffffff', 
        borderRadius: 50, actionType: 'gate-stop', 
      }},
      // [НАСТРОЙКА] Переговорник (улица). intercomSide: 'enter' = вход
      { type: 'button-intercom', name: 'Перег. (улица)', settings: { width: 60, height: 60, label: '📞', color: '#16a34a', borderRadius: 8, actionType: 'call', intercomSide: 'enter', gradient: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #22c55e 0%, #15803d 100%)', labelPosition: 'bottom' } },
      // [НАСТРОЙКА] Переговорник (внутрь). intercomSide: 'exit' = выход
      { type: 'button-intercom', name: 'Перег. (внутр.)', settings: { width: 60, height: 60, label: '📞', color: '#2563eb', borderRadius: 8, actionType: 'call', intercomSide: 'exit', gradient: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', labelPosition: 'bottom' } },
      // [НАСТРОЙКА] Тумблер
      { type: 'switch', name: 'Тумблер', settings: { width: 40, height: 60, label: 'Сеть', color: '#374151', borderRadius: 4, actionType: 'toggle' } }
    ]
  },
  { 
    name: 'Индикация', 
    items: [
      { type: 'indicator-light', name: 'Светофор', settings: { width: 30, height: 80, color: '#22c55e', shape: 'vertical-dots' } },
      { type: 'indicator-led', name: 'LED', settings: { width: 20, height: 20, color: '#22c55e', borderRadius: 50, glow: true } },
      { type: 'display-text', name: 'Табло', settings: { width: 120, height: 40, color: '#000000', textColor: '#22c55e', label: '00:00', fontSize: 24 } }
    ]
  },
  { 
    name: 'Геометрия', 
    items: [
      { type: 'shape-rect', name: 'Прямоуг.', settings: { width: 100, height: 60, color: '#4b5563' } },
      { type: 'shape-circle', name: 'Круг', settings: { width: 60, height: 60, color: '#4b5563', borderRadius: 50 } },
      { type: 'shape-line', name: 'Линия', settings: { width: 100, height: 4, color: '#9ca3af' } }
    ]
  }
]

const props = defineProps<{
  modelValue: string          // Текущий таб ('scene' | 'panels')
  width: number               // Ширина сайдбара
  panels: Panel[]             // Список панелей в сцене
  elements?: SceneElement[]   // Список элементов в сцене
  selectedPanelId?: string | null
  selectedCtrlIds?: string[]
  selectedElementId?: string | null
}>()

const emit = defineEmits([
  'update:modelValue', 'add-element', 'select-element', 'delete-element', 'move-element',
  'add-panel', 'select-panel', 'delete-panel', 'add-control', 'delete-control', 'select-control',
  'reorder-control'
])

const library = LIBRARY_GROUPS
const panelLibrary = PANEL_LIBRARY
const highlightPanels = ref(false) // Подсветка предупреждения "Выберите панель"
const { customPeople } = useCustomAssets()

// --- ЛОГИКА DRAG & DROP ДЛЯ КОНТРОЛОВ ---
const draggedCtrlId = ref<string | null>(null)

const onDragStartCtrl = (e: DragEvent, ctrlId: string) => {
  draggedCtrlId.value = ctrlId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ctrlId) 
  }
}

const onDragOverCtrl = (e: DragEvent, targetId: string) => {
  if (draggedCtrlId.value && draggedCtrlId.value !== targetId) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
}

const onDragEndCtrl = () => {
  draggedCtrlId.value = null
}

/**
 * Обработка сброса элемента при перетаскивании.
 * Отправляет событие 'reorder-control' родителю для изменения порядка в массиве.
 */
const onDropCtrl = (e: DragEvent, panelId: string, targetId: string) => {
  e.preventDefault()
  if (!draggedCtrlId.value || draggedCtrlId.value === targetId) return
  emit('reorder-control', { panelId, fromId: draggedCtrlId.value, toId: targetId })
  draggedCtrlId.value = null
}

// --- СТИЛИЗАЦИЯ ПРЕВЬЮ ---

const getPreview = (el: any) => {
  if (el.asset?.type === 'svg') return el.asset.content
  return `<div class='w-3 h-3 rounded-sm' style='background:${el.asset?.content || '#888'}'></div>`
}

/**
 * Генерация CSS-стилей для превью кнопки в библиотеке.
 * Использует настройки (settings) для имитации внешнего вида.
 */
const getPreviewStyle = (item: any) => {
  const s = item.settings
  const previewShadow = 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 3px rgba(0,0,0,0.4)'
  
  return {
    width: '100%', height: '100%',
    backgroundColor: s.gradient ? undefined : s.color,
    backgroundImage: s.gradient,
    borderRadius: s.borderRadius ? `${s.borderRadius}%` : '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: s.textColor || '#fff', fontSize: s.fontSize ? `${s.fontSize}px` : '10px', fontWeight: 'bold',
    boxShadow: s.glow ? `0 0 6px ${s.color}, ${previewShadow}` : previewShadow,
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }
}

/**
 * Генерация классов CSS для элемента списка контролов.
 * Учитывает выделение и состояние перетаскивания.
 */
const getCtrlClasses = (c: any) => {
  const base = props.selectedCtrlIds && props.selectedCtrlIds.includes(c.id) 
    ? 'bg-amber-500/10 text-amber-200 border-amber-500/20' 
    : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'
    
  const drag = draggedCtrlId.value === c.id 
    ? 'opacity-40 scale-95 border-dashed border-blue-400' 
    : ''
    
  return [base, drag]
}

// --- ОБРАБОТЧИКИ ДЕЙСТВИЙ ---

const handleAddCustomPerson = (item: any) => {
  emit('add-element', { 
    type: 'person', 
    category: 'human', 
    name: item.name, 
    appearance: { ...item }, 
    w: 50, 
    h: 100 
  })
}

/**
 * Добавление контрола на панель.
 * Если панель не выбрана, показывает предупреждение.
 */
const handleAddControl = (item: any) => {
  if (!props.selectedPanelId) {
    highlightPanels.value = true
    setTimeout(() => { highlightPanels.value = false }, 1500)
    return
  }
  
  emit('add-control', {
    type: item.type,
    settings: { ...item.settings },
    id: `ctrl_${Date.now()}`,
    x: 50, y: 50,
    panelId: props.selectedPanelId
  })
}

// === ЛОГИКА ГОРЯЧИХ КЛАВИШ (ЗАПИСЬ) ===

// Состояние "прослушивания" нажатия для конкретного контрола
const listeningFor = ref<{ pId: string, cId: string } | null>(null)

/**
 * Начать прослушивание нажатия клавиши для назначения хоткея.
 */
const startListening = (pId: string, cId: string) => {
  if (listeningFor.value?.cId === cId) {
    listeningFor.value = null
  } else {
    listeningFor.value = { pId, cId }
  }
}

const clearHotkey = (pId: string, cId: string) => {
  emit('update-control-hotkey', { pId, cId, hotkey: null })
}

/**
 * Форматирование события клавиатуры в читаемую строку.
 * Пример: "Ctrl + Shift + A"
 */
const formatHotkey = (e: KeyboardEvent): string | null => {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join(' + ')
}

/**
 * Глобальный обработчик нажатий.
 * Работает в фазе capturing (capture: true), чтобы перехватить событие до остальных слушателей.
 */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (!listeningFor.value) return

  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    listeningFor.value = null
    return
  }

  const hotkeyStr = formatHotkey(e)
  
  if (hotkeyStr) {
    emit('update-control-hotkey', {
      pId: listeningFor.value.pId,
      cId: listeningFor.value.cId,
      hotkey: hotkeyStr
    })
    listeningFor.value = null
  }
}

/**
 * Отмена записи хоткея при клике вне элемента.
 */
const handleGlobalMouseDown = (e: MouseEvent) => {
  if (!listeningFor.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.ctrl-list')) {
    listeningFor.value = null
  }
}

onMounted(() => {
  // Регистрируем с capture: true, чтобы перехватывать события даже если фокус на инпуте
  window.addEventListener('keydown', handleGlobalKeyDown, true)
  window.addEventListener('mousedown', handleGlobalMouseDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown, true)
  window.removeEventListener('mousedown', handleGlobalMouseDown)
})
</script>

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #ffffff10;
  border-radius: 2px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #ffffff20;
}

[draggable="true"] {
  -webkit-user-select: none;
  user-select: none;
}
</style>