// app/composables/useEditorLogic.ts
// Назначение: ядро редактора сцен — состояние, история (undo), CRUD элементов,
// панелей, контролов и сценариев; автосохранение в localStorage.
// [UI/UX] alert() заменены на тосты (useToast) — сохранение/загрузка/импорт
// больше не блокируют поток.

import { ref, computed, watch } from 'vue'
import { useSceneBuilder } from './useSceneBuilder'
import { useToast } from './useToast'
import type { SceneConfig, SceneElement, Panel, Script } from '../types/scene'

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const STORAGE_KEY_SCENE = 'journal_kpp_last_scene'
const STORAGE_KEY_SCRIPT = 'journal_kpp_last_script_id'

// Эталонная сцена: источник дефолтов для normalizeScene
const defaultScene: SceneConfig = {
  id: 'scene_main',
  name: 'Новая Сцена',
  settings: { width: 1280, height: 720, bgColor: '#e5e7eb', borderColor: '#94a3b8' },
  elements: [],
  panels: [],
  scripts: [],
  variables: [],
  trafficConfig: {},
  lifeConfig: {}
}

// Нормализация сырой сцены до полной структуры SceneConfig
const normalizeScene = (raw: any): SceneConfig => {
  const base = JSON.parse(JSON.stringify(defaultScene)) as SceneConfig
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    elements: Array.isArray(raw.elements) ? raw.elements : [],
    panels: Array.isArray(raw.panels) ? raw.panels : [],
    scripts: Array.isArray(raw.scripts) ? raw.scripts : [],
    variables: Array.isArray(raw.variables) ? raw.variables : [],
    trafficConfig: raw.trafficConfig ?? {},
    lifeConfig: raw.lifeConfig ?? {}
  }
}

export const useEditorLogic = () => {
  const { saveScene, listScenes, loadScene } = useSceneBuilder()
  const toast = useToast()

  const sceneConfig = ref<SceneConfig>(JSON.parse(JSON.stringify(defaultScene)))

  // --- State ---
  const selectedId = ref<string | null>(null)
  const selectedPanelId = ref<string | null>(null)
  const selectedCtrlIds = ref<string[]>([])
  const selectedScriptId = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)

  // 'scene' вместо 'elements' — вкладка «Объекты» активна сразу
  const leftTab = ref('scene')

  const highlightTargetId = ref<string | null>(null)
  const savedScenes = ref<any[]>([])
  const isLoadModalOpen = ref(false)

  const showSimulatorPanel = ref(false)
  const toggleSimulator = () => { showSimulatorPanel.value = !showSimulatorPanel.value }
  const simulatorKey = ref(0)

  // --- ИСТОРИЯ (UNDO) ---
  const historyStack = ref<string[]>([])
  const MAX_HISTORY = 50 // [НАСТРОЙКА] глубина undo

  const saveHistory = () => {
    const snapshot = JSON.stringify(sceneConfig.value)
    historyStack.value.push(snapshot)
    if (historyStack.value.length > MAX_HISTORY) historyStack.value.shift()
  }

  const undo = () => {
    if (historyStack.value.length === 0) return
    const snapshot = historyStack.value.pop()!
    sceneConfig.value = JSON.parse(snapshot)
  }

  // --- COMPUTED ---
  const sortedElements = computed(() =>
    [...sceneConfig.value.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  )
  const selectedElement = computed(() => sceneConfig.value.elements.find(el => el.id === selectedId.value) || null)
  const selectedPanel = computed(() => sceneConfig.value.panels.find(p => p.id === selectedPanelId.value) || null)
  const selectedCtrl = computed(() => {
    if (!selectedCtrlIds.value.length) return null
    const ctrlId = selectedCtrlIds.value[0]
    for (const panel of sceneConfig.value.panels) {
      const found = panel.controls.find(c => c.id === ctrlId)
      if (found) return found
    }
    return null
  })
  const currentScript = computed(() => sceneConfig.value.scripts.find(s => s.id === selectedScriptId.value) || null)

  // --- INIT ---
  const initEditor = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_SCENE)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.settings) sceneConfig.value = normalizeScene(parsed)
        }
        const lastScript = localStorage.getItem(STORAGE_KEY_SCRIPT)
        if (lastScript) selectedScriptId.value = lastScript
      } catch (e) {
        console.error('Storage error', e)
      }
    }
    saveHistory()
  }

  // --- WATCHERS ---
  if (typeof window !== 'undefined') {
    const debouncedSave = debounce((val: SceneConfig) => {
      localStorage.setItem(STORAGE_KEY_SCENE, JSON.stringify(val))
    }, 500)

    watch(sceneConfig, (val) => {
      debouncedSave(val)
    }, { deep: true })

    watch(selectedScriptId, (val) => {
      if (val) localStorage.setItem(STORAGE_KEY_SCRIPT, val)
    })
  }

  // --- ACTIONS ---
  const addElement = (initialProps?: Partial<SceneElement>) => {
    const carCount = sceneConfig.value.elements.filter(e => e.name?.startsWith('Автомобиль')).length

    const newEl: SceneElement = {
      id: `el_${generateId()}`,
      name: `Автомобиль ${carCount + 1}`,
      type: 'actor',
      x: 100, y: 100, width: 80, height: 40,
      zIndex: sceneConfig.value.elements.length + 1,
      asset: {
        type: 'svg',
        content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-1.5-2.6C16.1 6.5 15.1 6 14 6H10c-1.1 0-2.1.5-2.6 1.4L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2m14 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0M9 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0"/></svg>'
      }
    }
    if (initialProps) Object.assign(newEl, initialProps)
    sceneConfig.value.elements.push(newEl)
    selectedId.value = newEl.id
    selectedPanelId.value = null
    selectedCtrlIds.value = []
    saveHistory()
    return newEl
  }

  const deleteElement = (id: string) => {
    sceneConfig.value.elements = sceneConfig.value.elements.filter(el => el.id !== id)
    if (selectedId.value === id) selectedId.value = null
    saveHistory()
  }

  const updateElement = (payload: { id: string, key: string, val: any }) => {
    const el = sceneConfig.value.elements.find(e => e.id === payload.id)
    if (el) {
      (el as any)[payload.key] = payload.val
      saveHistory()
    }
  }

  const addPanel = () => {
    const newPanel: Panel = {
      id: `p_${generateId()}`,
      title: 'Панель',
      x: 200, y: 200, width: 300, height: 200,
      dock: 'none', controls: []
    }
    sceneConfig.value.panels.push(newPanel)
    selectPanel(newPanel.id)
    saveHistory()
  }

  const deletePanel = (id: string) => {
    sceneConfig.value.panels = sceneConfig.value.panels.filter(p => p.id !== id)
    if (selectedPanelId.value === id) selectedPanelId.value = null
    saveHistory()
  }

  const selectPanel = (id: string | null) => {
    selectedPanelId.value = id
    selectedId.value = null
    selectedCtrlIds.value = []
  }

  const addControl = (control: any) => {
    const panel = sceneConfig.value.panels.find(p => p.id === control.panelId)
    if (panel) {
      if (!panel.controls) panel.controls = []
      panel.controls.push(control)
      saveHistory()
    }
  }

  const deleteControl = (cId: string) => {
    sceneConfig.value.panels.forEach(p => {
      if (p.controls) p.controls = p.controls.filter(c => c.id !== cId)
    })
    selectedCtrlIds.value = selectedCtrlIds.value.filter(id => id !== cId)
    saveHistory()
  }

  const selectControl = (payload: { cId: string, pId: string }) => {
    selectedPanelId.value = payload.pId
    selectedId.value = null
    selectedCtrlIds.value = [payload.cId]
  }

  const addScript = () => {
    const newScript: Script = {
      id: `scr_${generateId()}`, name: 'Сценарий', trigger: 'scene_start',
      tracks: [{ id: `t_${generateId()}`, name: 'Дорожка 1', sequence: [] }]
    }
    sceneConfig.value.scripts.push(newScript)
    selectedScriptId.value = newScript.id
    saveHistory()
  }

  const deleteScript = (id: string) => {
    sceneConfig.value.scripts = sceneConfig.value.scripts.filter(s => s.id !== id)
    if (selectedScriptId.value === id) selectedScriptId.value = null
    saveHistory()
  }

  const updateScript = (payload: { id: string, key: string, val: any }) => {
    const script = sceneConfig.value.scripts.find(s => s.id === payload.id)
    if (script) {
      (script as any)[payload.key] = payload.val
      saveHistory()
    }
  }

  // Поддержка вложенных путей через точку
  const updateSettings = (payload: { key: string, val: any }) => {
    if (!sceneConfig.value?.settings) return

    const keys = payload.key.split('.')
    const lastKey = keys[keys.length - 1]
    if (!lastKey) return
    let target: any = sceneConfig.value.settings
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!k) continue
      if (!target[k]) target[k] = {}
      target = target[k]
    }
    target[lastKey] = payload.val
    saveHistory()
  }

  const handleSaveDb = async () => {
    try {
      if (!sceneConfig.value.id || sceneConfig.value.id === 'scene_main') {
        sceneConfig.value.id = `scene_${Date.now()}_${generateId()}`
      }
      const success = await saveScene(sceneConfig.value)
      // [UI/UX] alert -> тост: сохранение не блокирует поток
      if (success) {
        toast.success('Сцена сохранена в базу данных')
      } else {
        toast.error('Не удалось сохранить сцену')
      }
    } catch (e: any) {
      console.error('[Editor] Save error:', e)
      toast.error('Ошибка сохранения: ' + (e?.message || 'неизвестная ошибка'))
    }
  }

  const saveSceneCopy = async (scene: SceneConfig) => {
    return await saveScene(scene)
  }

  const openLoadModal = async () => {
    isLoadModalOpen.value = true
    try {
      savedScenes.value = await listScenes()
    } catch (e) {
      console.error('[Editor] Load list error:', e)
      toast.error('Не удалось получить список сцен')
    }
  }

  const loadSelectedScene = async (id: string) => {
    try {
      const loaded = await loadScene(id)
      if (loaded) {
        // нормализация: старые сцены без panels/variables
        sceneConfig.value = normalizeScene(loaded)
        isLoadModalOpen.value = false
        saveHistory()
        toast.success('Сцена загружена')
      }
    } catch (e) {
      console.error('[Editor] Load scene error:', e)
      toast.error('Не удалось загрузить сцену')
    }
  }

  const importScene = (json: string) => {
    try {
      // нормализация импортированного JSON
      sceneConfig.value = normalizeScene(JSON.parse(json))
      saveHistory()
      toast.success('Сцена импортирована')
    } catch (e) {
      console.error('[Editor] Import error:', e)
      toast.error('Ошибка импорта: файл не является корректной сценой')
    }
  }

  // --- ЗАГЛУШКИ ---
  const addNode = (n: any) => {}
  const deleteNode = (id: string) => {}
  const selectNode = (id: string) => { selectedNodeId.value = id }
  const deleteSelectedNode = () => {}
  const updateScriptMeta = (p: any) => updateScript(p)
  const autoSortLayers = () => {}
  const locateObject = (id: string) => {
    highlightTargetId.value = id
    setTimeout(() => highlightTargetId.value = null, 2000)
  }
  const addVariable = () => {}
  const deleteVariable = () => {}
  const handleAddChild = () => {}

  return {
    sceneConfig, leftTab, savedScenes, isLoadModalOpen, showSimulatorPanel, simulatorKey,
    selectedId, selectedPanelId, selectedCtrlIds, selectedScriptId, selectedNode: selectedNodeId,
    sortedElements, selectedElement, selectedPanel, selectedCtrl, currentScript, highlightTargetId,
    toggleSimulator,
    addElement, deleteElement, updateElement,
    addPanel, deletePanel, selectPanel,
    addControl, deleteControl, selectControl,
    addScript, deleteScript, addNode, deleteNode, selectNode, updateScript, updateScriptMeta,
    updateSettings,
    autoSortLayers, locateObject, handleSaveDb, openLoadModal, loadSelectedScene, importScene, initEditor,
    addVariable, deleteVariable, handleAddChild, deleteSelectedNode,
    undo, saveSceneCopy,
    saveHistory
  }
}