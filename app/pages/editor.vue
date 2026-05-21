<!-- app/pages/editor.vue -->
<template lang="pug">
.editor-page.flex.flex-col.overflow-hidden.h-screen.w-screen.bg-gray-900.text-white(
  :style="showSimulatorPanel ? { paddingBottom: simulatorDockStyle.height } : {}"
  @keydown="handleGlobalUndo"
)
  //- Хедер редактора (сохранение, экспорт, запуск)
  EditorHeader(
    :name="sceneConfig.name"
    @save="handleSaveDb"
    @save-as="handleSaveAs"
    @export="handleExport"
    @import="importScene"
    @open="openLoadModal"
    @run="onToggleSimulator"
    @exit="$router.push('/')"
    @update:name="sceneConfig.name = $event"
  )

  .flex.flex-1.flex-col.min-h-0.overflow-hidden
    .flex.flex-row.flex-1.min-h-0.overflow-hidden
      
      //- Левая панель (Библиотека, Сцена, Панели управления)
      .flex.flex-col.overflow-hidden.flex-none.border-r.border-gray-700.relative.z-50(
        :style="{ width: leftAsideWidth + 'px' }"
      )
        EditorSidebarLeft.h-full.flex.flex-col(
          v-model="activeTab"
          :width="400"
          :panels="panels"
          :elements="elements"
          :selected-panel-id="selectedPanelId"
          :selected-ctrl-ids="selectedCtrlIds"
          :selected-element-id="selectedElementId"
          @add-element="handleAddElement"
          @select-element="handleSelectElement"
          @delete-element="handleDeleteElement"
          @move-element="handleMoveElement"
          @add-panel="handleAddPanel"
          @select-panel="handleSelectPanel"
          @delete-panel="handleDeletePanel"
          @add-control="handleAddControl"
          @delete-control="handleDeleteControl"
          @select-control="handleSelectControl"
          @reorder-control="handleReorderControl"
          @update-control-hotkey="handleUpdateHotkey"
        )

      //- Ресайзер левой панели
      .group.relative.z-50.w-1.cursor-col-resize.bg-gray-700(
        class="hover:w-2 hover:bg-blue-500 transition-all"
        @mousedown="startLeftResize"
      )
        .absolute.inset-y-0.-left-1.-right-1(class="group-hover:right-0 group-hover:left-0")

      //- Правая панель (Инспектор свойств)
      .flex-none.overflow-hidden(:style="{ width: inspectorWidth + 'px' }")
        EditorSidebarRight.h-full(
          :selected-element="selectedElement"
          :selected-control="selectedControl"
          :selected-control-panel-id="selectedControlPanelId"
          :settings="sceneConfig.settings"
          :scene-elements="sceneConfig.elements"
          @update:panel="handleUpdatePanel"
          @delete-panel="handleDeletePanel"
          @update:element="handleUpdateElement"
          @update:settings="safeUpdateSettings"
          @delete:element="deleteElement"
          @update:control="handleUpdateControl"
          @delete-control="handleDeleteControl"
          @execute-control="handleExecuteControl"
        )

      //- Ресайзер инспектора
      .group.relative.z-50.w-1.cursor-col-resize.bg-gray-700(
        class="hover:w-2 hover:bg-blue-500 transition-all"
        @mousedown="startMiddleResize"
      )

      //- Центральная область (Редактор скриптов)
      .flex-1.overflow-hidden.bg-gray-900
        ScenarioEditor.h-full(
          :scripts="sceneConfig.scripts"
          :selected-script-id="selectedScriptId"
          :scene-elements="sortedElements"
          @select:script="selectedScriptId = $event"
          @update:script="updateScript"
          @add:script="addScript" 
          @delete:script="deleteScript"
        )

    // Ресайзер нижней панели (превью)
    .h-1.cursor-row-resize.bg-gray-700(
      v-if="!showSimulatorPanel"
      class="hover:h-2 hover:bg-blue-500 transition-all"
      @mousedown="startVerticalResize"
    )

    //- Нижняя панель (Превью сцены)
    .flex.flex-none.items-center.p-1.overflow-auto.border-t.border-gray-700.bg-gray-600(
      v-if="!showSimulatorPanel"
      :style="{ height: bottomPanelHeight + 'px' }"
    )
      .canvas-wrapper.relative.shadow-2xl.justify-start(:style="canvasWrapperStyle")
        EditorCanvas(
          :elements="sortedElements"
          :panels="sceneConfig.panels"
          :settings="sceneConfig.settings"
          :selected-ids="selectedCanvasIds"
          :selected-panel-id="panelSelectedId"
          :selected-ctrl-id="controlSelectedId"
          :is-simulating="false" 
          @update:element="handleUpdateElement"
          @update:panel="handleUpdatePanel"
          @update:selection="handleSelectionUpdate"
          @select-panel="onSelectPanel"
          @select-control="onSelectControl"
          @delete-panel="onDeletePanel"
          @history:save="saveHistory"
        )

    //- Панель симулятора (Dock mode)
    transition(name="slide-up")
      .simulator-dock.fixed.bottom-0.left-0.right-0.bg-gray-900.border-t-2.border-gray-700.z-40(
        :style="simulatorDockStyle"
        v-if="showSimulatorPanel"
      )
        SimulatorWidget.h-full(
          ref="simulatorRef"
          v-if="showSimulatorPanel"
          :config="sceneConfig"
          :scripts="sceneConfig.scripts"
          :is-running="simulatorRunning"
          :sim_settings="simulatorSettings"
          @close="toggleSimulator"
        )

  //- Модальное окно загрузки сцены
  dialog.modal(:class="isLoadModalOpen ? 'modal-open' : ''")
    .modal-box.bg-gray-800.rounded-lg.p-6.max-w-md.w-full
      h3.text-lg.font-bold.mb-4 📂 Загрузить сцену
      .max-h-96.overflow-y-auto.mb-4
        div(v-if="savedScenes.length === 0" class="text-gray-400") Нет сохранённых сцен
        div(v-for="scene in savedScenes" :key="scene.id" class="py-2.border-b.border-gray-700.cursor-pointer.hover:bg-gray-700" @click="loadSelectedScene(scene.id)")
          .font-medium {{ scene.name }}
          .text-xs.text-gray-400 {{ new Date(scene.updatedAt || scene.createdAt).toLocaleString() }}
      .flex.justify-end
        button.btn.btn-sm(@click="isLoadModalOpen = false") Закрыть    
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useEditorLogic } from '../composables/useEditorLogic'
import { useConfig } from '~/composables/useConfig'
import EditorHeader from '../components/editor/EditorHeader.vue'
import EditorSidebarLeft from '../components/editor/EditorSidebarLeft.vue'
import EditorSidebarRight from '../components/editor/EditorSidebarRight.vue'
import ScenarioEditor from '../components/editor/ScenarioEditor.vue'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import SimulatorWidget from '../components/SimulatorWidget.vue'

definePageMeta({ layout: false })

// Ключ для localStorage (сохранение последнего состояния)
const STORAGE_KEY_SCENE = 'journal_kpp_last_scene'

// --- ЯДРО ЛОГИКИ ---
// useEditorLogic содержит основное состояние (sceneConfig), историю (undo) и операции CRUD.
const {
  sceneConfig, leftTab, selectedId, selectedCtrlIds, selectedScriptId,
  sortedElements, selectedElement, highlightTargetId,
  showSimulatorPanel, savedScenes, isLoadModalOpen,
  addElement, deleteElement, addPanel, deletePanel, selectPanel, addControl, deleteControl,
  handleSaveDb, openLoadModal, loadSelectedScene, importScene, 
  selectControl, initEditor, updateElement, updateScript,
  updateSettings, addScript, deleteScript, toggleSimulator
} = useEditorLogic()

/**
 * Безопасное обновление вложенных настроек.
 * Пример: key = 'traffic.intervalMin', val = 15
 */
const safeUpdateSettings = ({ key, val }: { key: string, val: any }) => {
  if (!sceneConfig.value) return
  
  const keys = key.split('.')
  let target: any = sceneConfig.value.settings
  
  // Проходим по цепочке ключей, создавая объекты, если их нет
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) target[keys[i]] = {}
    target = target[keys[i]]
  }
  
  target[keys[keys.length - 1]] = val
}

// --- ЛОКАЛЬНОЕ СОСТОЯНИЕ UI ---
const panelSelectedId = ref<string | null>(null)
const controlSelectedId = ref<string | null>(null)

// Обработчики выбора панелей и контролов
const onSelectPanel = (id: string | null) => {
  panelSelectedId.value = id
  if (selectPanel) selectPanel(id)
}

const onSelectControl = (panelId: string, controlId: string) => {
  panelSelectedId.value = panelId
  controlSelectedId.value = controlId
  if (selectControl) selectControl({ cId: controlId, pId: panelId })
}

const onDeletePanel = (id: string) => {
  if (deletePanel) deletePanel(id)
  // Сброс выделения, если удалена выбранная панель
  if (panelSelectedId.value === id) {
    panelSelectedId.value = null
    controlSelectedId.value = null
  }
}

const handleDeleteControl = (payload: { pId: string, cId: string }) => {
  const panel = sceneConfig.value.panels.find(p => p.id === payload.pId)
  if (panel && panel.controls) {
    const index = panel.controls.findIndex(c => c.id === payload.cId)
    if (index !== -1) panel.controls.splice(index, 1)
    if (controlSelectedId.value === payload.cId) controlSelectedId.value = null
    saveHistory()
  }
}

/**
 * Сохранить как: создает копию сцены в БД с новым именем.
 */
const handleSaveAs = async () => {
  const newName = prompt('Введите название новой сцены', sceneConfig.value.name + ' (копия)')
  if (!newName) return
  
  // Глубокое копирование
  const copy = JSON.parse(JSON.stringify(sceneConfig.value))
  copy.id = undefined // БД назначит новый ID
  copy.name = newName
  copy.createdAt = Date.now()
  copy.updatedAt = Date.now()
  
  try {
    // Предполагаем наличие функции saveScene в useEditorLogic или импортируем
    // const saved = await saveScene(copy)
    // Для примера используем handleSaveDb, если он умеет сохранять новый ID
    // В данном контексте просто эмулируем успех или используем доступный метод
    console.warn('[Editor] handleSaveAs requires saveScene implementation');
    alert(`Сцена «${newName}» подготовлена (требуется реализация сохранения в БД)`);
    
    // Опционально: переключиться на новую сцену
    // sceneConfig.value = copy
    // sceneConfig.value.id = saved.id
  } catch (err) {
    console.error(err)
    alert('Ошибка сохранения')
  }
}

/**
 * Экспорт сцены в JSON файл.
 */
const handleExport = () => {
  const dataStr = JSON.stringify(sceneConfig.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sceneConfig.value.name || 'scene'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Вычисляемый объект выбранного контрола (для Инспектора)
const selectedControl = computed(() => {
  if (!controlSelectedId.value || !panelSelectedId.value) return null
  const panel = sceneConfig.value.panels.find(p => p.id === panelSelectedId.value)
  if (!panel || !panel.controls) return null
  return panel.controls.find(c => c.id === controlSelectedId.value)
})

const selectedControlPanelId = computed(() => panelSelectedId.value)

// Обновление свойств контрола
const handleUpdateControl = (panelId: string, controlId: string, changes: any) => {
  const panel = sceneConfig.value.panels.find(p => p.id === panelId)
  if (panel && panel.controls) {
    const ctrl = panel.controls.find(c => c.id === controlId)
    if (ctrl) Object.assign(ctrl, changes)
    saveHistory()
  }
}

// --- СИМУЛЯТОР ---
const simulatorRunning = ref(true)
const simulatorRef = ref<any>(null)

const onToggleSimulator = () => {
  toggleSimulator()
}

const { config } = useConfig()

/**
 * [НАСТРОЙКА] Слияние глобальных и локальных настроек симулятора.
 * Глобальные (config.value.simulator) задаются в настройках приложения.
 * Локальные (sceneConfig.value.settings.traffic) задаются в Инспекторе сцены.
 */
const simulatorSettings = computed(() => {
  const globalDefaults = config.value.simulator || {}
  const sceneTraffic = sceneConfig.value?.settings?.traffic || {}
  return {
    ...globalDefaults,
    ...sceneTraffic
  }
})

// --- ЖИЗНЕННЫЙ ЦИКЛ ---
onMounted(() => {
  initEditor()
  // Восстановление размеров панелей из LocalStorage
  const savedInsWidth = localStorage.getItem('editor_inspector_width')
  if (savedInsWidth) inspectorWidth.value = Number(savedInsWidth)
  const savedBotHeight = localStorage.getItem('editor_bottom_height')
  if (savedBotHeight) bottomPanelHeight.value = Number(savedBotHeight)
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})

// --- РАЗМЕРЫ И ЛЕЙАУТ ---
const windowHeight = ref<number>(800)
const handleWindowResize = () => { windowHeight.value = window.innerHeight }
if (process.client) handleWindowResize()

const RULER_SIZE = 20
const WIDGET_HEADER_HEIGHT = 32

// Стиль контейнера превью
const canvasWrapperStyle = computed(() => {
  const w = sceneConfig.value?.settings?.width || 1280
  const h = sceneConfig.value?.settings?.height || 720
  return {
    width: `${w + RULER_SIZE}px`,
    height: `${h + RULER_SIZE}px`,
    backgroundColor: 'transparent' 
  }
})

// Высота док-панели симулятора (подстраивается под высоту сцены)
const simulatorDockStyle = computed(() => {
  const sceneHeight = sceneConfig.value?.settings?.height || 720
  const neededHeight = sceneHeight + WIDGET_HEADER_HEIGHT
  const maxAllowed = windowHeight.value - 50 
  return { height: `${Math.min(neededHeight, maxAllowed)}px` }
})

// Размеры панелей (реактивные)
const leftAsideWidth = ref(450)
const inspectorWidth = ref(300)
const bottomPanelHeight = ref(350)

// --- ИСТОРИЯ (UNDO) ---
const historyStack = ref<string[]>([])

const saveHistory = () => {
  const snapshot = JSON.stringify(sceneConfig.value)
  historyStack.value.push(snapshot)
  // [НАСТРОЙКА] Лимит истории Undo (50 шагов)
  if (historyStack.value.length > 50) historyStack.value.shift()
}

const undo = () => {
  if (historyStack.value.length === 0) return
  const snapshot = historyStack.value.pop()
  if (snapshot) sceneConfig.value = JSON.parse(snapshot)
}

// Глобальный обработчик Ctrl+Z
const handleGlobalUndo = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'я')) {
    e.preventDefault()
    undo()
  }
}

// --- УПРАВЛЕНИЕ ВЫДЕЛЕНИЕМ ---
const selectedCanvasIds = ref<string[]>([])

watch(selectedId, (newId) => {
  if (newId && !selectedCanvasIds.value.includes(newId)) {
    selectedCanvasIds.value = [newId]
  } else if (!newId && selectedCanvasIds.value.length === 1) {
    selectedCanvasIds.value = []
  }
})

const handleSelectionUpdate = (ids: string[]) => {
  selectedCanvasIds.value = ids
  if (ids.length === 1) selectedId.value = ids[0]
  else selectedId.value = null
}

// --- ОБРАБОТЧИКИ ЭЛЕМЕНТОВ ---
const handleUpdateElement = (id: string, changes: Partial<any>) => {
  const el = sceneConfig.value.elements.find(e => e.id === id)
  if (el) Object.assign(el, changes)
}

const handleMoveElement = (id: string, direction: number) => {
  saveHistory()
  const elements = sceneConfig.value.elements
  if (!elements) return
  const index = elements.findIndex(el => el.id === id)
  if (index === -1) return
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= elements.length) return
  const [elementToMove] = elements.splice(index, 1)
  elements.splice(newIndex, 0, elementToMove)
  // Обновляем z-index согласно порядку в массиве
  elements.forEach((el, i) => { el.zIndex = i })
}

/**
 * Добавление элемента на сцену.
 * Логика: добавить в массив -> настроить координаты и asset -> снять выделение с панелей.
 */
const handleAddElement = (item: any) => {
  leftTab.value = 'scene'
  saveHistory()
  localStorage.setItem(STORAGE_KEY_SCENE, JSON.stringify(sceneConfig.value))
  
  if (!sceneConfig.value) sceneConfig.value = {} as any
  if (!sceneConfig.value.elements) sceneConfig.value.elements = []
  
  const type = item.type || item 
  addElement(type) // Добавляет базовый элемент
  
  const newEl = sceneConfig.value.elements[sceneConfig.value.elements.length - 1]
  if (newEl) {
    const settings = sceneConfig.value.settings || { width: 1280, height: 720 }
    if (item.name) newEl.name = item.name
    if (item.category) newEl.category = item.category 
    if (item.settings) newEl.settings = { ...item.settings }
    
    // Специфичная логика для разных типов элементов
    if (item.type === 'person') {
      newEl.asset = { type: 'person', content: item.appearance }
      newEl.width = item.w || 50
      newEl.height = item.h || 100
    }
    else if (item.type === 'traffic_road') {
      newEl.asset = { type: 'traffic_road', content: null }
      if (!newEl.width) newEl.width = item.w || 200
      if (!newEl.height) newEl.height = item.h || 100
    } 
    else if (item.type === 'wicket') {
      newEl.type = 'wicket'
      newEl.category = 'gate'
      newEl.name = 'Калитка'
      newEl.asset = { type: 'svg', content: `<svg viewBox="0 0 60 40" width="100%" height="100%" ...>` }
      if (!newEl.width) newEl.width = 60
      if (!newEl.height) newEl.height = 40
    }
    else if (item.type === 'sliding_gate') {
      newEl.asset = { type: 'svg', content: `<svg viewBox="0 0 100 40" width="100%" height="100%" ...>` }
      if (!newEl.width) newEl.width = 100
      if (!newEl.height) newEl.height = 40
    }
    else if (['spawn_car', 'despawn_car', 'spawn_person', 'despawn_person'].includes(item.type)) {
      newEl.category = item.type
      newEl.asset = { type: 'svg', content: item.preview }
      if (!newEl.width) newEl.width = item.w || 40
      if (!newEl.height) newEl.height = item.h || 40
    }
    else if (item.svg) {
      newEl.asset = { type: 'svg', content: item.svg, color: item.color || '#fff' }
      if (!newEl.width) newEl.width = item.w || 100
      if (!newEl.height) newEl.height = item.h || 100
    } 
    else if (!newEl.asset || !newEl.asset.content) {
      // Дефолт: случайный цвет
      const color = '#' + Math.floor(Math.random()*16777215).toString(16)
      newEl.asset = { type: 'color', content: color }
      if (!newEl.width) newEl.width = item.w || 100
      if (!newEl.height) newEl.height = item.h || 100
    }
    
    // Центрирование нового элемента
    newEl.x = (settings.width / 2) - (newEl.width / 2)
    newEl.y = (settings.height / 2) - (newEl.height / 2)
    selectedId.value = newEl.id
    
    // Снимаем выделение с панелей управления
    panelSelectedId.value = null
    controlSelectedId.value = null
  }
}

// --- РЕСАЙЗЕРЫ ПАНЕЛЕЙ ---
const startLeftResize = (e: MouseEvent) => {
  e.preventDefault()
  const startX = e.clientX
  const startW = leftAsideWidth.value
  const onMove = (ev: MouseEvent) => { leftAsideWidth.value = Math.max(200, startW + (ev.clientX - startX)) }
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const startMiddleResize = (e: MouseEvent) => {
  e.preventDefault()
  const startX = e.clientX
  const startW = inspectorWidth.value
  const onMove = (ev: MouseEvent) => {
    inspectorWidth.value = Math.max(250, startW + (ev.clientX - startX))
    localStorage.setItem('editor_inspector_width', String(inspectorWidth.value))
  }
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const startVerticalResize = (e: MouseEvent) => {
  e.preventDefault()
  const startY = e.clientY
  const startH = bottomPanelHeight.value
  const onMove = (ev: MouseEvent) => {
    bottomPanelHeight.value = Math.max(200, startH + (startY - ev.clientY))
    localStorage.setItem('editor_bottom_height', String(bottomPanelHeight.value))
  }
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// --- ОБРАБОТЧИКИ ПАНЕЛЕЙ И ШАБЛОНА ---
const activeTab = computed({ get: () => leftTab.value, set: (val) => leftTab.value = val })
const panels = computed(() => sceneConfig.value?.panels || [])
const elements = computed(() => sortedElements.value)
const selectedPanelId = computed(() => panelSelectedId.value)
const selectedElementId = computed(() => selectedId.value)

const handleSelectElement = (id: string) => { selectedId.value = id }
const handleDeleteElement = (id: string) => { 
  deleteElement(id) 
  if (selectedId.value === id) selectedId.value = null
}

const handleAddPanel = () => { 
  addPanel() 
  if (sceneConfig.value.panels.length > 0) {
    panelSelectedId.value = sceneConfig.value.panels[sceneConfig.value.panels.length - 1].id
  }
}

const handleSelectPanel = (id: string) => { 
  panelSelectedId.value = id 
  controlSelectedId.value = null
}

const handleAddControl = (payload: any) => {
  if (!panelSelectedId.value) return
  const panel = sceneConfig.value.panels.find(p => p.id === panelSelectedId.value)
  if (!panel) return
  if (!panel.controls) panel.controls = []
  
  panel.controls.push({
    id: payload.id || `ctrl_${Date.now()}`,
    type: payload.type,
    x: payload.x || 10,
    y: payload.y || 10,
    settings: payload.settings || {}
  })
  saveHistory()
}

const handleSelectControl = (payload: { cId: string, pId: string }) => {
  panelSelectedId.value = payload.pId
  controlSelectedId.value = payload.cId
}

const handleUpdateHotkey = ({ pId, cId, hotkey }: { pId: string, cId: string, hotkey: string | null }) => {
  const panel = panels.value.find(p => p.id === pId)
  if (!panel) return
  const ctrl = panel.controls.find(c => c.id === cId)
  if (!ctrl) return
  if (hotkey === null) delete ctrl.settings.hotkey
  else ctrl.settings.hotkey = hotkey
}

const handleReorderControl = ({ panelId, fromId, toId }: { panelId: string, fromId: string, toId: string }) => {
  const panel = sceneConfig.value.panels.find(p => p.id === panelId)
  if (!panel || !panel.controls) return
  const fromIndex = panel.controls.findIndex(c => c.id === fromId)
  const toIndex = panel.controls.findIndex(c => c.id === toId)
  if (fromIndex === -1 || toIndex === -1) return
  const [movedControl] = panel.controls.splice(fromIndex, 1)
  panel.controls.splice(toIndex, 0, movedControl)
  sceneConfig.value.panels = [...sceneConfig.value.panels] 
  saveHistory()
}

const handleUpdatePanel = (panelId: string, changes: any) => {
  const panel = sceneConfig.value.panels.find(p => p.id === panelId)
  if (panel) {
    Object.assign(panel, changes)
    sceneConfig.value.panels = [...sceneConfig.value.panels]
    saveHistory()
  }
}

const handleDeletePanel = (panelId: string) => {
  sceneConfig.value.panels = sceneConfig.value.panels.filter(p => p.id !== panelId)
  if (panelSelectedId.value === panelId) {
    panelSelectedId.value = null
    controlSelectedId.value = null
  }
  saveHistory()
}

// ==========================================
// ГЛОБАЛЬНОЕ ВЫПОЛНЕНИЕ ГОРЯЧИХ КЛАВИШ ПУЛЬТОВ
// ==========================================

/**
 * Форматирование события клавиатуры в строку "Ctrl + Shift + A".
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
 * Глобальный перехватчик нажатий клавиш.
 * Ищет совпадение с hotkey у контролов панелей и выполняет действие.
 */
const handleGlobalHotkeyExecution = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  // Игнорируем ввод в поля
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  
  const hotkeyStr = formatHotkey(e)
  if (!hotkeyStr) return

  for (const panel of panels.value) {
    for (const ctrl of panel.controls || []) {
      if (ctrl.settings?.hotkey === hotkeyStr) {
        e.preventDefault()
        e.stopImmediatePropagation()
        console.log(`[Hotkey] Выполнение: ${hotkeyStr} -> ${ctrl.settings.label || ctrl.type}`)
        handleExecuteControl({ 
          panelId: panel.id, 
          controlId: ctrl.id, 
          settings: JSON.parse(JSON.stringify(ctrl.settings || {})) 
        })
        return
      }
    }
  }
}

onMounted(() => {
  // Вешаем с фазой capture: true, чтобы перехватывать до других слушателей
  window.addEventListener('keydown', handleGlobalHotkeyExecution, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalHotkeyExecution, { capture: true })
})

// ==========================================
// ОБРАБОТЧИК ВЫПОЛНЕНИЯ КОМАНД (КНОПКИ И ГОРЯЧИЕ КЛАВИШИ)
// ==========================================

/**
 * Выполнение действия контрола.
 * Если симулятор запущен -> прокидывает действие в него (открыть ворота, включить переговорник).
 * Если симулятор остановлен -> выводит предупреждение.
 */
const handleExecuteControl = ({ panelId, controlId, settings }: { panelId: string, controlId: string, settings: any }) => {
  if (!settings) return
  
  // Если симулятор открыт – передаём команду в него через refs
  if (showSimulatorPanel.value && simulatorRef.value) {
    simulatorRef.value.executeControlAction(controlId, settings.targetGateId, settings)
    return
  }
  
  console.warn(`[Пульт] Симулятор закрыт, действие "${settings.label || controlId}" не выполнено`)
}

// Отладочный watch
watch(() => sceneConfig.value, (newConfig) => {
  if (newConfig && showSimulatorPanel.value) {
    // console.log('=== Конфиг обновлен ===')
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.canvas-wrapper { box-shadow: 0 0 30px rgba(0,0,0,0.5); max-width: 100%; max-height: 100%; background-color: rgb(31, 41, 55); display: flex; }
.simulator-dock { outline: none; background-color: rgb(17 24 39); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>