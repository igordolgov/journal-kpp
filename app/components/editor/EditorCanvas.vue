<!-- app/components/editor/EditorCanvas.vue -->
<template lang='pug'>
.relative.w-full.h-full.overflow-hidden.bg-gray-800(
  ref="canvasRef"
  tabindex="0"
  @keydown="handleKeyDown"
)
  //- Уголок линейки
  .absolute.top-0.left-0.w-5.h-5.bg-gray-700.z-30.border-r.border-b.border-gray-600

  //- Вертикальная линейка
  .absolute.top-5.left-0.w-5.bg-gray-700.z-20.border-r.border-gray-600.overflow-hidden.pointer-events-none(
    :style="{ height: canvasHeight + 'px' }"
  )
    template(v-for="tick in vTicks" :key="'v'+tick")
      .absolute.left-0.border-t.border-gray-400(:style="getTickStyle(tick, 'v')")
      span.absolute.left-1.text-gray-300.font-mono(
        v-if="tick % 100 === 0"
        :style="{ top: (tick + 2) + 'px', fontSize: '9px' }"
      ) {{ tick }}
    .absolute.left-0.right-0.pointer-events-none.z-30(
      v-if="selectionMarker.y !== null"
      class="bg-blue-500/40"
      :style="{ top: selectionMarker.y + 'px', height: selectionMarker.h + 'px' }"
    )

  //- Горизонтальная линейка
  .absolute.top-0.left-5.h-5.bg-gray-700.z-20.border-b.border-gray-600.overflow-hidden.pointer-events-none(
    :style="{ width: canvasWidth + 'px' }"
  )
    template(v-for="tick in hTicks" :key="'h'+tick")
      .absolute.top-0.border-l.border-gray-400(:style="getTickStyle(tick, 'h')")
      span.absolute.top-1.text-gray-300.font-mono(
        v-if="tick % 100 === 0"
        :style="{ left: (tick + 2) + 'px', fontSize: '9px' }"
      ) {{ tick }}
    .absolute.top-0.bottom-0.pointer-events-none.z-30(
      v-if="selectionMarker.x !== null"
      class="bg-blue-500/40"
      :style="{ left: selectionMarker.x + 'px', width: selectionMarker.w + 'px' }"
    )

  //- Холст
  .absolute.top-5.left-5.bg-gray-600(
    :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
    @mousedown.self="handleCanvasMouseDown"
  )
    .absolute.inset-0.pointer-events-none(:style="sceneBackgroundStyle")
    .absolute.inset-0.pointer-events-none(
      v-if="settings.showGrid"
      :style="{ backgroundImage: 'linear-gradient(#374151 1px, transparent 1px), linear-gradient(90deg, #374151 1px, transparent 1px)', backgroundSize: '20px 20px' }"
    )

    //- Элементы сцены
    template(v-for="el in elements" :key="el.id")
      .absolute.cursor-move.transition-colors(
        :style="getElementStyle(el)"
        :class="isSelected(el.id) ? 'ring-2 ring-blue-400 z-10' : 'hover:ring-2 hover:ring-gray-500'"
        @mousedown.stop="handleElementMouseDown($event, el.id)"
      )
        //- [ИСПРАВЛЕНО] el.width/height опциональны — fallback до number
        //- (400x120 — дефолт дорожки из библиотеки)
        TrafficRoad.w-full.h-full(
          v-if="el.asset?.type === 'traffic_road'"
          :width="el.width || 400"
          :height="el.height || 120"
          :is-running="isSimulating"
          :spawn-rate="el.settings?.spawnRate"
          :min-speed="el.settings?.minSpeed"
          :max-speed="el.settings?.maxSpeed"
        )
        SimulatorPersonAvatar.absolute.w-full.h-full.pointer-events-none(
          v-else-if="el.asset?.type === 'person'"
          :appearance="el.asset.content"
          :width="el.width || 50"
          :height="el.height || 100"
          view="front"
        )
        .w-full.h-full.flex.items-center.justify-center.overflow-hidden(
          v-else-if="isUIElement(el)"
          :style="getUIElementStyle(el)"
        )
          span(
            v-if="el.settings.label"
            :style="{ color: el.settings.textColor || '#fff', fontSize: (el.settings.fontSize || 12) + 'px', fontWeight: 'bold' }"
          ) {{ el.settings.label }}

        .w-full.h-full.pointer-events-none(
          v-else-if="el.asset?.type === 'svg'"
          v-html="getDynamicSvg(el)"
          :style="getSvgStyle(el)"
        )

        .w-full.h-full.rounded(
          v-else
          :style="{ backgroundColor: el.asset?.content || '#888' }"
        )
        .absolute.text-xs.text-gray-400.whitespace-nowrap(
          class="-top-5 left-0"
        ) {{ el.name }}

      //- Точки траекторий для ворот
      template(v-if="isGateElement(el) && isSelected(el.id)")
        .text-xxs.text-yellow-500.absolute.z-20(
          style="top: -10px; left: 0;"
          v-if="!el.settings?.gateType"
        ) ⚠️ Выберите тип в инспекторе

        template(v-if="el.settings?.gateType === 'sliding'")
          .absolute.pointer-events-none.border-2.border-dashed.border-green-400(
            class="z-20 bg-green-400/10 rounded"
            :style="getPointStyle(el, 'spawnEnter', 'car')"
          )
            span.absolute.text-green-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Въезд: Спавн
          .absolute.pointer-events-none.border-2.border-dashed.border-orange-400(
            class="z-20 bg-orange-400/10 rounded"
            :style="getPointStyle(el, 'stopEnter', 'car')"
          )
            span.absolute.text-orange-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Въезд: Стоп
          .absolute.pointer-events-none.border-2.border-dashed.border-yellow-400(
            class="z-20 bg-yellow-400/10 rounded"
            :style="getPointStyle(el, 'crossEnter', 'car')"
          )
            span.absolute.text-yellow-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Въезд: Поворот
          .absolute.pointer-events-none.border-2.border-dashed.border-gray-400(
            class="z-20 bg-gray-400/10 rounded"
            :style="getPointStyle(el, 'despawnEnter', 'car')"
          )
            span.absolute.text-gray-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Въезд: Деспавн

          .absolute.pointer-events-none.border-2.border-dashed.border-red-400(
            class="z-20 bg-red-400/10 rounded"
            :style="getPointStyle(el, 'spawnExit', 'car')"
          )
            span.absolute.text-red-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Выезд: Спавн
          .absolute.pointer-events-none.border-2.border-dashed.border-pink-400(
            class="z-20 bg-pink-400/10 rounded"
            :style="getPointStyle(el, 'stopExit', 'car')"
          )
            span.absolute.text-pink-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Выезд: Стоп
          .absolute.pointer-events-none.border-2.border-dashed.border-yellow-400(
            class="z-20 bg-yellow-400/10 rounded"
            :style="getPointStyle(el, 'crossExit', 'car')"
          )
            span.absolute.text-yellow-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Выезд: Поворот
          .absolute.pointer-events-none.border-2.border-dashed.border-gray-400(
            class="z-20 bg-gray-400/10 rounded"
            :style="getPointStyle(el, 'despawnExit', 'car')"
          )
            span.absolute.text-gray-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 🚗 Выезд: Деспавн

        template(v-if="el.settings?.gateType === 'wicket'")
          .absolute.pointer-events-none.border-2.border-dashed.border-green-400(
            class="z-20 bg-green-400/10 rounded"
            :style="getPointStyle(el, 'spawnEnter', 'person')"
          )
            span.absolute.text-green-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Вход: Спавн
          .absolute.pointer-events-none.border-2.border-dashed.border-cyan-400(
            class="z-20 bg-cyan-400/10 rounded"
            :style="getPointStyle(el, 'stopEnter', 'person')"
          )
            span.absolute.text-cyan-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Вход: Стоп
          .absolute.pointer-events-none.border-2.border-dashed.border-yellow-400(
            class="z-20 bg-yellow-400/10 rounded"
            :style="getPointStyle(el, 'crossEnter', 'person')"
          )
            span.absolute.text-yellow-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Вход: Поворот
          .absolute.pointer-events-none.border-2.border-dashed.border-gray-400(
            class="z-20 bg-gray-400/10 rounded"
            :style="getPointStyle(el, 'despawnEnter', 'person')"
          )
            span.absolute.text-gray-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Вход: Деспавн

          .absolute.pointer-events-none.border-2.border-dashed.border-red-400(
            class="z-20 bg-red-400/10 rounded"
            :style="getPointStyle(el, 'spawnExit', 'person')"
          )
            span.absolute.text-red-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Выход: Спавн
          .absolute.pointer-events-none.border-2.border-dashed.border-purple-400(
            class="z-20 bg-purple-400/10 rounded"
            :style="getPointStyle(el, 'stopExit', 'person')"
          )
            span.absolute.text-purple-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Выход: Стоп
          .absolute.pointer-events-none.border-2.border-dashed.border-yellow-400(
            class="z-20 bg-yellow-400/10 rounded"
            :style="getPointStyle(el, 'crossExit', 'person')"
          )
            span.absolute.text-yellow-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Выход: Поворот
          .absolute.pointer-events-none.border-2.border-dashed.border-gray-400(
            class="z-20 bg-gray-400/10 rounded"
            :style="getPointStyle(el, 'despawnExit', 'person')"
          )
            span.absolute.text-gray-300(
              class="-top-4 left-0 text-xxs whitespace-nowrap"
            ) 👤 Выход: Деспавн

    //- Панели
    template(v-for="panel in panels" :key="'panel_'+panel.id")
      .absolute.cursor-move.transition-colors(
        :style="getPanelStyle(panel)"
        :class="isPanelSelected(panel.id) ? 'ring-2 ring-purple-400 z-10' : 'hover:ring-2 hover:ring-gray-500'"
        @mousedown.stop="handlePanelMouseDown($event, panel.id)"
      )
        .absolute.top-0.left-0.right-0.h-6.bg-gray-700.text-gray-200.text-xs.flex.items-center.px-2.rounded-t-md(
          style="cursor: move; user-select: none;"
        )
          button.absolute.right-1.top-0.text-gray-400(
            class="hover:text-red-400"
            @click.stop="$emit('delete-panel', panel.id)"
            title="Удалить панель"
          ) ✕

        .absolute.inset-x-0(:style="{ top: '24px', bottom: '0' }")
          .relative.w-full.h-full.p-1.flex.flex-wrap.gap-1.content-start
            .control-item.relative(
              v-for="ctrl in panel.controls"
              :key="ctrl.id"
              :style="getControlStyle(ctrl)"
              :class="isControlSelected(panel.id, ctrl.id) ? 'ring-2 ring-yellow-400' : ''"
              @click.stop="handleControlClick(panel.id, ctrl.id, ctrl)"
            )
              .control-content.relative(
                :style="getControlContentStyle(ctrl)"
                :class="[ { 'is-3d-gate': isGateControl(ctrl) }, !isGateControl(ctrl) && pressedControls.has(ctrl.id) ? 'pressed' : '' ]"
              )
                .absolute.w-4.h-1.rounded-full.transition-all.z-10(
                  v-if="ctrl.settings?.actionType === 'call'"
                  class="bottom-2 left-1/2 -translate-x-1/2 translate-y-1/2"
                  :class="activeIntercoms.has(ctrl.id) ? 'glow-indicator' : 'bg-gray-400'"
                )

                .gate-casing(
                  v-if="isGateControl(ctrl)"
                  :style="getGateInnerStyle(ctrl)"
                  :class="{ 'pressed': pressedControls.has(ctrl.id) }"
                )
                  span(
                    v-if="ctrl.settings?.label && ctrl.settings?.labelPosition === 'inside'"
                    :style="{ color: `color-mix(in srgb, ${ctrl.settings?.color || '#4b5563'} 70%, black)` }"
                  ) {{ ctrl.settings.label }}
                  span.text-3xl.font-mono.text-center.leading-tight(
                    v-if="ctrl.settings?.hotkey && ctrl.settings?.labelPosition !== 'inside'"
                    :style="{ color: `color-mix(in srgb, ${ctrl.settings?.color || '#4b5563'} 70%, black)` }"
                  ) {{ ctrl.settings.hotkey }}

                template(v-else)
                  span(
                    v-if="ctrl.settings?.label && ctrl.settings?.labelPosition === 'inside'"
                    :style="{ color: `color-mix(in srgb, ${ctrl.settings?.color || '#4b5563'} 70%, black)` }"
                  ) {{ ctrl.settings.label }}
                  span.text-3xl.font-mono.text-center.leading-tight(
                    v-if="ctrl.settings?.hotkey && ctrl.settings?.labelPosition !== 'inside'"
                    :style="{ color: `color-mix(in srgb, ${ctrl.settings?.color || '#4b5563'} 70%, black)` }"
                  ) {{ ctrl.settings.hotkey }}

              .control-label(
                v-if="ctrl.settings?.label && ctrl.settings?.labelPosition === 'bottom'"
                :style="getControlLabelStyle(ctrl)"
              ) {{ ctrl.settings.label }}

    //- Прямоугольник выделения
    .absolute.border.border-blue-500.pointer-events-none(
      v-if="selectionState.isSelecting && selectionBox.width && selectionBox.height"
      class="bg-blue-500/10"
      :style="selectionBoxStyle"
    )

  //- Ресайз-хендлы для элементов
  template(v-if="selectedIds.length === 1 && !selectedPanelId")
    template(v-for="handle in resizeHandles" :key="handle.pos")
      .absolute.w-3.h-3.bg-white.border-2.border-blue-500.z-40(
        class="rounded-sm"
        :style="getHandleStyle(handle.pos, getSelectedElement())"
        :class="handle.cursor"
        @mousedown.stop="startResize($event, handle.pos, getSelectedElement())"
      )

  //- Ресайз-хендлы для панелей
  template(v-if="selectedPanelId && panels.find(p => p.id === selectedPanelId)")
    template(v-for="handle in resizeHandles" :key="'panel_'+handle.pos")
      .absolute.w-3.h-3.bg-white.border-2.border-purple-400.z-40(
        class="rounded-sm"
        :style="getHandleStyle(handle.pos, getSelectedPanel())"
        :class="handle.cursor"
        @mousedown.stop="startPanelResize($event, handle.pos, getSelectedPanel())"
      )
</template>

<script setup lang="ts">
// app/components/editor/EditorCanvas.vue — script
// [ИСПРАВЛЕНО v3]: стилевые функции аннотированы CSSProperties (строковые
// литералы 'flex'/'column'/'break-word' без контекстного типа расширяются
// до string и не проходят CSSProperties в биндингах :style).
import { ref, computed, onMounted } from 'vue'
import type { CSSProperties } from 'vue'
import type { SceneElement, SceneSettings, Panel, Control } from '../../types/scene'
import TrafficRoad from './TrafficRoad.vue'
import SimulatorPersonAvatar from '../simulator/PersonAvatar.vue'
import { PERSON_WIDTH, PERSON_HEIGHT, CAR_WIDTH, CAR_HEIGHT } from '~/utils/simulatorConstants'
import { generateSlidingGateSVG, generateWicketSVG } from '~/constants/library'

const props = defineProps<{
  elements: SceneElement[]
  panels: Panel[]
  settings: SceneSettings
  selectedIds: string[]
  selectedPanelId: string | null
  selectedCtrlId: string | null
  isSimulating: boolean
}>()

const emit = defineEmits<{
  (e: 'update:element', id: string, changes: Partial<SceneElement>): void
  (e: 'update:panel', id: string, changes: Partial<Panel>): void
  (e: 'update:control', panelId: string, controlId: string, changes: Partial<Control>): void
  (e: 'update:selection', ids: string[]): void
  (e: 'select-panel', id: string | null): void
  (e: 'select-control', panelId: string, controlId: string): void
  (e: 'delete-panel', id: string): void
}>()

const activeIntercoms = ref(new Set<any>())
const canvasRef = ref<HTMLElement | null>(null)
const RULER_SIZE = 20

const pressedControls = ref(new Set<string>())

onMounted(() => { canvasRef.value?.focus() })

const canvasWidth = computed(() => props.settings.width || 1280)
const canvasHeight = computed(() => props.settings.height || 720)

const sceneBackgroundStyle = computed(() => {
  const bgColor = props.settings.bgColor || '#ffffff'
  if (bgColor === '#ffffff' || bgColor === 'white') {
    return {
      backgroundColor: '#fff',
      backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 50%), linear-gradient(-45deg, transparent 75%, #f0f0f0 50%)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
    }
  }
  return { backgroundColor: bgColor }
})

const hTicks = computed(() => { const t: number[] = []; for (let i = 0; i <= canvasWidth.value; i += 10) t.push(i); return t })
const vTicks = computed(() => { const t: number[] = []; for (let i = 0; i <= canvasHeight.value; i += 10) t.push(i); return t })

const getTickStyle = (tick: number, orientation: 'h' | 'v') => {
  const isMajor = tick % 100 === 0
  const isMid = tick % 50 === 0
  let size = '4px'
  if (isMajor) size = '10px'
  else if (isMid) size = '7px'
  if (orientation === 'h') return { left: `${tick}px`, height: size, top: 0 }
  return { top: `${tick}px`, width: size, left: 0 }
}

const selectionMarker = computed(() => {
  if (props.selectedIds.length === 1) {
    const el = props.elements.find(e => props.selectedIds.includes(e.id))
    if (el) return { x: el.x, y: el.y, w: el.width || 100, h: el.height || 100 }
  }
  if (props.selectedPanelId) {
    const panel = props.panels.find(p => p.id === props.selectedPanelId)
    if (panel) return { x: panel.x || 0, y: panel.y || 0, w: panel.width || 200, h: panel.height || 150 }
  }
  return { x: null, y: null, w: null, h: null }
})

const getElSize = (el: any) => ({ w: el.width || 100, h: el.height || 100 })
const isSelected = (id: string) => props.selectedIds.includes(id)
const isPanelSelected = (id: string) => props.selectedPanelId === id
const isControlSelected = (panelId: string, controlId: string) => props.selectedPanelId === panelId && props.selectedCtrlId === controlId
const isGateElement = (el: any) => el.category === 'gate' || el.category === 'barrier' || el.type === 'gate'

const getElementStyle = (el: any) => {
  const { w, h } = getElSize(el)
  return { left: `${el.x}px`, top: `${el.y}px`, width: `${w}px`, height: `${h}px`, zIndex: el.zIndex }
}

const getDynamicSvg = (el: any): string => {
  if (!isGateElement(el)) return el.asset?.content || ''
  const s = el.settings || {}
  // [ИСПРАВЛЕНО] генераторы принимают 3 аргумента — 4-й (isOpen) не существует
  if (s.gateType === 'wicket') {
    return generateWicketSVG(el.width || 80, el.height || 120, s)
  }
  return generateSlidingGateSVG(el.width || 320, el.height || 120, s)
}

const getPointStyle = (el: any, pointPrefix: string, agentType: 'person' | 'car') => {
  const w = agentType === 'person' ? PERSON_WIDTH : CAR_WIDTH
  const h = agentType === 'person' ? PERSON_HEIGHT : CAR_HEIGHT
  const baseX = el.x + el.width / 2 - w / 2
  const baseY = el.y + el.height / 2 - h / 2
  const key = `${pointPrefix}${agentType.charAt(0).toUpperCase() + agentType.slice(1)}`
  const offX = el.settings?.[`${key}X`] || 0
  const offY = el.settings?.[`${key}Y`] || 0
  return {
    left: `${baseX + offX}px`,
    top: `${baseY + offY}px`,
    width: `${w}px`,
    height: `${h}px`
  }
}

const getPanelStyle = (panel: Panel) => ({
  left: `${panel.x || 0}px`, top: `${panel.y || 0}px`,
  width: `${panel.width || 200}px`, height: `${panel.height || 150}px`,
  backgroundColor: '#2d3748', border: '1px solid #4a5568', borderRadius: '6px', zIndex: 9999
})

// [ИСПРАВЛЕНО] CSSProperties-аннотации — литералы получают контекстный тип
const getControlStyle = (ctrl: Control): CSSProperties => {
  const s = ctrl.settings || {}
  const isLabelBottom = s.labelPosition === 'bottom' && s.label
  const baseHeight = s.height || 40
  return {
    width: `${s.width || 60}px`,
    ...(isLabelBottom ? { minHeight: `${baseHeight}px` } : { height: `${baseHeight}px` }),
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', margin: '4px'
  }
}

const getControlContentStyle = (ctrl: any): CSSProperties => {
  const s = ctrl.settings || {}
  const isGate = isGateControl(ctrl)
  if (isGate) {
    return {
      width: '100%',
      height: `${s.height || 40}px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: `${s.borderRadius || 4}px`,
      boxShadow: 'none',
      border: 'none'
    }
  }
  const convexShadow = 'inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -2px 5px rgba(0,0,0,0.4)'
  const glowShadow = s.glow ? `0 0 8px ${s.color}, ${convexShadow}` : convexShadow
  return {
    width: '100%',
    height: `${s.height || 40}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: s.labelAlign || 'center',
    backgroundColor: s.color || '#4b5563',
    borderRadius: `${s.borderRadius || 4}px`,
    boxShadow: glowShadow,
    border: '1px solid rgba(255, 255, 255, 0.15)'
  }
}

const getGateInnerStyle = (ctrl: any) => {
  const s = ctrl.settings || {}
  return { backgroundColor: s.color || '#4b5563' }
}

const getControlLabelStyle = (ctrl: any): CSSProperties => {
  const s = ctrl.settings || {}
  return {
    marginTop: `${s.labelMarginTop || 4}px`,
    fontSize: `${s.fontSize || 10}px`,
    color: s.textColor || '#ffffff',
    textAlign: s.labelAlign || 'center',
    backgroundColor: s.labelBg || 'transparent',
    padding: s.labelPadding || '2px 4px',
    borderRadius: s.labelBorderRadius || '2px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    maxWidth: '100%'
  }
}

// Drag state
// [ИСПРАВЛЕНО] panelStart аннотирован через `null as {...} | null`:
// `{ id: '', x: 0, y: 0 } | null` в позиции значения литерала —
// синтаксическая ошибка (TS18050) + каскад неверных типов на .id/.x/.y
const dragState = ref({
  isDragging: false,
  startX: 0,
  startY: 0,
  type: 'element' as 'element' | 'panel',
  targetId: '',
  elementsStart: [] as { id: string, x: number, y: number }[],
  panelStart: null as { id: string, x: number, y: number } | null
})
const startDrag = (e: MouseEvent, type: 'element' | 'panel', targetId?: string) => {
  dragState.value = { isDragging: true, startX: e.clientX, startY: e.clientY, type, targetId: targetId || '', elementsStart: [], panelStart: null }
  if (type === 'element') dragState.value.elementsStart = props.elements.filter(el => isSelected(el.id)).map(el => ({ id: el.id, x: el.x, y: el.y }))
  else if (type === 'panel' && targetId) { const panel = props.panels.find(p => p.id === targetId); if (panel) dragState.value.panelStart = { id: panel.id, x: panel.x || 0, y: panel.y || 0 } }
  window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', endDrag)
}
const onDrag = (e: MouseEvent) => {
  if (!dragState.value.isDragging) return
  const dx = e.clientX - dragState.value.startX; const dy = e.clientY - dragState.value.startY
  if (dragState.value.type === 'element') dragState.value.elementsStart.forEach(s => emit('update:element', s.id, { x: s.x + dx, y: s.y + dy }))
  else if (dragState.value.type === 'panel' && dragState.value.panelStart) emit('update:panel', dragState.value.panelStart.id, { x: dragState.value.panelStart.x + dx, y: dragState.value.panelStart.y + dy })
}
const endDrag = () => { dragState.value.isDragging = false; window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', endDrag) }

const handleElementMouseDown = (e: MouseEvent, id: string) => {
  if (props.selectedPanelId) emit('select-panel', null)
  if (e.shiftKey) { const sel = [...props.selectedIds]; const i = sel.indexOf(id); if (i > -1) sel.splice(i, 1); else sel.push(id); emit('update:selection', sel) }
  else if (!isSelected(id)) emit('update:selection', [id])
  startDrag(e, 'element')
}
const handlePanelMouseDown = (e: MouseEvent, panelId: string) => {
  if (!isPanelSelected(panelId)) { emit('select-panel', panelId); emit('update:selection', []) }
  startDrag(e, 'panel', panelId)
}

const resizeHandles = [
  { pos: 'nw', cursor: 'cursor-nw-resize' }, { pos: 'n', cursor: 'cursor-n-resize' }, { pos: 'ne', cursor: 'cursor-ne-resize' },
  { pos: 'w', cursor: 'cursor-w-resize' }, { pos: 'e', cursor: 'cursor-e-resize' },
  { pos: 'sw', cursor: 'cursor-sw-resize' }, { pos: 's', cursor: 'cursor-s-resize' }, { pos: 'se', cursor: 'cursor-se-resize' }
]
const resizeState = ref({ isResizing: false, handle: '', startX: 0, startY: 0, startEl: null as SceneElement | null })
const startResize = (e: MouseEvent, handle: string, el: SceneElement | null) => {
  if (!el) return
  resizeState.value = { isResizing: true, handle, startX: e.clientX, startY: e.clientY, startEl: { ...el } }
  window.addEventListener('mousemove', onResize); window.addEventListener('mouseup', endResize)
}
const onResize = (e: MouseEvent) => {
  if (!resizeState.value.isResizing || !resizeState.value.startEl) return
  const el = resizeState.value.startEl; const dx = e.clientX - resizeState.value.startX; const dy = e.clientY - resizeState.value.startY
  const { w: origW, h: origH } = getElSize(el); let newX = el.x, newY = el.y, newW = origW, newH = origH
  if (resizeState.value.handle.includes('e')) newW = Math.max(20, newW + dx)
  if (resizeState.value.handle.includes('w')) { newW = Math.max(20, newW - dx); newX = el.x + (origW - newW) }
  if (resizeState.value.handle.includes('s')) newH = Math.max(20, newH + dy)
  if (resizeState.value.handle.includes('n')) { newH = Math.max(20, newH - dy); newY = el.y + (origH - newH) }
  emit('update:element', el.id, { x: newX, y: newY, width: newW, height: newH })
}
const endResize = () => { resizeState.value.isResizing = false; window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', endResize) }

const panelResizeState = ref({ isResizing: false, handle: '', startX: 0, startY: 0, startPanel: null as Panel | null })
const startPanelResize = (e: MouseEvent, handle: string, panel: Panel | null) => {
  if (!panel) return
  panelResizeState.value = { isResizing: true, handle, startX: e.clientX, startY: e.clientY, startPanel: { ...panel } }
  window.addEventListener('mousemove', onPanelResize); window.addEventListener('mouseup', endPanelResize)
}
const onPanelResize = (e: MouseEvent) => {
  if (!panelResizeState.value.isResizing || !panelResizeState.value.startPanel) return
  const p = panelResizeState.value.startPanel; const dx = e.clientX - panelResizeState.value.startX; const dy = e.clientY - panelResizeState.value.startY
  let newX = p.x || 0, newY = p.y || 0, newW = p.width || 200, newH = p.height || 150
  if (panelResizeState.value.handle.includes('e')) newW = Math.max(100, newW + dx)
  if (panelResizeState.value.handle.includes('w')) { newW = Math.max(100, newW - dx); newX = (p.x || 0) + ((p.width || 200) - newW) }
  if (panelResizeState.value.handle.includes('s')) newH = Math.max(80, newH + dy)
  if (panelResizeState.value.handle.includes('n')) { newH = Math.max(80, newH - dy); newY = (p.y || 0) + ((p.height || 150) - newH) }
  emit('update:panel', p.id, { x: newX, y: newY, width: newW, height: newH })
}
const endPanelResize = () => { panelResizeState.value.isResizing = false; window.removeEventListener('mousemove', onPanelResize); window.removeEventListener('mouseup', endPanelResize) }

const selectionState = ref({ isSelecting: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
const startSelectionRect = (e: MouseEvent) => { selectionState.value = { isSelecting: true, startX: e.offsetX, startY: e.offsetY, currentX: e.offsetX, currentY: e.offsetY }; window.addEventListener('mousemove', onSelectionRect); window.addEventListener('mouseup', endSelectionRect) }
const onSelectionRect = (e: MouseEvent) => { if (!selectionState.value.isSelecting || !canvasRef.value) return; const r = canvasRef.value.getBoundingClientRect(); selectionState.value.currentX = e.clientX - r.left - RULER_SIZE; selectionState.value.currentY = e.clientY - r.top - RULER_SIZE }
const endSelectionRect = () => {
  if (selectionState.value.isSelecting) { const r = selectionBox.value; if (r.width > 5 && r.height > 5) { const ids = props.elements.filter(el => { const { w, h } = getElSize(el); return el.x < r.x + r.width && el.x + w > r.x && el.y < r.y + r.height && el.y + h > r.y }).map(el => el.id); emit('update:selection', ids) } }
  selectionState.value.isSelecting = false; window.removeEventListener('mousemove', onSelectionRect); window.removeEventListener('mouseup', endSelectionRect)
}
const selectionBox = computed(() => { const s = selectionState.value; return { x: Math.min(s.startX, s.currentX), y: Math.min(s.startY, s.currentY), width: Math.abs(s.currentX - s.startX), height: Math.abs(s.currentY - s.startY) } })
const selectionBoxStyle = computed(() => ({ left: `${selectionBox.value.x}px`, top: `${selectionBox.value.y}px`, width: `${selectionBox.value.width}px`, height: `${selectionBox.value.height}px` }))

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

const handleKeyDown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return

  const hotkeyStr = formatHotkey(e)
  if (hotkeyStr) {
    for (const panel of props.panels) {
      const ctrl = panel.controls?.find(c => c.settings?.hotkey?.toLowerCase() === hotkeyStr.toLowerCase())
      if (ctrl) {
        e.preventDefault()
        handleControlClick(panel.id, ctrl.id, ctrl)
        return
      }
    }
  }

  const step = e.shiftKey ? 1 : 10; let dx = 0, dy = 0
  if (e.key === 'ArrowLeft') dx = -step; if (e.key === 'ArrowRight') dx = step; if (e.key === 'ArrowUp') dy = -step; if (e.key === 'ArrowDown') dy = step
  if (dx !== 0 || dy !== 0) {
    e.preventDefault()
    props.selectedIds.forEach(id => { const el = props.elements.find(item => item.id === id); if (el) emit('update:element', id, { x: el.x + dx, y: el.y + dy }) })
    if (props.selectedPanelId) { const p = props.panels.find(panel => panel.id === props.selectedPanelId); if (p) emit('update:panel', p.id, { x: (p.x || 0) + dx, y: (p.y || 0) + dy }) }
  }
}

const getSelectedElement = () => props.elements.find(e => props.selectedIds.includes(e.id)) || null
const getSelectedPanel = () => props.panels.find(p => p.id === props.selectedPanelId) || null

// [ИСПРАВЛЕНО] справочник хендлов — константа с аннотацией Record
const HANDLE_POSITIONS = (l: number, t: number, r: number, b: number, w: number, h: number, o: number): Record<string, { left: string; top: string }> => ({
  nw: { left: `${l + o}px`, top: `${t + o}px` },
  ne: { left: `${r + o}px`, top: `${t + o}px` },
  sw: { left: `${l + o}px`, top: `${b + o}px` },
  se: { left: `${r + o}px`, top: `${b + o}px` },
  n: { left: `${l + w / 2 + o}px`, top: `${t + o}px` },
  s: { left: `${l + w / 2 + o}px`, top: `${b + o}px` },
  w: { left: `${l + o}px`, top: `${t + h / 2 + o}px` },
  e: { left: `${r + o}px`, top: `${t + h / 2 + o}px` }
})

const getHandleStyle = (pos: string, target: any): Record<string, string> => {
  if (!target) return {}
  const s = 12, o = -s / 2, x = target.x || 0, y = target.y || 0, w = target.width || 100, h = target.height || 100
  const l = RULER_SIZE + x, t = RULER_SIZE + y, r = RULER_SIZE + x + w, b = RULER_SIZE + y + h
  return HANDLE_POSITIONS(l, t, r, b, w, h, o)[pos] ?? {}
}

const handleCanvasMouseDown = (e: MouseEvent) => { if (!e.shiftKey) { emit('update:selection', []); emit('select-panel', null) } startSelectionRect(e) }

const isGateControl = (ctrl: any) => ctrl.settings?.actionType?.includes('gate') || ctrl.settings?.actionType?.includes('wicket')

const handleControlClick = (panelId: string, controlId: string, ctrl: any) => {
  emit('select-panel', panelId)
  emit('select-control', panelId, controlId)
  pressedControls.value.add(controlId)
  setTimeout(() => pressedControls.value.delete(controlId), 150)
}

const isUIElement = (el: any) => el.type && ['button-gate-open', 'button-gate-close', 'button-wicket-open', 'button-wicket-close', 'button-intercom', 'switch', 'indicator-light', 'indicator-led', 'display-text', 'shape-rect', 'shape-circle', 'shape-line'].includes(el.type)

const getUIElementStyle = (el: any) => {
  const s = el.settings || {}
  return {
    backgroundColor: s.color || '#4b5563',
    borderRadius: s.borderRadius ? `${s.borderRadius}%` : '4px',
    color: s.textColor || '#fff'
  }
}

const getSvgStyle = (el: any) => {
  const s = el.settings || {}
  const isWicket = s.gateType === 'wicket' || (el.width && el.width <= 60)
  const transform = isWicket ? 'scaleX(1)' : 'translateX(0px)'
  return { transform, transformOrigin: 'left center', color: el.asset?.color || 'white' }
}
</script>

<style scoped>
.editor-element :deep(svg) { width: 100%; height: 100%; display: block; object-fit: fill; }
.gate-wrapper { width: 100%; height: 100%; overflow: visible; }
.control-item { transition: all 0.1s ease; }
.control-item:hover { filter: brightness(1.1); }
.text-xxs { font-size: 0.65rem; line-height: 1; }
.control-content.pressed { transform: scale(0.92); filter: brightness(0.85); transition: all 0.08s ease; }
.gate-casing.pressed { transform: scale(0.92); filter: brightness(0.85); transition: all 0.08s ease; }
.is-3d-gate { background-color: #111827 !important; padding: 7px !important; border: none !important; box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.9), 1px 1px 3px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(0, 0, 0, 1) !important; }
.gate-casing { width: 100%; height: 100%; border-radius: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; border: 1px solid rgba(0, 0, 0, 0.5); box-shadow: inset 0 -3px 7px rgba(0, 0, 0, 0.7); }
.gate-casing::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, transparent 100%); pointer-events: none; z-index: 1; }
.glow-indicator { background-color: #ef4444; box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.6); animation: led-pulse 0.1s ease-in-out infinite; }
@keyframes led-pulse {
  0%, 100% { box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.9); }
}
</style>