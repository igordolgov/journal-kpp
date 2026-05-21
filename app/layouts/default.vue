<!-- app/layouts/default.vue -->
<template lang="pug">
.drawer.h-screen.overflow-hidden(class="lg:drawer-open")
  input#main-drawer.drawer-toggle(type="checkbox")

  .drawer-content.flex.flex-col
    header.flex-none.h-16.z-30.bg-base-200
      .navbar.flex.h-full.max-w-7xl.gap-2.mx-auto
        .flex-none(class="lg:hidden")
          label.btn.btn-ghost.drawer-label(for="main-drawer")
            svg.h-5.w-5(fill="none" stroke="currentColor" viewBox="0 0 24 24")
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16")

        nuxt-link.navbar-brand.text-xl.font-bold(to="/") Журнал КПП

        ClientOnly
          ShiftManager

        .flex-1

        .hidden.gap-2(class="lg:flex")
          nuxt-link.btn.btn-ghost.btn-sm.gap-1(to="/" class="hover:text-error" active-class="btn-active text-error")
            | ⚠️ Отсутствуют
            .badge.badge-outline.ml-1.rounded-md {{ stats.residentsOut }}
          nuxt-link.btn.btn-ghost.btn-sm.gap-1(to="/" class="hover:text-success" active-class="btn-active text-success")
            | ✅ В гостях
            .badge.badge-outline.ml-1.rounded-md {{ stats.outsidersIn }}

    main.overflow-hidden.bg-base-300(class="h-[calc(100vh-64px)]")
      .container.mx-auto.h-full
        slot

    ClientOnly
      button.fixed.bottom-6.right-6.z-40.btn-lg.btn-circle.btn-primary.shadow-xl.transition-transform(
        class="hover:scale-105"
        :class="isSimulatorOpen ? 'rotate-45' : ''"
        @click="toggleSimulator"
        :title="isSimulatorOpen ? 'Скрыть симулятор' : 'Открыть симулятор'"
      )
        svg.h-6.w-6(fill="none" stroke="currentColor" viewBox="0 0 24 24")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z")

    ClientOnly
      transition(name="slide-up")
        .simulator-dock.fixed.bottom-0.left-0.right-0.z-50.border-t-2.border-gray-700.bg-gray-900.transition-all.duration-300.ease-in-out(
          v-if="isSimulatorOpen"
          ref="simContainerRef"
          tabindex="0"
          :style="simulatorDockStyle"
          @focusin="handleFocusIn"
          @focusout="handleFocusOut"
          @click="focusSimulator"
        )
          SimulatorWidget.h-full(
            v-if="sceneConfig"
            :config="sceneConfig"
            :sim-settings="simulatorSettings" 
            :scripts="sceneConfig?.scripts || []"
            :is-running="true"
            @close="toggleSimulator"
          )
          .flex.items-center.justify-center.h-full.text-gray-500(v-else)
            .text-center.p-4
              p.text-lg.mb-2 Сцена не загружена
              p.text-xs Создайте или сохраните сцену в Редакторе

  .drawer-side.z-40
    label.drawer-overlay(for="main-drawer")
    ul.menu.flex.min-h-full.w-40.flex-col.gap-2.p-4.bg-base-200.text-base-content
      li
        nuxt-link(to="/" exact-active-class="bg-primary text-white rounded-md")
          ClientOnly
            span Журнал
      li
        nuxt-link(to="/database" active-class="bg-primary text-white rounded-md")
          ClientOnly
            span База данных
      li
        nuxt-link(to="/settings" active-class="bg-primary text-white rounded-md")
          ClientOnly
            span Настройки
      .divider
      li
        nuxt-link(to="/editor" active-class="bg-primary text-white rounded-md")
          ClientOnly
            span Редактор
      li
        nuxt-link(to="/reports" active-class="bg-primary text-white rounded-md")
          ClientOnly
            span 📊 Аналитика
      //- 🆕 Пункт меню "Звуковая лаборатория"
      li
        nuxt-link(to="/audio-lab" active-class="bg-primary text-white rounded-md")
          ClientOnly
            span 🔊 Звуковая лаборатория

  ShiftManagerModals
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useTheme } from '~/composables/useTheme'
import { useConfig } from '~/composables/useConfig'
import { useJournal } from '~/composables/useJournal'
import { useShift } from '~/composables/useShift'
import { useSceneBuilder } from '~/composables/useSceneBuilder'
import { useDatabase } from '~/composables/useDatabase'
import type { SceneConfig } from '~/types/scene'

const themeStore = useTheme()
const configStore = useConfig()
const { stats, loadData } = useJournal()
const { loadCurrentShift } = useShift()
const { initSettings } = useDatabase() 
const { loadScene, listScenes } = useSceneBuilder()

const isSimulatorOpen = useState<boolean>('simulator-is-open', () => false)
const sceneConfig = ref<SceneConfig | null>(null)
const isSimulatorFocused = ref(false)
const simContainerRef = ref<HTMLElement | null>(null)

const windowHeight = ref<number>(800)
const handleWindowResize = () => { windowHeight.value = window.innerHeight }

const loadLatestScene = async () => {
  try {
    const scenes = await listScenes()
    if (scenes && scenes.length > 0) {
      const sortedScenes = [...scenes].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      const lastScene = sortedScenes[0]
      if (lastScene?.id) {
        const loadedConfig = await loadScene(lastScene.id)
        if (loadedConfig) sceneConfig.value = loadedConfig
      }
    } else { 
      sceneConfig.value = null 
    }
  } catch (e) { 
    console.warn('[Layout] Failed to load last scene', e) 
  }
}

// ТОЧНАЯ КОПИЯ ЛОГИКИ ИЗ EDITOR.VUE
const simulatorSettings = computed(() => {
  // configStore.config.value гарантирует, что мы читаем то же самое, что и редактор
  const globalDefaults = configStore.config.value?.simulator || {}
  const sceneTraffic = sceneConfig.value?.settings?.traffic || {}
  return { ...globalDefaults, ...sceneTraffic }
})

watch(isSimulatorOpen, (isOpen) => {
  if (isOpen) {
    setTimeout(() => {
      loadLatestScene()
      nextTick(() => focusSimulator())
    }, 100)
  } else { 
    isSimulatorFocused.value = false 
  }
})

onMounted(async () => {
  window.addEventListener('resize', handleWindowResize)
  handleWindowResize()

  await initSettings()
  
  // ПОСЛЕ загрузки БД обязательно даем Nuxt-у тик, чтобы обновились реактивные переменные
  await Promise.all([ 
    themeStore.loadTheme(), 
    configStore.loadConfig(),
    loadData(), 
    loadCurrentShift() 
  ])
  
  await nextTick()
  
  // Загружаем сцену ТОЛЬКО после того, как стейт обновился
  await loadLatestScene()
})

onUnmounted(() => { 
  window.removeEventListener('resize', handleWindowResize) 
})

onUnmounted(() => { 
  window.removeEventListener('resize', handleWindowResize) 
})

const WIDGET_HEADER_HEIGHT = 32
const simulatorDockStyle = computed(() => {
  if (!isSimulatorFocused.value) return { height: '11vh' }
  const sceneHeight = sceneConfig.value?.settings?.height || 720
  const neededHeight = sceneHeight + WIDGET_HEADER_HEIGHT
  const maxAllowed = windowHeight.value * 0.5
  return { height: `${Math.min(neededHeight, maxAllowed)}px` }
})

const toggleSimulator = () => { 
  isSimulatorOpen.value = !isSimulatorOpen.value 
}
const handleFocusIn = () => { 
  isSimulatorFocused.value = true 
}
const handleFocusOut = () => { 
  isSimulatorFocused.value = false 
}
const focusSimulator = () => { 
  simContainerRef.value?.focus() 
}
</script>

<style scoped>
.simulator-dock { outline: none; background-color: rgb(17 24 39); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>