<!-- app\pages\scenario-editor.vue -->
<template lang='pug'>
.scenario-editor.h-screen.w-screen.flex.flex-col.bg-gray-900.text-white.overflow-hidden
  EditorHeader(
    :name="sceneConfig.name"
    @update:name="val => sceneConfig.name = val"
    @exit="$router.push('/editor')"
    @save="handleSave"
    @run="handleRunEmbedded"
  )

  .flex-1.min-h-0.flex.overflow-hidden
    aside.w-64.bg-gray-800.border-r.border-gray-700.flex.flex-col.p-2
      .text-lg.font-bold.mb-2 Сценарии
      button.btn.btn-sm.btn-outline.w-full.mb-2(@click="addScript") ➕ Новый
      .menu.bg-gray-900.rounded-box.text-sm
        li(v-for="s in sceneConfig.scripts" :key="s.id")
          a(@click="selectScript(s.id)" :class="selectedScriptId === s.id ? 'active' : ''") {{ s.name }}

    main.flex-1.p-4.overflow-y-auto
      ScenarioEditor(
        v-if="currentScript"
        :scripts="sceneConfig.scripts"
        :selectedScriptId="selectedScriptId"
        :sceneElements="sceneConfig.elements"
        @update:script="handleUpdateScript"
        @select:script="selectScript"
        @add:script="addScript"
        @delete:script="deleteScript"
      )

    .h-64.border-t.border-gray-700.bg-black(v-if="showSimulatorPanel")
      SimulatorWidget(:key="simulatorKey" :config="sceneConfig" @close="showSimulatorPanel = false")

</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
// Убрали nanoid для надежности
import { useSceneBuilder } from '../composables/useSceneBuilder'
import { useScenarioRunner } from '../composables/useScenarioRunner'
import type { SceneConfig, Script } from '../types/scene'
import EditorHeader from '../components/editor/EditorHeader.vue'
import SimulatorWidget from '../components/SimulatorWidget.vue'
import ScenarioEditor from '../components/editor/ScenarioEditor.vue'

definePageMeta({ layout: false })

// Простой генератор ID
const genId = () => Math.random().toString(36).substring(2, 9)

const sceneConfig = reactive<SceneConfig>({
  id: 'scene_main', name: 'Моя сцена',
  settings: { width: 1280, height: 720, bgColor: '#111111' },
  elements: [
    { id: 'car_1', name: 'Машина 1', type: 'actor', x: 100, y: 100, rotation: 0 },
    { id: 'gate_exit', name: 'Выезд', type: 'gate', x: 500, y: 100 }
  ],
  scripts: [], variables: [],
  trafficConfig: { lanes: [], carPool: [] },
  lifeConfig: { outsideSpawn: {x:0, y:0}, outsideDespawn: {x:0, y:0}, insidePoint: {x:0, y:0}, assetMapping: {car: '', person: ''} }
})

const { saveScene, loadScene } = useSceneBuilder()
const { runScript } = useScenarioRunner()
const selectedScriptId = ref<string | null>(null)
const showSimulatorPanel = ref(false)
const simulatorKey = ref(0)

const currentScript = computed(() => sceneConfig.scripts.find(s => s.id === selectedScriptId.value))

const addScript = () => {
  const s: Script = { 
    id: genId(), 
    name: `Сценарий ${sceneConfig.scripts.length + 1}`, 
    trigger: 'scene_start', 
    tracks: [{ id: `t_${Date.now()}`, name: 'Поток 1', sequence: [] }] 
  }
  sceneConfig.scripts.push(s)
  selectedScriptId.value = s.id
}
const selectScript = (id: string) => { selectedScriptId.value = id }
const deleteScript = (id: string) => { sceneConfig.scripts = sceneConfig.scripts.filter(s => s.id !== id) }
const handleUpdateScript = (p: { id: string, key: string, val: any }) => { 
  const s = sceneConfig.scripts.find(x => x.id === p.id)
  if (s) (s as any)[p.key] = p.val 
}
const handleSave = async () => { await saveScene(sceneConfig) }

const handleRunEmbedded = async () => { 
  if (currentScript.value) runScript(currentScript.value, sceneConfig.elements)
  simulatorKey.value++; showSimulatorPanel.value = true 
}

const debugRun = () => {
  if(!currentScript.value) return alert('Выберите сценарий!')
  runScript(currentScript.value, sceneConfig.elements)
}

const debugAddTestBlocks = () => {
  if(!currentScript.value || !currentScript.value.tracks[0]) return
  currentScript.value.tracks[0].sequence = [
    { id: genId(), kind: 'action', type: 'move', label: 'Ехать' },
    { id: genId(), kind: 'actor', type: 'car_1', label: 'Машина 1' },
    { id: genId(), kind: 'target', type: 'gate_exit', label: 'Выезд' }
  ]
}

onMounted(async () => { 
  const l = await loadScene('preview_temp')
  if(l) Object.assign(sceneConfig, l)
})
</script>