<!-- app/layouts/default.vue -->
<!-- Назначение: главный layout — drawer-меню, шапка со сменой и статистикой
    (ТОЛЬКО на странице журнала), плавающая кнопка и док-панель симулятора.
    [UI/UX] Шапка с брендом — только на журнале; на остальных страницах —
    плавающая круглая кнопка меню (экраны <lg).
    [UI/UX] Волна 1 Lucide: навигация, шапка, FAB — вместо эмодзи/SVG. -->
<template lang="pug">
.drawer.h-screen.overflow-hidden(class="lg:drawer-open")
  input#main-drawer.drawer-toggle(type="checkbox")

  .drawer-content.flex.flex-col
    //- === Шапка: бренд, смена, статистика — ТОЛЬКО на странице журнала ===
    template(v-if="isJournalPage")
      header.flex-none.h-16.z-30.bg-base-200
        .navbar.flex.h-full.max-w-7xl.gap-2.mx-auto
          .flex-none(class="lg:hidden")
            label.btn.btn-ghost.drawer-label(for="main-drawer")
              Menu.h-5.w-5

          nuxt-link.navbar-brand.text-xl.font-bold(to="/") Журнал КПП

          ClientOnly
            ShiftManager

          .flex-1

          .hidden.gap-2(class="lg:flex")
            nuxt-link.btn.btn-ghost.btn-sm.gap-1(to="/" class="hover:text-error" active-class="btn-active text-error")
              LogOut.h-4.w-4
              | Отсутствуют
              .badge.badge-outline.ml-1.rounded-md {{ stats.residentsOut }}
            nuxt-link.btn.btn-ghost.btn-sm.gap-1(to="/" class="hover:text-success" active-class="btn-active text-success")
              LogIn.h-4.w-4
              | В гостях
              .badge.badge-outline.ml-1.rounded-md {{ stats.outsidersIn }}

    //- === Плавающая кнопка меню на страницах БЕЗ шапки (экраны <lg) ===
    ClientOnly
      label.fixed.top-2.left-2.z-40.btn.btn-sm.btn-circle.btn-ghost.shadow.bg-base-200(
        v-if="!isJournalPage"
        class="lg:hidden"
        for="main-drawer"
        title="Меню"
      )
        Menu.h-5.w-5

    //- Основной контент: на журнале минус высота шапки, на остальных — весь экран
    main.overflow-hidden.bg-base-300(
      :class="isJournalPage ? 'h-[calc(100vh-64px)]' : 'h-screen'"
    )
      .container.mx-auto.h-full
        slot

    //- Плавающая кнопка симулятора
    ClientOnly
      button.fixed.bottom-6.right-6.z-40.btn-lg.btn-circle.btn-primary.shadow-xl.transition-transform(
        class="hover:scale-105"
        :class="isSimulatorOpen ? 'rotate-45' : ''"
        @click="toggleSimulator"
        :title="isSimulatorOpen ? 'Скрыть симулятор' : 'Открыть симулятор'"
      )
        Video.h-6.w-6

    //- Док-панель симулятора (раскрывается по фокусу)
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

    //- === Тур первого запуска (поверх всего) ===
    ClientOnly
      UiOnboardingTour

  .drawer-side.z-40
    label.drawer-overlay(for="main-drawer")
    ul.menu.flex.min-h-full.w-44.flex-col.gap-2.p-4.bg-base-200.text-base-content
      li
        nuxt-link.flex.items-center.gap-2(to="/" exact-active-class="bg-primary text-white rounded-md")
          BookOpen.h-4.w-4.shrink-0
          span Журнал
      li
        nuxt-link.flex.items-center.gap-2(to="/database" active-class="bg-primary text-white rounded-md")
          Database.h-4.w-4.shrink-0
          span База данных
      li
        nuxt-link.flex.items-center.gap-2(to="/settings" active-class="bg-primary text-white rounded-md")
          Settings.h-4.w-4.shrink-0
          span Настройки
      .divider
      li
        nuxt-link.flex.items-center.gap-2(to="/editor" active-class="bg-primary text-white rounded-md")
          PencilRuler.h-4.w-4.shrink-0
          span Редактор
      li
        nuxt-link.flex.items-center.gap-2(to="/reports" active-class="bg-primary text-white rounded-md")
          ChartColumn.h-4.w-4.shrink-0
          span Аналитика

  ShiftManagerModals
</template>

<script setup lang="ts">
// app/layouts/default.vue — script
// Глобальная инициализация: тема, конфиг, журнал, смена, БД, последняя сцена.
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
// Волна 1 Lucide: навигация, шапка, FAB
import {
  Menu, BookOpen, Database, Settings, PencilRuler,
  ChartColumn, LogOut, LogIn, Video
} from 'lucide-vue-next'
import { useTheme } from '~/composables/useTheme'
import { useConfig } from '~/composables/useConfig'
import { useJournal } from '~/composables/useJournal'
import { useShift } from '~/composables/useShift'
import { useSceneBuilder } from '~/composables/useSceneBuilder'
import { useDatabase } from '~/composables/useDatabase'
import type { SceneConfig } from '~/types/scene'

const route = useRoute()
const themeStore = useTheme()
const configStore = useConfig()
const { stats, loadData } = useJournal()
const { loadCurrentShift } = useShift()
const { initSettings } = useDatabase()
const { loadScene, listScenes } = useSceneBuilder()

// Шапка с брендом/сменой/статистикой — только на журнале
const isJournalPage = computed(() => route.path === '/')

const isSimulatorOpen = useState<boolean>('simulator-is-open', () => false)
const sceneConfig = ref<SceneConfig | null>(null)
const isSimulatorFocused = ref(false)
const simContainerRef = ref<HTMLElement | null>(null)

const windowHeight = ref<number>(800)
const handleWindowResize = () => { windowHeight.value = window.innerHeight }

// Загрузка последней сохранённой сцены для док-панели симулятора
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

// [ДОБАВЛЕНО] онбординг первого запуска
import { useOnboarding } from '~/composables/useOnboarding'
const { isDone, show: showOnboarding } = useOnboarding()

// внутри существующего onMounted, ПОСЛЕ await loadLatestScene():
  // Первый запуск — показать тур знакомства
  if (!isDone()) {
    setTimeout(() => showOnboarding(), 600) // [НАСТРОЙКА] задержка: дать интерфейсу отрисоваться
  }

// Настройки симулятора: глобальные дефолты перекрываются настройками сцены
const simulatorSettings = computed(() => {
  const globalDefaults = configStore.config.value?.simulator || {}
  const sceneTraffic = sceneConfig.value?.settings?.traffic || {}
  return { ...globalDefaults, ...sceneTraffic }
})

// При открытии симулятора — подгружаем сцену и забираем фокус (хоткеи)
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

  // После загрузки БД даём Nuxt тик, чтобы реактивные переменные обновились
  await Promise.all([
    themeStore.loadTheme(),
    configStore.loadConfig(),
    loadData(),
    loadCurrentShift()
  ])

  await nextTick()

  // Сцену грузим только после того, как стейт обновился
  await loadLatestScene()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})

// [НАСТРОЙКА] Высота дока: свёрнутый = 11vh, развёрнутый = высота сцены (макс. 50% окна)
const WIDGET_HEADER_HEIGHT = 32
const simulatorDockStyle = computed(() => {
  if (!isSimulatorFocused.value) return { height: '11vh' }
  const sceneHeight = sceneConfig.value?.settings?.height || 720
  const neededHeight = sceneHeight + WIDGET_HEADER_HEIGHT
  const maxAllowed = windowHeight.value * 0.5
  return { height: `${Math.min(neededHeight, maxAllowed)}px` }
})

const toggleSimulator = () => { isSimulatorOpen.value = !isSimulatorOpen.value }
const handleFocusIn = () => { isSimulatorFocused.value = true }
const handleFocusOut = () => { isSimulatorFocused.value = false }
const focusSimulator = () => { simContainerRef.value?.focus() }
</script>

<style scoped>
.simulator-dock { outline: none; background-color: rgb(17 24 39); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>