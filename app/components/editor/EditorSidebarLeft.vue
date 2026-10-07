<!-- app/components/editor/EditorSidebarLeft.vue -->
<!-- Назначение: левый сайдбар редактора — библиотека объектов, слои, пульты.
     [Фаза 5]:
      1. [FIX] PUG:NO_END_BRACKET — в строке слоя остался хвост старого :class;
      2. [FIX] мёртвые классы (hover:bg-white/3 не существует) -> /5;
      3. Разделитель: bg-linear-to-b (канон v4);
      4. Тёмная палитра ОСОЗНАННО сохранена — рабочий стол инструмента. -->
<template lang="pug">
aside.flex.flex-col.overflow-hidden.flex-shrink-0.h-full.border-r(
  class="bg-gray-950 shadow-2xl shadow-black/50 border-white/5"
)
  //- Табы
  .flex.backdrop-blur-sm.flex-shrink-0.mx-2.mt-2.rounded-xl.border(
    class="bg-gray-900/80 p-1.5 border-white/5"
  )
    button.flex-1(
      class="hover:bg-white/5 py-1.5 border border-transparent rounded-lg font-semibold text-gray-500 hover:text-gray-300 text-xs transition-all duration-200"
      :class="modelValue === 'scene' ? 'bg-blue-600/20 text-blue-400 shadow-sm shadow-blue-500/10 border-blue-500/20' : ''"
      @click="$emit('update:modelValue', 'scene')"
    )
      span.mr-1 📦
      span Объекты

    button.flex-1(
      class="hover:bg-white/5 py-1.5 border border-transparent rounded-lg font-semibold text-gray-500 hover:text-gray-300 text-xs transition-all duration-200"
      :class="modelValue === 'panels' ? 'bg-purple-600/20 text-purple-400 shadow-sm shadow-purple-500/10 border-purple-500/20' : ''"
      @click="$emit('update:modelValue', 'panels')"
    )
      span.mr-1 📟
      span Пульты

  .flex-1.overflow-hidden.mt-2

  //- ==========================================
  //- РЕЖИМ: СЦЕНА (ОБЪЕКТЫ)
  //- ==========================================
  template(v-if="modelValue === 'scene'")
    .flex.flex-row.h-full.min-h-0
      //- ЛЕВАЯ КОЛОНКА: Библиотека
      .flex.flex-col.overflow-hidden.flex-1.pr-1(
        class="min-w-0"
      )
        .flex-shrink-0.px-3.pb-2.text-xs.font-bold.uppercase.tracking-wider.text-gray-600 Библиотека
        .flex-1.overflow-y-auto.scrollbar-thin.px-2.pb-4
          //- Мои персонажи
          .mb-4(v-if="customPeople.length > 0")
            .mb-2.px-1.text-xs.font-semibold.text-gray-500 Мои персонажи
            .grid.grid-cols-5(
              class="gap-1.5"
            )
              button.flex.flex-col.items-center.justify-center(
                class="group/person bg-blue-500/5 hover:bg-blue-500/15 p-1.5 border border-blue-500/10 hover:border-blue-500/30 rounded-lg active:scale-95 transition-all duration-200"
                v-for="item in customPeople" :key="item.id" @click="handleAddCustomPerson(item)"
              )
                .flex.items-center.justify-center.overflow-hidden.rounded-md.bg-gray-800.border.mb-1.w-8.h-8.person-icon(
                  class="border-white/5"
                )
                  SimulatorPersonAvatar(:appearance="item" :width="28" :height="28" view="front")
                .w-full.text-center.truncate.text-xs.text-blue-300(
                  class="group-hover/person:text-blue-200"
                ) {{ item.name || 'Персонаж' }}

          //- Группы библиотеки
          template(v-for="group in library" :key="group.name")
            .mb-4
              .mb-2.px-1.truncate.text-xs.font-semibold.text-gray-500 {{ group.name }}
              .grid.grid-cols-5(
                class="gap-1.5"
              )
                button.flex.flex-col.items-center.justify-center(
                  class="group/item hover:bg-white/5 p-1.5 border border-transparent hover:border-white/10 rounded-lg active:scale-95 transition-all duration-200"
                  v-for="item in group.items" :key="item.name" @click="$emit('add-element', item)"
                )
                  .flex.items-center.justify-center.rounded-md.bg-gray-800.border.mb-1.transition-all.w-8.h-8.lib-icon(
                    class="border-white/5 group-hover/item:border-white/10"
                  )
                    div.lib-icon-inner(v-html="item.preview")
                  .w-full.text-center.truncate.text-xs.text-gray-500(
                    class="group-hover/item:text-gray-300"
                  ) {{ item.name }}

      //- Разделитель
      .flex-shrink-0.bg-linear-to-b.from-transparent.to-transparent.w-px.mx-2(
        class="via-base-content/10"
      )

      //- ПРАВАЯ КОЛОНКА: Слои
      .flex.flex-col.overflow-hidden.flex-shrink-0.w-56(
        class="bg-gray-900/30"
      )
        .flex-shrink-0.border-b.px-3.pb-2.text-xs.font-bold.uppercase.tracking-wider.text-gray-600(
          class="border-white/5"
        ) Слои
        .flex-1.overflow-y-auto.scrollbar-thin.p-2
          template(v-if="elements && elements.length > 0")
            .group.layer-row.relative.flex.items-center.gap-2.cursor-pointer(
              class="px-3 py-2 border-l-2 rounded-lg transition-all duration-150 layer-item"
              :class="selectedElementId === el.id ? 'bg-blue-500/10 text-white border-l-blue-400' : 'border-l-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200'"
              v-for="(el, index) in elements" :key="el.id" @click="$emit('select-element', el.id)"
            )
              .flex.flex-col.mr-1.flex-shrink-0(
                class="gap-0"
              )
                button.flex.items-center.justify-center.text-xs.transition-colors.w-4.h-4(
                  class="rounded"
                  :class="index === elements.length - 1 ? 'text-gray-700 cursor-default' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'"
                  :disabled="index === elements.length - 1" title="На передний план" @click.stop="$emit('move-element', el.id, -1)"
                ) ▲
                button.flex.items-center.justify-center.text-xs.transition-colors.w-4.h-4(
                  class="rounded"
                  :class="index === 0 ? 'text-gray-700 cursor-default' : 'text-gray-600 hover:text-blue-400 hover:bg-blue-500/10'"
                  :disabled="index === 0" title="На задний план" @click.stop="$emit('move-element', el.id, 1)"
                ) ▼

              .opacity-70.flex-shrink-0.w-4.h-4.layer-preview
                div.layer-preview-inner(v-html="getPreview(el)")
              span.flex-1.truncate.ml-1.text-xs.layer-name {{ el.name || 'Элемент' }}

              button.layer-delete.absolute.right-2.flex.items-center.justify-center.rounded-md.text-gray-700.opacity-0.transition-all.duration-150.w-5.h-5(
                class="hover:bg-red-500/10 hover:text-red-400"
                title="Удалить" @click.stop="$emit('delete-element', el.id)"
              ) ✕

          .flex.flex-col.items-center.justify-center.h-full.text-gray-700(v-else)
            span.text-3xl.mb-2(
              class="opacity-30"
            ) 📄
            span.text-xs(
              class="opacity-50"
            ) Сцена пуста

  //- ==========================================
  //- РЕЖИМ: ПАНЕЛИ (ПУЛЬТЫ)
  //- ==========================================
  template(v-else-if="modelValue === 'panels'")
    .flex.flex-col.overflow-hidden.h-full(
      class="min-h-0"
    )
      //- Верхняя часть: Библиотека контролов
      .flex.flex-col.overflow-hidden.flex-1(
        class="min-h-0"
      )
        .flex-shrink-0.px-3.pb-2.text-xs.font-bold.uppercase.tracking-wider.text-gray-600 Элементы
        .flex-1.overflow-y-auto.scrollbar-thin.px-2.pb-4
          template(v-for="group in panelLibrary" :key="group.name")
            .mb-3
              .mb-1.px-1.text-xs.font-semibold.text-gray-500 {{ group.name }}
              .grid.grid-cols-8(
                class="gap-1"
              )
                button.flex.flex-col.items-center.justify-center(
                  class="group/ctrl bg-gray-900/50 hover:bg-gray-800/80 p-1 border border-white/5 hover:border-purple-500/20 rounded-lg active:scale-95 transition-all duration-200"
                  v-for="item in group.items" :key="item.type" @click="handleAddControl(item)"
                )
                  .flex.items-center.justify-center.overflow-hidden.transition-transform.duration-200.w-8.h-8.flex-shrink-0.ctrl-preview-box(
                    class="group-hover/ctrl:scale-105"
                    :class="isCircleControl(item) ? 'rounded-full' : 'rounded'"
                    :style="getPreviewColorStyle(item)"
                  )
                    span.truncate.text-xs(
                      v-if="item.settings?.label"
                    ) {{ item.settings?.label }}
                  .w-full.text-center.truncate.transition-colors.text-xxs.text-gray-600(
                    class="group-hover/ctrl:text-gray-300"
                  ) {{ item.name }}

      //- Нижняя часть: Список панелей
      .flex.flex-col.overflow-hidden.flex-shrink-0.transition-all.duration-300.border-t(
        class="bg-gray-900/20 border-white/5 h-[45%]"
        :class="highlightPanels ? 'ring-2 ring-inset ring-amber-400/50 bg-amber-900/10' : ''"
      )
        .flex.items-center.justify-between.flex-shrink-0.px-3.py-2
          .text-xs.font-bold.uppercase.tracking-wider.text-gray-600 Панели
          .flex.items-center.gap-2
            .flex.items-center.gap-1.font-medium.animate-pulse.text-amber-400.text-sm(v-if="highlightPanels")
              span ⚠️
              span Выберите цель
            button.flex.items-center.justify-center.rounded-lg.text-gray-600.border.transition-all.duration-200.w-6.h-6(
              class="hover:bg-green-500/10 border-white/5 hover:border-green-500/30 hover:text-green-400 active:scale-90"
              title="Создать панель" @click="$emit('add-panel')"
            ) +

        .flex-1.overflow-y-auto.scrollbar-thin.px-2.pb-2
          template(v-if="panels && panels.length > 0")
            .mb-1(v-for="p in panels" :key="p.id")
              .flex.items-center.justify-between.cursor-pointer.border.border-transparent.rounded-lg(
                class="px-3 py-2 transition-all duration-150"
                :class="selectedPanelId === p.id ? 'bg-purple-500/10 text-purple-200 border-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'"
                @click="$emit('select-panel', p.id)"
              )
                .flex.items-center.gap-2(
                  class="min-w-0"
                )
                  span.text-sm 📟
                  span.truncate.text-xs.font-medium {{ p.title || 'Новая панель' }}
                button.flex.items-center.justify-center.rounded-md.text-gray-700.transition-all.duration-150.w-5.h-5(
                  class="hover:bg-red-500/10 hover:text-red-400"
                  title="Удалить панель" @click.stop="$emit('delete-panel', p.id)"
                ) ✕

              .ml-3.mt-1.pl-3.border-l(
                class="border-white/5"
                v-if="selectedPanelId === p.id && p.controls && p.controls.length > 0"
              )
                .group.ctrl-row.flex.items-center.justify-between.cursor-grab.border.border-transparent.rounded-md(
                  class="my-0.5 px-2 py-1.5 transition-all duration-150 ctrl-list"
                  :class="getCtrlClasses(c)"
                  v-for="c in p.controls" :key="c.id"
                  draggable="true"
                  @dragstart.stop="onDragStartCtrl($event, c.id)"
                  @dragover.prevent="onDragOverCtrl($event, c.id)"
                  @dragend="onDragEndCtrl"
                  @drop.stop="onDropCtrl($event, p.id, c.id)"
                  @click="$emit('select-control', {cId: c.id, pId: p.id})"
                )
                  .flex.items-center.gap-2.flex-1(
                    class="min-w-0"
                  )
                    span.ctrl-drag.w-3.text-center.text-gray-700.transition-colors.text-sm ⠿
                    .flex-shrink-0.border.w-3.h-3(
                      class="border-white/10 rounded-sm"
                      :style="{ backgroundColor: c.settings?.color || '#666666' }"
                    )
                    span.truncate.text-xs {{ c.settings?.label || c.type }}
                    span.ml-auto.mr-1.text-sm.font-mono.text-gray-600.truncate.ctrl-hotkey(
                      v-if="c.settings?.hotkey"
                      :title="'Горячая клавиша: ' + c.settings.hotkey"
                    ) [{{ c.settings.hotkey }}]

                  button.ctrl-delete.flex.items-center.justify-center.rounded-md.text-gray-700.opacity-0.transition-all.duration-150.flex-shrink-0.w-4.h-4(
                    class="hover:bg-red-500/10 hover:text-red-400"
                    title="Удалить кнопку" @click.stop="$emit('delete-control', {pId: p.id, cId: c.id})"
                  ) ✕

          .flex.flex-col.items-center.justify-center.h-full.text-gray-700(v-else)
            span.text-3xl.mb-2(
              class="opacity-30"
            ) 📺
            span.text-xs(
              class="opacity-50"
            ) Нет панелей
</template>

<script setup lang="ts">
// app/components/editor/EditorSidebarLeft.vue — script
import { ref, onMounted, onUnmounted } from 'vue'
import { LIBRARY_GROUPS } from '../../constants/library'
import { useCustomAssets } from '../../composables/useCustomAssets'
import type { Panel } from '../../types/scene'
import SimulatorPersonAvatar from '../simulator/PersonAvatar.vue'
import type { SceneElement } from '~/types/simulator'

// [ИСПРАВЛЕНО] тип элемента библиотеки пультов: settings — свободный словарь,
// т.к. разные типы контролов несут разные наборы полей (у shape-rect нет label).
interface PanelLibraryItem {
  type: string
  name: string
  settings: Record<string, any>
}

const PANEL_LIBRARY: { name: string; items: PanelLibraryItem[] }[] = [
  {
    name: 'Управление',
    items: [
      { type: 'button-gate-open', name: 'Открыть', settings: {
        width: 80, height: 80, label: '🚪', color: '#2563eb', textColor: '#ffffff',
        borderRadius: 50, actionType: 'gate-open',
      }},
      { type: 'button-gate-close', name: 'Закрыть', settings: {
        width: 80, height: 80, label: '🔒', color: '#dc2626', textColor: '#ffffff',
        borderRadius: 50, actionType: 'gate-close',
      }},
      { type: 'button-wicket-open', name: 'Калитка', settings: {
        width: 60, height: 60, label: '🚶', color: '#16a34a', textColor: '#ffffff',
        borderRadius: 50, actionType: 'wicket-open',
      }},
      { type: 'button-wicket-close', name: 'Закр.калитку', settings: {
        width: 60, height: 60, label: '🚫', color: '#ea580c', textColor: '#ffffff',
        borderRadius: 50, actionType: 'wicket-close',
      }},
      { type: 'button-stop', name: 'Стоп', settings: {
        width: 60, height: 60, label: '🛑', color: '#dc2626', textColor: '#ffffff',
        borderRadius: 50, actionType: 'gate-stop',
      }},
      { type: 'button-intercom', name: 'Перег. (улица)', settings: { width: 60, height: 60, label: '📞', color: '#16a34a', borderRadius: 8, actionType: 'call', intercomSide: 'enter', gradient: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #22c55e 0%, #15803d 100%)', labelPosition: 'bottom' } },
      { type: 'button-intercom', name: 'Перег. (внутр.)', settings: { width: 60, height: 60, label: '📞', color: '#2563eb', borderRadius: 8, actionType: 'call', intercomSide: 'exit', gradient: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 50%), linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', labelPosition: 'bottom' } },
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
  modelValue: string
  panels: Panel[]
  elements?: SceneElement[]
  selectedPanelId?: string | null
  selectedCtrlIds?: string[]
  selectedElementId?: string | null
}>()

const emit = defineEmits([
  'update:modelValue', 'add-element', 'select-element', 'delete-element', 'move-element',
  'add-panel', 'select-panel', 'delete-panel', 'add-control', 'delete-control', 'select-control',
  'reorder-control', 'update-control-hotkey'
])

const library = LIBRARY_GROUPS
const panelLibrary = PANEL_LIBRARY
const highlightPanels = ref(false)
const { customPeople } = useCustomAssets()

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

const onDropCtrl = (e: DragEvent, panelId: string, targetId: string) => {
  e.preventDefault()
  if (!draggedCtrlId.value || draggedCtrlId.value === targetId) return
  emit('reorder-control', { panelId, fromId: draggedCtrlId.value, toId: targetId })
  draggedCtrlId.value = null
}

const getPreview = (el: any) => {
  if (el.asset?.type === 'svg') return el.asset.content
  return `<div class='rounded-sm w-3 h-3' style='background:${el.asset?.content || '#888'}'></div>`
}

const isCircleControl = (item: any) => {
  return item.settings?.borderRadius === 50
}

const getPreviewColorStyle = (item: any) => {
  const s = item.settings
  const previewShadow = 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 3px rgba(0,0,0,0.4)'

  return {
    backgroundColor: s.gradient ? undefined : s.color,
    backgroundImage: s.gradient,
    color: s.textColor || '#fff',
    fontSize: '9px',
    fontWeight: 'bold',
    boxShadow: s.glow ? `0 0 6px ${s.color}, ${previewShadow}` : previewShadow,
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }
}

// [FIX] hover:bg-white/3 не существует (Tailwind) — заменён на /5
const getCtrlClasses = (c: any) => {
  const base = props.selectedCtrlIds && props.selectedCtrlIds.includes(c.id)
    ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
  const drag = draggedCtrlId.value === c.id
    ? 'opacity-40 scale-95 border-dashed border-blue-400'
    : ''
  return [base, drag]
}

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

const handleAddControl = (item: any) => {
  if (!props.selectedPanelId) {
    highlightPanels.value = true
    setTimeout(() => { highlightPanels.value = false }, 1500)
    return
  }

  const ctrlId = `ctrl_${Date.now()}`
  emit('add-control', {
    type: item.type,
    settings: { ...item.settings },
    id: ctrlId,
    x: 50, y: 50,
    panelId: props.selectedPanelId
  })
}

const listeningFor = ref<{ pId: string, cId: string } | null>(null)

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

const handleGlobalMouseDown = (e: MouseEvent) => {
  if (!listeningFor.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.ctrl-list')) {
    listeningFor.value = null
  }
}

onMounted(() => {
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
  width: 3px;
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

/* Квадратная форма для превью контролов */
.ctrl-preview-box {
  aspect-ratio: 1 / 1;
}

/* Подписи контролов — уменьшенный шрифт */
.text-xxs {
  font-size: 9px;
  line-height: 1.1;
}

/* Внутренние обёртки растягиваются на контейнер */
.lib-icon-inner,
.layer-preview-inner {
  width: 100%;
  height: 100%;
}

/* SVG/IMG растягиваются на обёртку */
.lib-icon-inner :deep(svg),
.lib-icon-inner :deep(img),
.layer-preview-inner :deep(svg),
.layer-preview-inner :deep(img),
.person-icon :deep(svg),
.person-icon :deep(img) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

/* Hover-эффекты для групп */
.layer-row:hover .layer-delete { opacity: 1; }
.ctrl-row:hover .ctrl-delete { opacity: 1; }
</style>