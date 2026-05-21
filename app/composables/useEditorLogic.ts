// app/composables/useEditorLogic.ts
// Назначение: Основная бизнес-логика визуального редактора сцен.
// Работает автономно, сохраняет последнее состояние в localStorage и синхронизирует с IndexedDB.

import { ref, computed, watch } from 'vue'
import { useSceneBuilder } from './useSceneBuilder' // <-- ДОБАВЛЕНО: ИМПОРТ БАЗЫ ДАННЫХ
import type { SceneConfig, SceneElement, Panel, Script, ScriptNode } from '../types/scene'

const generateId = () => Math.random().toString(36).substr(2, 9)

const STORAGE_KEY_SCENE = 'journal_kpp_last_scene'
const STORAGE_KEY_SCRIPT = 'journal_kpp_last_script_id'

const defaultScene: SceneConfig = {
  id: 'scene_main',
  name: 'Новая Сцена',
  settings: {
    width: 1280,
    height: 720,
    bgColor: '#e5e7eb',
    borderColor: '#94a3b8'
  },
  elements: [],
  panels: [],
  scripts: []
}

export const useEditorLogic = () => {
  const { saveScene, listScenes, loadScene } = useSceneBuilder() // <-- ДОБАВЛЕНО: МЕТОДЫ БД

  const sceneConfig = ref<SceneConfig>(JSON.parse(JSON.stringify(defaultScene)))
  
  // --- State ---
  const selectedId = ref<string | null>(null)
  const selectedPanelId = ref<string | null>(null)
  const selectedCtrlIds = ref<string[]>([])
  const selectedScriptId = ref<string | null>(null)
  const selectedNodeId = ref<string | null>(null)
  
  const leftTab = ref('elements')
  const highlightTargetId = ref<string | null>(null)
  const savedScenes = ref<any[]>([])
  const isLoadModalOpen = ref(false)
  
  const showSimulatorPanel = ref(false)
  const toggleSimulator = () => {
    showSimulatorPanel.value = !showSimulatorPanel.value
  }
  const simulatorKey = ref(0)

  // --- COMPUTED ---
  const sortedElements = computed(() => [...sceneConfig.value.elements].sort((a, b) => a.zIndex - b.zIndex))
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
          if (parsed && parsed.settings) sceneConfig.value = parsed
        }
        const lastScript = localStorage.getItem(STORAGE_KEY_SCRIPT)
        if (lastScript) selectedScriptId.value = lastScript
      } catch (e) {
        console.error('Storage error', e)
      }
    }
  }

  // --- WATCHERS ---
  if (typeof window !== 'undefined') {
    watch(sceneConfig, (val) => {
      localStorage.setItem(STORAGE_KEY_SCENE, JSON.stringify(val))
    }, { deep: true })
    
    watch(selectedScriptId, (val) => {
      if(val) localStorage.setItem(STORAGE_KEY_SCRIPT, val)
    })
  }

  // --- ACTIONS ---
  let elementCounter = 0

  const addElement = () => {
    elementCounter++
    const newEl: SceneElement = {
      id: `el_${generateId()}`,
      name: `Автомобиль ${elementCounter}`,
      type: 'actor',
      x: 100, y: 100, width: 80, height: 40,
      zIndex: sceneConfig.value.elements.length + 1,
      asset: { 
        type: 'svg', 
        content: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-1.5-2.6C16.1 6.5 15.1 6 14 6H10c-1.1 0-2.1.5-2.6 1.4L6 10l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2m14 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0M9 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0"/></svg>'
      }
    }
    sceneConfig.value.elements.push(newEl)
    selectedId.value = newEl.id
    selectedPanelId.value = null
    selectedCtrlIds.value = []
  }

  const deleteElement = (id: string) => {
    sceneConfig.value.elements = sceneConfig.value.elements.filter(el => el.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  const updateElement = (payload: { id: string, key: string, val: any }) => {
    const el = sceneConfig.value.elements.find(e => e.id === payload.id)
    if (el) (el as any)[payload.key] = payload.val
  }

  const addPanel = () => {
    const newPanel: Panel = {
      id: `p_${generateId()}`, title: 'Панель',
      x: 200, y: 200, width: 300, height: 200,
      dock: 'none', controls: []
    }
    sceneConfig.value.panels.push(newPanel)
    selectPanel(newPanel.id)
  }

  const deletePanel = (id: string) => {
    sceneConfig.value.panels = sceneConfig.value.panels.filter(p => p.id !== id)
    if (selectedPanelId.value === id) selectedPanelId.value = null
  }

  const selectPanel = (id: string | null) => {
    selectedPanelId.value = id
    selectedId.value = null
    selectedCtrlIds.value = []
  }

  const addControl = (control: any) => {
    console.log('addControl received:', control)
    const panel = sceneConfig.value.panels.find(p => p.id === control.panelId)
    if (panel) {
      if (!panel.controls) panel.controls = []
      panel.controls.push(control)
    }
  }

  const deleteControl = (cId: string) => {
    sceneConfig.value.panels.forEach(p => { p.controls = p.controls.filter(c => c.id !== cId) })
    selectedCtrlIds.value = selectedCtrlIds.value.filter(id => id !== cId)
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
  }

  const deleteScript = (id: string) => {
    sceneConfig.value.scripts = sceneConfig.value.scripts.filter(s => s.id !== id)
    if (selectedScriptId.value === id) selectedScriptId.value = null
  }
  
  const updateScript = (payload: { id: string, key: string, val: any }) => {
    const script = sceneConfig.value.scripts.find(s => s.id === payload.id)
    if (script) (script as any)[payload.key] = payload.val
  }

  const updateSettings = (payload: { key: string, val: any }) => {
    if (sceneConfig.value?.settings) {
      (sceneConfig.value.settings as any)[payload.key] = payload.val
    }
  }
  
  const addNode = (n: any) => {}
  const deleteNode = (id: string) => {}
  const selectNode = (id: string) => { selectedNodeId.value = id }
  const deleteSelectedNode = () => {}
  const updateScriptMeta = (p: any) => updateScript(p)
  const autoSortLayers = () => {}
  const locateObject = (id: string) => { highlightTargetId.value = id; setTimeout(() => highlightTargetId.value = null, 2000) }
  
  // --- ИСПРАВЛЕНО: РЕАЛЬНОЕ СОХРАНЕНИЕ В БАЗУ ДАННЫХ ---
  const handleSaveDb = async () => {
    try {
      // Генерируем уникальный ID для новой сцены, если его нет
      if (!sceneConfig.value.id || sceneConfig.value.id === 'scene_main') {
        sceneConfig.value.id = `scene_${Date.now()}_${generateId()}`
      }
      const success = await saveScene(sceneConfig.value)
      if (success) {
        alert('✅ Сцена успешно сохранена в базу данных!')
      } else {
        alert('❌ Ошибка: не удалось сохранить')
      }
    } catch (e) {
      console.error('[Editor] Save error:', e)
      alert('❌ Ошибка сохранения: ' + e.message)
    }
  }
  
  // --- ИСПРАВЛЕНО: РЕАЛЬНАЯ ЗАГРУЗКА СПИСКА СЦЕН ---
  const openLoadModal = async () => {
    isLoadModalOpen.value = true
    try {
      savedScenes.value = await listScenes()
      if (savedScenes.value.length === 0) {
        console.warn('[Editor] В базе нет сохраненных сцен')
      }
    } catch (e) {
      console.error('[Editor] Load list error:', e)
    }
  }

  // --- ИСПРАВЛЕНО: РЕАЛЬНАЯ ЗАГРУЗКА СЦЕНЫ ---
  const loadSelectedScene = async (id: string) => {
    try {
      const loaded = await loadScene(id)
      if (loaded) {
        sceneConfig.value = loaded
        isLoadModalOpen.value = false
        console.log(`[Editor] Сцена "${loaded.name}" загружена`)
      }
    } catch (e) {
      console.error('[Editor] Load scene error:', e)
    }
  }

  const importScene = (json: string) => { try { sceneConfig.value = JSON.parse(json) } catch(e){} }
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
    addVariable, deleteVariable, handleAddChild, deleteSelectedNode
  }
}