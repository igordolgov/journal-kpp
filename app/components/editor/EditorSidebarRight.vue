<!-- app/components/editor/EditorSidebarRight.vue -->
<template lang='pug'>
aside.flex.flex-col.h-full.overflow-hidden.border-l.border-gray-700.bg-gray-900(
  class="min-w-0"
)
  //- ШАПКА
  .flex.h-8.items-center.justify-between.border-b.border-gray-700.bg-gray-800.flex-shrink-0(
    class="px-3"
  )
    .flex.items-center(
      class="gap-4 min-w-0"
    )
      span.text-base(
        v-if="selectedElement"
      ) {{ getElementIcon(selectedElement) }}
      span.text-base(
        v-else-if="selectedControl"
      ) 🎛️
      span.text-base(
        v-else-if="selectedPanel"
      ) 📟
      span.text-base(
        v-else
      ) ⚙️
      span.text-sm.font-semibold.truncate(
        v-if="selectedElement"
      ) {{ selectedElement.name || 'Элемент' }}
      span.text-sm.font-semibold.truncate(
        v-else-if="selectedControl"
      ) {{ selectedControl.settings?.label || selectedControl.type }}
      span.text-sm.font-semibold.truncate(
        v-else-if="selectedPanel"
      ) {{ selectedPanel.title || 'Панель' }}
      span.text-sm.font-semibold.truncate(
        v-else
      ) Сцена

    button.btn.btn-ghost.btn-xs.text-red-400.w-7.h-7.p-0(
      v-if="selectedElement"
      @click="$emit('delete:element', selectedElement.id)"
      title="Удалить"
    ) 🗑️

    button.btn.btn-ghost.btn-xs.text-red-400.w-7.h-7.p-0(
      v-else-if="selectedPanel && !selectedControl"
      @click="$emit('delete-panel', selectedPanel.id)"
      title="Удалить"
    ) 🗑️

  //- КОНТЕНТ
  .flex-1.text-xs(
    class="space-y-4 px-3 py-3 min-h-0 overflow-x-hidden overflow-y-auto"
  )
    //- ==========================================
    //- ЭЛЕМЕНТ СЦЕНЫ
    //- ==========================================
    template(v-if="selectedElement")
      //- Секция: Основное
      section
        .section-title Основное
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Имя
            input.field-input(
              type="text"
              :value="selectedElement.name"
              @input="handleInput('name', evValue($event))"
            )
          .field
            label.field-label Роль
            select.field-input(
              :value="selectedElement.type"
              @change="handleInput('type', evValue($event))"
            )
              option(value="element") Обычный
              option(value="actor") Актер
              option(value="gate") Ворота
              option(value="zone") Зона

      //- Секция: Позиция и размер
      section
        .section-title Позиция и размер
        .grid.grid-cols-2(
          class="gap-2"
        )
          .field
            label.field-label X
            input.field-input(
              type="number"
              :value="selectedElement.x"
              @input="handleInput('x', evNumber($event))"
            )
          .field
            label.field-label Y
            input.field-input(
              type="number"
              :value="selectedElement.y"
              @input="handleInput('y', evNumber($event))"
            )
          .field
            label.field-label Ширина
            input.field-input(
              type="number"
              :value="selectedElement.width"
              @input="onWidthChange"
            )
          .field
            label.field-label Высота
            input.field-input(
              type="number"
              :value="selectedElement.height"
              @input="onHeightChange"
            )

        .grid.grid-cols-6(
          class="gap-4 mt-4"
        )
          .field
            label.field-label Z-уровень
            input.field-input(
              type="number"
              :value="selectedElement.zIndex || 0"
              @input="handleInput('zIndex', evNumber($event))"
            )
          .field
            label.field-label Пропорции
            button.lock-btn.w-full(
              :class="aspectRatioLocked ? 'active' : ''"
              @click="toggleLock"
            ) {{ aspectRatioLocked ? '🔒 Сохранять' : '🔓 Свободно' }}

        .grid.grid-cols-6.items-center(
          class="gap-4 mt-4"
        )
          button.z-btn.flex-0(
            @click="handleZIndex(-10)"
            title="На задний план"
          ) ⬇ Назад
          button.z-btn.flex-0(
            @click="handleZIndex(10)"
            title="На передний план"
          ) ⬆ Вперёд

      //- ==========================================
      //- ВОРОТА / КАЛИТКА
      //- ==========================================
      template(v-if="isGateElement")
        section
          .section-title Ворота / Калитка
          .grid.grid-cols-6(
            class="gap-4"
          )
            .field
              label.field-label Тип
              select.field-input(
                :value="selectedElement.settings?.gateType"
                @change="updateGateType(evValue($event))"
              )
                option(value="") — Выберите —
                option(value="sliding") Откатные
                option(value="wicket") Распашная
            .field
              label.field-label Статус
              button.btn.w-full.h-full(
                class="h-6 text-xs"
                :class="selectedElement.settings?.isOpen ? 'btn-success' : 'btn-warning'"
                @click="toggleGateOpen"
              ) {{ selectedElement.settings?.isOpen ? '🔓 Открыты' : '🔒 Закрыты' }}

          .grid.grid-cols-6(
            class="gap-4 mt-4"
          )
            .field
              label.field-label Открытие (с)
              input.field-input(
                type="number"
                step="0.5"
                min="0.5"
                :value="selectedElement.settings?.openDuration || 2"
                @input="updateGateDuration('open', evNumber($event))"
              )
            .field
              label.field-label Закрытие (с)
              input.field-input(
                type="number"
                step="0.5"
                min="0.5"
                :value="selectedElement.settings?.closeDuration || 2"
                @input="updateGateDuration('close', evNumber($event))"
              )

        section
          .section-title Внешний вид
          .grid.grid-cols-6(
            class="gap-4"
          )
            .field
              label.field-label Фон
              input.color-input(
                type="color"
                :value="selectedElement.settings?.frameColor || '#000000'"
                @input="updateGateStyle('frameColor', evValue($event))"
              )
            .field
              label.field-label Прутки
              input.color-input(
                type="color"
                :value="selectedElement.settings?.barColor || '#9ca3af'"
                @input="updateGateStyle('barColor', evValue($event))"
              )
            .field
              label.field-label Толщина
              input.field-input(
                type="number"
                min="1"
                max="20"
                :value="selectedElement.settings?.barWidth || 4"
                @input="updateGateStyle('barWidth', evNumber($event))"
              )
            .field
              label.field-label Шаг
              input.field-input(
                type="number"
                min="4"
                max="50"
                :value="selectedElement.settings?.barSpacing || 12"
                @input="updateGateStyle('barSpacing', evNumber($event))"
              )

          .field.mt-2
            label.field-label Прозрачность
            input.field-input(
              type="number"
              step="0.1"
              min="0.1"
              max="1"
              :value="selectedElement.settings?.barOpacity ?? 0.9"
              @input="updateGateStyle('barOpacity', evNumber($event))"
            )

          template(v-if="isWicketGate")
            .grid.grid-cols-6(
              class="gap-4 mt-4"
            )
              .field
                label.field-label Цвет ручки
                input.color-input(
                  type="color"
                  :value="selectedElement.settings?.handleColor || '#d97706'"
                  @input="updateGateStyle('handleColor', evValue($event))"
                )
              .field
                label.field-label Ширина ручки
                input.field-input(
                  type="number"
                  min="2"
                  max="20"
                  :value="selectedElement.settings?.handleWidth || 8"
                  @input="updateGateStyle('handleWidth', evNumber($event))"
                )
            .field.mt-2
              label.field-label Высота ручки
              input.field-input(
                type="number"
                min="4"
                max="40"
                :value="selectedElement.settings?.handleHeight || 16"
                @input="updateGateStyle('handleHeight', evNumber($event))"
              )

        section(
          v-if="showCarTrajectory || showPersonTrajectory"
        )
          .section-title Точки траектории
          TrajectoryEditor(
            :settings="selectedElement.settings"
            :gateType="selectedElement.settings?.gateType"
            @update:settings="onTrajectoryUpdate"
          )

    //- ==========================================
    //- ПАНЕЛЬ
    //- ==========================================
    template(v-else-if="selectedPanel && !selectedControl")
      section
        .section-title Основное
        .field
          label.field-label Заголовок
          input.field-input(
            type="text"
            :value="selectedPanel.title"
            @input="updatePanel('title', evValue($event))"
          )

      section
        .section-title Оформление
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Z-уровень
            input.field-input(
              type="number"
              :value="selectedPanel.zIndex || 100"
              @input="updatePanel('zIndex', evNumber($event))"
            )
          .field
            label.field-label Фон
            input.color-input(
              type="color"
              :value="selectedPanel.bgColor || '#2d3748'"
              @input="updatePanel('bgColor', evValue($event))"
            )
        .field.mt-2
          label.field-label Рамка
          input.color-input(
            type="color"
            :value="selectedPanel.borderColor || '#4a5568'"
            @input="updatePanel('borderColor', evValue($event))"
          )

      .hint Перетаскивайте углы панели на холсте.

    //- ==========================================
    //- КОНТРОЛ
    //- ==========================================
    template(v-else-if="selectedControl")
      section
        .section-title Информация
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Тип
            input.field-input(
              type="text"
              :value="selectedControl.type"
              disabled
            )
          .field
            label.field-label ID
            input.field-input(
              type="text"
              :value="selectedControl.id"
              disabled
            )

      section
        .section-title Горячая клавиша
        .flex.items-center(
          class="gap-4"
        )
          button.hotkey-btn.flex-1(
            :class="isListeningHotkey ? 'listening' : ''"
            @click="startListeningHotkey"
            @dblclick.prevent
          )
            span(v-if="isListeningHotkey") Нажмите клавишу...
            span(v-else-if="selectedControl?.settings?.hotkey") {{ selectedControl.settings.hotkey }}
            span(v-else) Не задана
          button.btn.btn-ghost.btn-xs.text-red-400.w-7.h-7.p-0(
            v-if="selectedControl?.settings?.hotkey && !isListeningHotkey"
            @click="clearHotkey"
            title="Сбросить"
          ) ✕

      section
        .section-title Внешний вид
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Цвет
            input.color-input(
              type="color"
              v-model="controlColor"
            )
          .field
            label.field-label Ширина
            input.field-input(
              type="number"
              v-model="controlWidth"
              min="20"
            )
          .field
            label.field-label Высота
            input.field-input(
              type="number"
              v-model="controlHeight"
              min="20"
            )
          .field
            label.field-label Скругление
            input.field-input(
              type="number"
              v-model="controlBorderRadius"
              min="0"
              max="50"
            )
          .field
            label.field-label Шрифт
            input.field-input(
              type="number"
              v-model="controlFontSize"
              min="8"
              max="24"
            )
          .field
            label.field-label Цвет текста
            input.color-input(
              type="color"
              v-model="controlTextColor"
            )

      section
        .section-title Надпись
        .field
          label.field-label Текст
          input.field-input(
            type="text"
            v-model="controlLabel"
          )

        .grid.grid-cols-6(
          class="gap-4 mt-4"
        )
          .field
            label.field-label Позиция
            select.field-input(
              v-model="controlLabelPosition"
            )
              option(value="inside") Внутри
              option(value="bottom") Снизу
          .field
            label.field-label Выравнивание
            select.field-input(
              v-model="controlLabelAlign"
            )
              option(value="left") Слева
              option(value="center") Центр
              option(value="right") Справа

        .grid.grid-cols-6(
          class="gap-4 mt-4"
        )
          .field
            label.field-label Фон
            input.field-input(
              type="text"
              v-model="controlLabelBg"
              placeholder="—"
            )
          .field
            label.field-label Padding
            input.field-input(
              type="text"
              v-model="controlLabelPadding"
              placeholder="—"
            )

        .field.mt-2
          label.field-label Отступ сверху
          input.field-input(
            type="number"
            v-model="controlLabelMarginTop"
            min="0"
            max="20"
          )

      section
        .section-title Цель
        select.field-input.w-full(
          v-model="controlTargetGateId"
        )
          option(value="") — Не выбрано —
          option(
            v-for="gate in availableGates"
            :key="gate.id"
            :value="gate.id"
          ) {{ getGateDisplayName(gate) }}

      button.btn.btn-sm.btn-error.w-full.mt-2(
        class="h-8 text-sm"
        @click="$emit('delete-control', { pId: selectedControlPanelId, cId: selectedControl.id })"
      ) Удалить кнопку

    //- ==========================================
    //- СЦЕНА
    //- ==========================================
    template(v-else)
      section
        .section-title Размер холста
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Ширина
            input.field-input(
              type="number"
              :value="settings.width"
              @input="$emit('update:settings', { key: 'width', val: evNumber($event) })"
            )
          .field
            label.field-label Высота
            input.field-input(
              type="number"
              :value="settings.height"
              @input="$emit('update:settings', { key: 'height', val: evNumber($event) })"
            )

        .field.mt-2
          label.field-label Цвет фона
          input.color-input(
            type="color"
            :value="settings.bgColor"
            @input="$emit('update:settings', { key: 'bgColor', val: evValue($event) })"
          )

      section
        .section-title Трафик (симуляция)
        .grid.grid-cols-6(
          class="gap-4"
        )
          .field
            label.field-label Макс. агентов
            input.field-input(
              type="number"
              min="1"
              max="100"
              :value="settings.traffic?.maxAgents ?? 4"
              @input="updateTraffic('maxAgents', evNumber($event))"
            )
          .field
            label.field-label Ширина машин
            input.field-input(
              type="number"
              min="50"
              :value="settings.traffic?.carWidth || 160"
              @input="updateTraffic('carWidth', evNumber($event))"
            )
          .field
            label.field-label Высота машин
            input.field-input(
              type="number"
              min="30"
              :value="settings.traffic?.carHeight"
              @input="updateTraffic('carHeight', evNumber($event))"
            )

        .grid.grid-cols-6(
          class="gap-4 mt-4"
        )
          .field
            label.field-label Люди: интервал от
            input.field-input(
              type="number"
              min="1"
              :value="settings.traffic?.spawnIntervalMin || 10"
              @input="updateTraffic('spawnIntervalMin', evNumber($event))"
            )
          .field
            label.field-label Люди: до
            input.field-input(
              type="number"
              min="1"
              :value="settings.traffic?.spawnIntervalMax || 30"
              @input="updateTraffic('spawnIntervalMax', evNumber($event))"
            )

        .grid.grid-cols-6(
          class="gap-4 mt-4"
        )
          .field
            label.field-label Авто: интервал от
            input.field-input(
              type="number"
              min="1"
              :value="settings.traffic?.carSpawnIntervalMin || 5"
              @input="updateTraffic('carSpawnIntervalMin', evNumber($event))"
            )
          .field
            label.field-label Авто: до
            input.field-input(
              type="number"
              min="1"
              :value="settings.traffic?.carSpawnIntervalMax || 15"
              @input="updateTraffic('carSpawnIntervalMax', evNumber($event))"
            )
</template>

<script setup lang="ts">
// app/components/editor/EditorSidebarRight.vue — script
// Инспектор редактора: свойства элемента / панели / контрола / сцены.
// [ИСПРАВЛЕНО] evValue/evNumber: $event.target в шаблоне типизируется как
// EventTarget | null без .value — все обработчики переведены на хелперы.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { SceneElement, SceneSettings, Control, Panel } from '../../types/scene'
import TrajectoryEditor from './TrajectoryEditor.vue'

const props = withDefaults(defineProps<{
  selectedElement: SceneElement | null
  selectedControl?: Control | null
  selectedControlPanelId?: string | null
  selectedPanelId?: string | null
  panels?: Panel[]
  settings: SceneSettings
  sceneElements: SceneElement[]
}>(), {
  panels: () => []
})

const emit = defineEmits([
  'update:element', 'update:settings', 'delete:element',
  'update:control', 'delete-control',
  'update:panel', 'delete-panel', 'execute-control'
])

// --- Хелперы событий (замена $event.target.value из шаблона) ---
// Читает строковое значение из события input/change
const evValue = (e: Event): string => (e.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
// Читает числовое значение из события
const evNumber = (e: Event): number => Number(evValue(e))

const isListeningHotkey = ref(false)

const startListeningHotkey = () => {
  isListeningHotkey.value = !isListeningHotkey.value
}

const clearHotkey = () => {
  if (!props.selectedControl || !props.selectedControlPanelId) return
  const newSettings = { ...props.selectedControl.settings }
  delete newSettings.hotkey
  emit('update:control', props.selectedControlPanelId, props.selectedControl.id, { settings: newSettings })
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
  const hotkeyStr = formatHotkey(e)
  if (isListeningHotkey.value) {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.key === 'Escape') {
      isListeningHotkey.value = false
      return
    }
    if (hotkeyStr) {
      updateControlSetting('hotkey', hotkeyStr)
      isListeningHotkey.value = false
    }
    return
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
})

const selectedPanel = computed(() => props.panels?.find(p => p.id === props.selectedPanelId) || null)
const isGateElement = computed(() => props.selectedElement?.category === 'gate' || props.selectedElement?.type === 'gate')
const isSlidingGate = computed(() => props.selectedElement?.settings?.gateType === 'sliding')
const isWicketGate = computed(() => props.selectedElement?.settings?.gateType === 'wicket')
const showPersonTrajectory = computed(() => isWicketGate.value)
const showCarTrajectory = computed(() => isSlidingGate.value)

const getElementIcon = (el: SceneElement | null): string => {
  if (!el) return '📦'
  if (el.type === 'person' || el.category === 'human') return '👤'
  if (el.category === 'gate' || el.type === 'gate') return '🚪'
  if (el.type === 'traffic_road') return '🛣️'
  if (el.category === 'spawn_car' || el.category === 'despawn_car') return '🚗'
  if (el.category === 'spawn_person' || el.category === 'despawn_person') return '🚶'
  return '📦'
}

const aspectRatioLocked = ref(false)
let currentRatio: number | null = null

const toggleLock = () => {
  aspectRatioLocked.value = !aspectRatioLocked.value
  if (aspectRatioLocked.value && props.selectedElement) {
    // [ИСПРАВЛЕНО] width/height опциональны — явный fallback до арифметики
    const w = props.selectedElement.width ?? 0
    const h = props.selectedElement.height ?? 0
    currentRatio = (h > 0) ? w / h : 1
  } else currentRatio = null
}

const onWidthChange = (e: Event) => {
  if (!props.selectedElement) return
  const newWidth = evNumber(e)
  const changes: any = { width: newWidth }
  if (aspectRatioLocked.value && currentRatio !== null) {
    let newHeight = Math.round(newWidth / currentRatio)
    if (newHeight < 1) newHeight = 1
    changes.height = newHeight
    currentRatio = newWidth / newHeight
  }
  emit('update:element', props.selectedElement.id, changes)
}

const onHeightChange = (e: Event) => {
  if (!props.selectedElement) return
  const newHeight = evNumber(e)
  const changes: any = { height: newHeight }
  if (aspectRatioLocked.value && currentRatio !== null) {
    let newWidth = Math.round(newHeight * currentRatio)
    if (newWidth < 1) newWidth = 1
    changes.width = newWidth
    currentRatio = newWidth / newHeight
  }
  emit('update:element', props.selectedElement.id, changes)
}

const handleInput = (key: string, value: any) => {
  if (props.selectedElement) emit('update:element', props.selectedElement.id, { [key]: value })
}

const handleZIndex = (step: number) => {
  if (!props.selectedElement) return
  const newZ = (props.selectedElement.zIndex || 0) + step
  emit('update:element', props.selectedElement.id, { zIndex: newZ })
}

const updateGateType = (type: string) => {
  if (props.selectedElement) emit('update:element', props.selectedElement.id, { settings: { ...props.selectedElement.settings, gateType: type } })
}

const toggleGateOpen = () => {
  if (props.selectedElement) {
    const isOpen = !props.selectedElement.settings?.isOpen
    emit('update:element', props.selectedElement.id, { settings: { ...props.selectedElement.settings, isOpen } })
  }
}

const updateGateDuration = (type: 'open' | 'close', duration: number) => {
  if (!props.selectedElement) return
  const settings = { ...props.selectedElement.settings }
  if (type === 'open') settings.openDuration = duration
  else settings.closeDuration = duration
  emit('update:element', props.selectedElement.id, { settings })
}

const updateGateStyle = (key: string, value: any) => {
  if (!props.selectedElement) return
  const settings = { ...props.selectedElement.settings, [key]: value }
  emit('update:element', props.selectedElement.id, { settings })
}

const onTrajectoryUpdate = (newSettings: Record<string, any>) => {
  if (!props.selectedElement) return
  emit('update:element', props.selectedElement.id, { settings: newSettings })
}

const updatePanel = (key: string, value: any) => {
  if (!props.selectedPanelId) return
  emit('update:panel', props.selectedPanelId, { [key]: value })
}

const controlLabel = computed({ get: () => props.selectedControl?.settings?.label || '', set: (val) => updateControlSetting('label', val) })
const controlColor = computed({ get: () => props.selectedControl?.settings?.color || '#3b82f6', set: (val) => updateControlSetting('color', val) })
const controlWidth = computed({ get: () => props.selectedControl?.settings?.width || 60, set: (val) => updateControlSetting('width', Number(val)) })
const controlHeight = computed({ get: () => props.selectedControl?.settings?.height || 40, set: (val) => updateControlSetting('height', Number(val)) })
const controlBorderRadius = computed({ get: () => props.selectedControl?.settings?.borderRadius || 4, set: (val) => updateControlSetting('borderRadius', Number(val)) })
const controlTargetGateId = computed({ get: () => props.selectedControl?.settings?.targetGateId || '', set: (val) => updateControlSetting('targetGateId', val || undefined) })
const controlLabelPosition = computed({ get: () => props.selectedControl?.settings?.labelPosition || 'inside', set: (val) => updateControlSetting('labelPosition', val) })
const controlFontSize = computed({ get: () => props.selectedControl?.settings?.fontSize || 10, set: (val) => updateControlSetting('fontSize', Number(val)) })
const controlTextColor = computed({ get: () => props.selectedControl?.settings?.textColor || '#ffffff', set: (val) => updateControlSetting('textColor', val) })
const controlLabelAlign = computed({ get: () => props.selectedControl?.settings?.labelAlign || 'center', set: (val) => updateControlSetting('labelAlign', val) })
const controlLabelBg = computed({ get: () => props.selectedControl?.settings?.labelBg || 'transparent', set: (val) => updateControlSetting('labelBg', val) })
const controlLabelPadding = computed({ get: () => props.selectedControl?.settings?.labelPadding || '2px 4px', set: (val) => updateControlSetting('labelPadding', val) })
const controlLabelMarginTop = computed({ get: () => props.selectedControl?.settings?.labelMarginTop || 4, set: (val) => updateControlSetting('labelMarginTop', Number(val)) })

const updateControlSetting = (key: string, value: any) => {
  if (!props.selectedControl || !props.selectedControlPanelId) return
  const newSettings = { ...props.selectedControl.settings, [key]: value }
  emit('update:control', props.selectedControlPanelId, props.selectedControl.id, { settings: newSettings })
}

const updateTraffic = (key: string, value: number) => {
  emit('update:settings', { key: `traffic.${key}`, val: value })
}

const availableGates = computed(() => props.sceneElements.filter(el => el.category === 'gate' || el.category === 'barrier' || el.type === 'gate'))

const getGateDisplayName = (gate: SceneElement) => {
  const typeName = gate.settings?.gateType === 'wicket' ? 'Калитка' : 'Ворота'
  if (gate.name) return `${typeName}: ${gate.name}`
  return `${typeName} (${gate.id.slice(-6)})`
}
</script>

<style scoped>
.text-xs {
  font-size: 12px;
  line-height: 1.3;
}

/* ==========================================
   ЗАГОЛОВКИ СЕКЦИЙ
   ========================================== */
.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

/* ==========================================
   ПОЛЯ (универсальный класс)
   ========================================== */
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.field-label {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.field-input {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #e5e7eb;
  outline: none;
  transition: border-color 0.15s;
  min-width: 0;
}
.field-input::-webkit-outer-spin-button,
.field-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.field-input:focus {
  border-color: #3b82f6;
}
.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==========================================
    ЦВЕТОВЫЕ ПОЛЯ
   ========================================== */
.color-input {
  width: 100%;
  height: 26px;
  padding: 0;
  border: 1px solid #374151;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: none; border-radius: 3px; }

/* ==========================================
    КНОПКИ
   ========================================== */
.z-btn {
  flex: 1;
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 4px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.z-btn:hover {
  background: #374151;
  color: #e5e7eb;
}
.z-btn:active {
  transform: scale(0.97);
}

.lock-btn {
  height: 26px;
  padding: 0;
  font-size: 12px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock-btn:hover {
  background: #374151;
  color: #e5e7eb;
}
.lock-btn.active {
  color: #3b82f6;
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.hotkey-btn {
  height: 26px;
  padding: 0 10px;
  font-family: monospace;
  font-size: 12px;
  background: #1f2937;
  border: 1px solid #4b5563;
  border-radius: 4px;
  color: #e5e7eb;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}
.hotkey-btn:hover {
  border-color: #6b7280;
}
.hotkey-btn.listening {
  border-color: #f59e0b;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ==========================================
    ПОДСКАЗКА
   ========================================== */
.hint {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
  padding: 8px 10px;
  background: rgba(31, 41, 55, 0.5);
  border-radius: 4px;
  margin-top: 0.5rem;
  line-height: 1.4;
}

/* ==========================================
    СКРОЛЛБАР
   ========================================== */
aside ::-webkit-scrollbar {
  width: 4px;
}
aside ::-webkit-scrollbar-track {
  background: transparent;
}
aside ::-webkit-scrollbar-thumb {
  background: #ffffff10;
  border-radius: 2px;
}
aside ::-webkit-scrollbar-thumb:hover {
  background: #ffffff20;
}
</style>