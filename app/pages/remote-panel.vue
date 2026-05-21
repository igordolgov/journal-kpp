<!-- pages/remote-panel.vue -->
<template lang="pug">
.remote-page.h-screen.w-screen.bg-gray-800
  template(v-if="panel")
    PanelUI(:panel="panel" @action="sendAction")
  .text-white.text-center.p-10(v-else)
    p Панель не найдена.
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSceneBuilder } from '../composables/useSceneBuilder'
import PanelUI from '../components/PanelUI.vue'

const route = useRoute()
const { loadScene } = useSceneBuilder()
const panel = ref<any>(null)

const bc = new BroadcastChannel('kpp_channel')

onMounted(async () => {
  const panelId = route.query.id
  // Загружаем сцену (предполагаем, что она сохранена как 'current_scene' или передана)
  const config = await loadScene('preview_temp') // Или другая логика загрузки
  if(config) {
    panel.value = config.panels.find((p: any) => p.id === panelId)
  }
})

const sendAction = (binding: any) => {
  bc.postMessage({ type: 'ACTION', payload: binding })
}
</script>