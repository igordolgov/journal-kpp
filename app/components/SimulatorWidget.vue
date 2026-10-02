<template lang="pug">
.simulator-widget.relative.flex.flex-col.w-full.h-full.overflow-hidden(
  class="bg-gray-950"
)
  //- Хедер симулятора
  //- [Фаза 5] h-10 (было 8 — тесно), токены темы, Lucide-кнопки
  header.flex.flex-none.justify-between.items-center.h-10.px-2(
    class="bg-gray-900 border-white/10 border-b"
  )
    .flex.items-center.gap-1
      span.relative.flex.h-2.w-2
        span.animate-ping.absolute.inline-flex.h-full.w-full.rounded-full.bg-success(
          class="opacity-75"
        )
        span.relative.inline-flex.rounded-full.h-2.w-2.bg-success
      span.text-xs.font-bold.text-success СИМУЛЯЦИЯ

    .text-xxs(
      class="text-base-content/50"
    )
      | Режим: {{ isRunning ? 'Запущен' : 'Пауза' }}
      span.ml-2.text-info(v-if="aiAgents.length > 0") (Агентов: {{ aiAgents.length }})
      span.ml-2.text-success(v-if="usedPeopleIds.size > 0") (Уникальных: {{ usedPeopleIds.size }})

    .flex.items-center.gap-1
      //- [Фаза 5] Lucide-кнопки вместо эмодзи; активное состояние — через bg-primary/20
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="enableVisualRotation = !enableVisualRotation"
        :class="enableVisualRotation ? 'text-primary bg-primary/20' : 'text-base-content/40'"
        title="Поворот спрайтов"
      )
        CarFront.w-4.h-4
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="showDebug = !showDebug"
        :class="showDebug ? 'text-warning bg-warning/20' : 'text-base-content/40'"
        title="Показать физику"
      )
        Activity.w-4.h-4
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="showSettings = !showSettings"
        :class="showSettings ? 'text-warning bg-warning/20' : 'text-base-content/40'"
        title="Настройки"
      )
        SlidersHorizontal.w-4.h-4
      button.btn.btn-xs.btn-ghost.btn-square(
        class="hover:text-error text-base-content/40"
        @click="$emit('close')"
        title="Закрыть"
      )
        X.w-4.h-4

    //- Панель настроек (поп-овер)
    .absolute.top-11.right-2.z-50.w-56.rounded-lg.p-3.shadow-xl(
      v-if="showSettings"
      class="bg-gray-900 border border-white/10"
    )
      .text-xs.font-bold.mb-2(
        class="text-base-content/70"
      ) НАСТРОЙКИ
      .flex.flex-col.gap-2
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Макс. агентов
          input.input.input-xs(type="number" v-model.number="userMaxAgents" min="1" max="50" placeholder="20")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Интервал пеших (мин-макс)
          .flex.gap-1
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="1" placeholder="10")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="1" placeholder="30")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Интервал авто (мин-макс)
          .flex.gap-1
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="1" placeholder="5")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="1" placeholder="15")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Размер группы
          input.input.input-xs(type="number" v-model.number="userMaxGroupSize" min="1" max="6" placeholder="4")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Макс. чужих в группе
          input.input.input-xs(type="number" v-model.number="userMaxNonFamily" min="0" max="4" placeholder="1")
        button.btn.btn-xs.btn-outline.btn-error.mt-2(@click="resetSettings") Сбросить

  //- Основной холст симуляции
  .relative.flex.flex-1.items-center.justify-center.overflow-hidden.bg-gray-800(ref="containerRef")
    .sim-canvas-wrapper.relative.overflow-hidden(
      :style="{ width: sceneSize.width + 'px', height: sceneSize.height + 'px', transform: `scale(${scale})`, transformOrigin: 'top left' }"
    )
      template(v-for="el in simElements" :key="el.id")
        .absolute.cursor-pointer(
          :style="getElementStyle(el, enableVisualRotation)"
          class="hover:z-50"
          @click="onElementClick(el)"
        )
          TrafficRoad.w-full.h-full(
            v-if="el.asset?.type === 'traffic_road'"
            :width="el.width || 400"
            :height="el.height || 120"
            :is-running="isRunning"
            :muted="true"
            :spawn-rate="el.settings?.spawnRate"
            :min-speed="el.settings?.minSpeed"
            :max-speed="el.settings?.maxSpeed"
          )
          .person-avatar.w-full.h-full.relative(
            v-else-if="el.asset?.type === 'person'"
            :class="{ 'is-paused': (el.velocity || 0) < 0.1, 'is-exit': el.direction === 'exit' }"
          )
            .person-svg-container(v-html="el.asset.svg || ' '")
          .w-full.h-full.relative(v-else-if="el.asset?.type === 'car'")
            .car-svg-container(v-html="el.asset.svg || ' '")
          .gate-wrapper.w-full.h-full(
            v-else-if="el.asset?.type === 'svg'"
            :data-gate-id="el.id"
            :style="getGateStyle(el)"
          )
            div(v-html="getDynamicSvg(el)")
          .w-full.h-full(v-else :style="{ backgroundColor: el.asset?.content || '#888' }")

      template(v-for="panel in config?.panels" :key="'panel_'+panel.id")
        .absolute(
          :style="getPanelStyle(panel)"
          class="hover:z-50 cursor-pointer"
        )
          .panel-controls.flex.flex-wrap.gap-1.p-1
            .control-item.relative(
              v-for="ctrl in panel.controls"
              :key="ctrl.id"
              :style="getControlStyle(ctrl)"
              @click.stop="handleControlClick(ctrl, panel, { x: panel.x || 0, y: panel.y || 0 })"
            )
              .control-content.relative(
                :style="getControlContentStyle(ctrl)"
                :class="[ { 'is-3d-gate': isGateControl(ctrl) }, !isGateControl(ctrl) && pressedControls.has(ctrl.id) ? 'pressed' : '' ]"
              )
                .absolute.w-4.h-1.rounded-full.transition-all.z-10(
                  v-if="ctrl.settings?.actionType === 'call'"
                  class="bottom-2 left-1/2 -translate-x-1/2 translate-y-1/2"
                  :class="activeCallButtonId === ctrl.id ? 'glow-indicator' : 'bg-gray-400'"
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

      svg.absolute.inset-0.pointer-events-none.z-50.opacity-30(v-if="isRunning && activeCommands.length && !showDebug")
        template(v-for="cmd in activeCommands" :key="cmd.id")
          line(
            v-if="cmd.target && cmd.actor && !cmd.isReversing"
            :x1="cmd.actor.x + cmd.actor.width/2" :y1="cmd.actor.y + cmd.actor.height/2"
            :x2="cmd.target.x + cmd.target.width/2" :y2="cmd.target.y + cmd.target.height/2"
            stroke="#22c55e" stroke-width="2" stroke-dasharray="4"
          )

      .absolute.inset-0.pointer-events-none(style="z-index: 1000")
        template(v-for="el in simElements" :key="'label_' + el.id")
          .absolute.text-label(
            v-if="(el.asset?.type === 'person' || el.asset?.type === 'car') && visibleAgentLabels.has(el.id)"
            :style="getLabelStyle(el)"
          )
            .flex.flex-col.items-center
              template(v-if="el.asset?.type === 'car'")
                span.font-bold {{ el.asset?.plate }}
                .text-xxs(v-if="el.occupants && el.occupants.length > 0")
                  span(v-for="(occ, idx) in el.occupants" :key="occ.id")
                    | {{ occ.fio }}
                    span(v-if="Number(idx) < el.occupants.length - 1") , 
              template(v-else)
                span.font-bold {{ el.name }}
                span.text-sm(v-if="el.groupLabel") {{ el.groupLabel }}

    //- [Фаза 5] Empty state с CTA: сцена не загружена — прямая дорога в Редактор
    .absolute.inset-0.flex.items-center.justify-center(
      v-if="!config || simElements.length === 0"
      class="bg-gray-800"
    )
      .text-center.p-4
        MonitorX.w-10.h-10.mx-auto.mb-3(class="text-base-content/30")
        p.text-lg.mb-1(
          class="text-base-content/60"
        ) Сцена не загружена
        p.text-xs.mb-4(
          class="text-base-content/40"
        ) Создайте или сохраните сцену в Редакторе
        button.btn.btn-sm.btn-primary(
          @click="$router.push('/editor')"
        )
          PencilRuler.w-4.h-4.mr-1
          | Открыть Редактор
</template>

<script setup lang="ts">
// app/components/SimulatorWidget.vue — script
// [ИСПРАВЛЕНО v3]: типизация стилевых функций через CSSProperties — строковые
// литералы ('flex'/'absolute'/'none') без контекстного типа расширяются до
// string и не проходят CSSProperties; функции из useSimulatorUI/useSimulatorCore
// обёрнуты с приведением (их исходники возвращают widening-объекты).
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import type { CSSProperties } from 'vue'
import TrafficRoad from './editor/TrafficRoad.vue'
import { useSimulatorCore } from '../composables/simulator/useSimulatorCore'
import { useSimulatorPhysics } from '../composables/simulator/useSimulatorPhysics'
import { useSimulatorSpawn } from '../composables/simulator/useSimulatorSpawn'
import { useSimulatorScripts } from '../composables/simulator/useSimulatorScripts'
import { useSimulatorAudio } from '../composables/simulator/useSimulatorAudio'
import { useSimulatorUI, type ActiveIntercom } from '../composables/simulator/useSimulatorUI'
import { useSimulatorRendering } from '../composables/simulator/useSimulatorRendering'
import { useSimulatorIntegration } from '../composables/useSimulatorIntegration'
import { generateSlidingGateSVG, generateWicketSVG } from '../constants/library'
import { useAudioEngine } from '../composables/useAudioEngine'
import {
  PERSON_WIDTH,
  PERSON_HEIGHT,
  CAR_WIDTH,
  CAR_HEIGHT
} from '~/utils/simulatorConstants'
// [Фаза 5] Lucide: хедер и empty state
import {
  CarFront, Activity, SlidersHorizontal, X,
  MonitorX, PencilRuler
} from '@lucide/vue'

const audio = useAudioEngine()

const props = defineProps<{
  config: any
  scripts?: any[]
  isRunning: boolean
  simSettings?: any
}>()
const emit = defineEmits(['close'])

// ---- Состояния ----
const simElements = ref<any[]>([])
const aiAgents = ref<any[]>([])
const activeCommands = ref<any[]>([])
const showDebug = ref(false)
const sceneSize = ref({ width: 1280, height: 720 })
const containerRef = ref<HTMLElement | null>(null)
const activeIntercoms = ref<Set<ActiveIntercom>>(new Set())
const activeCallButtonId = ref<string | null>(null)

const showSettings = ref(false)
const userMaxAgents = ref<number | null>(null)
const userPersonIntervalMin = ref<number | null>(null)
const userPersonIntervalMax = ref<number | null>(null)
const userCarIntervalMin = ref<number | null>(null)
const userCarIntervalMax = ref<number | null>(null)
const userMaxGroupSize = ref<number | null>(null)
const userMaxNonFamily = ref<number | null>(null)

const resetSettings = () => {
  userMaxAgents.value = null
  userPersonIntervalMin.value = null
  userPersonIntervalMax.value = null
  userCarIntervalMin.value = null
  userCarIntervalMax.value = null
  userMaxGroupSize.value = null
  userMaxNonFamily.value = null
  showSettings.value = false
}

const integration = useSimulatorIntegration()
const { allPeople, usedPeopleIds } = integration

// [ИСПРАВЛЕНО] алиасы + типизированные обёртки: возврат core/ui-функций —
// объекты с расширенными до string литералами, приведение через as CSSProperties
const { getElementStyle: _getElementStyle, getGateStyle, ...core } = useSimulatorCore(simElements)
const getElementStyle = (el: any, enableRotation: boolean): CSSProperties =>
  _getElementStyle(el, enableRotation) as CSSProperties

const simOpts = computed(() => ({
  ...props.simSettings,
  maxGroupSize: userMaxGroupSize.value ?? 4,
  maxNonFamily: userMaxNonFamily.value ?? 1,
  personWidth: PERSON_WIDTH,
  personHeight: PERSON_HEIGHT,
  carWidth: CAR_WIDTH,
  carHeight: CAR_HEIGHT,
  carSpawnIntervalMin: userCarIntervalMin.value ?? props.simSettings?.carSpawnIntervalMin ?? 5,
  carSpawnIntervalMax: userCarIntervalMax.value ?? props.simSettings?.carSpawnIntervalMax ?? 15,
}))

const spawn = useSimulatorSpawn(
  simElements, aiAgents, sceneSize,
  core.fixedXPerson, core.fixedYPerson, core.fixedXCar, core.fixedYCar,
  integration,
  simOpts
)

const audioCtrl = useSimulatorAudio(
  simElements, aiAgents, sceneSize,
  () => getTrafficConfig(),
  activeIntercoms
)
const { visibleAgentLabels, initAudioPools, updateAllAudio, resetAllAudioTimers, cleanupAgentSounds } = audioCtrl

const physics = useSimulatorPhysics(
  simElements, aiAgents, sceneSize,
  core.openGateWithSound, core.closeGateWithSound, core.stopGate,
  props.simSettings || {},
  (agent) => {
    spawn.handleAgentDone(agent)
    cleanupAgentSounds(agent.id)
  }
)

const rendering = useSimulatorRendering(containerRef, sceneSize)
const { scale, enableVisualRotation, initScaling, cleanupScaling } = rendering

const scriptsHandler = useSimulatorScripts(simElements, activeCommands, ref(props.isRunning), props.scripts)

const ui = useSimulatorUI(
  simElements, core.openGateWithSound, core.closeGateWithSound, core.stopGate,
  activeIntercoms,
  activeCallButtonId
)
const {
  onControlClick,
  getPanelStyle: _getPanelStyle,
  getControlStyle: _getControlStyle,
  getControlContentStyle: _getControlContentStyle,
  getGateInnerStyle,
  getControlLabelStyle: _getControlLabelStyle
} = ui

// [ИСПРАВЛЕНО] типизированные обёртки над стилевыми функциями useSimulatorUI
const getPanelStyle = (panel: any): CSSProperties => _getPanelStyle(panel) as CSSProperties
const getControlStyle = (ctrl: any): CSSProperties => _getControlStyle(ctrl) as CSSProperties
const getControlContentStyle = (ctrl: any): CSSProperties => _getControlContentStyle(ctrl) as CSSProperties
const getControlLabelStyle = (ctrl: any): CSSProperties => _getControlLabelStyle(ctrl) as CSSProperties

const pressedControls = ref(new Set<string>())
const isGateControl = (ctrl: any) => {
  const settings = ctrl.settings || {}
  return settings.actionType?.includes('gate') || settings.actionType?.includes('wicket')
}

const handleControlClick = (ctrl: any, panel: any, pos: { x: number; y: number }) => {
  onControlClick(ctrl, panel, pos)
  pressedControls.value.add(ctrl.id)
  setTimeout(() => {
    pressedControls.value.delete(ctrl.id)
  }, 200)
  audioCtrl.updateIntercomAndLabels()
}

// [ИСПРАВЛЕНО] аннотация CSSProperties: pointerEvents/'center'/'break-word'
// остаются литералами благодаря контекстной типизации
const getLabelStyle = (el: any): CSSProperties => {
  const left = el.x + el.width / 2
  const top = el.y - 50
  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateX(-50%)',
    position: 'absolute',
    whiteSpace: 'normal',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    fontSize: '14px',
    padding: '6px 10px',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: 1000,
    fontFamily: 'sans-serif',
    maxWidth: '220px',
    wordBreak: 'break-word',
    lineHeight: '1.4',
    textAlign: 'center'
  }
}

const executeControlAction = (controlId: string, targetGateId: string | undefined, settings: any) => {
  const ctrl = { id: controlId, settings }
  const dummyPanel = { x: 0, y: 0 }
  handleControlClick(ctrl, dummyPanel, { x: 0, y: 0 })
}
defineExpose({ executeControlAction })

const getTrafficConfig = () => {
  const st = props.config?.settings?.traffic || {}
  const gates = simElements.value.filter(el => el.category === 'gate' || el.category === 'barrier')
  let carGate = gates.find(g => (g.width && g.width > 60) || g.settings?.gateType !== 'wicket')
  let personGate = gates.find(g => (g.width && g.width <= 60) || g.settings?.gateType === 'wicket')
  if (!carGate && gates.length) carGate = gates[0]
  if (!personGate && gates.length) personGate = gates[0]

  return {
    enabled: st.enabled ?? true,
    intervalMin: userPersonIntervalMin.value ?? st.intervalMin ?? 10,
    intervalMax: userPersonIntervalMax.value ?? st.intervalMax ?? 30,
    personSpeed: st.personSpeed ?? 40,
    carSpeed: st.carSpeed ?? 100,
    carGateId: (st.carGateId ?? carGate?.id) || '',
    personGateId: (st.personGateId ?? personGate?.id) || '',
    gateCloseDelay: st.gateCloseDelay ?? 10,
    wicketCloseDelay: st.wicketCloseDelay ?? 0,
    maxAgents: userMaxAgents.value ?? st.maxAgents ?? 20,
    stepAudibleDistance: st.stepAudibleDistance ?? 400,
    engineAudibleDistance: st.engineAudibleDistance ?? 800,
  }
}

const onElementClick = (el: any) => {
  if (el.category === 'gate' || el.category === 'barrier') core.handleGateClick(el)
}

// [ИСПРАВЛЕНО] генераторы принимают 3 аргумента — 4-й (isOpen) не существует
const getDynamicSvg = (el: any): string => {
  if (el.category === 'gate' || el.category === 'barrier' || el.type === 'gate') {
    const s = el.settings || {}
    if (s.gateType === 'wicket') return generateWicketSVG(el.width || 80, el.height || 120, s)
    return generateSlidingGateSVG(el.width || 320, el.height || 120, s)
  }
  return el.asset?.content || ''
}

let animationFrameId: number | null = null
let lastTime = 0

const gameLoop = (timestamp: number) => {
  if (!props.isRunning) return
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1)
  lastTime = timestamp
  const cfg = getTrafficConfig()
  if (cfg.enabled) {
    spawn.updateSpawnLogic(dt, cfg, allPeople.value.length > 0, aiAgents.value.length)
    physics.updateAiMovement(dt, { carGateId: cfg.carGateId, personGateId: cfg.personGateId })
    scriptsHandler.processScriptLogic(dt)
    scriptsHandler.updateActiveCommands(dt)
  }
  updateAllAudio(dt)
  animationFrameId = requestAnimationFrame(gameLoop)
}

watch(() => props.config, async (nc) => {
  if (!nc) return
  if (aiAgents.value.length > 0 && nc.elements) {
    for (const ce of nc.elements) {
      const ee = simElements.value.find(e => e.id === ce.id)
      if (ee) {
        ee.x = ce.x; ee.y = ce.y; ee.width = ce.width; ee.height = ce.height
        if (ce.settings) Object.assign(ee.settings, ce.settings)
      }
    }
    core.updateFixedCoordinates(getTrafficConfig())
    return
  }
  core.loadScene(nc)
  if (nc.settings?.width) sceneSize.value.width = nc.settings.width
  if (nc.settings?.height) sceneSize.value.height = nc.settings.height
  await nextTick()
  core.updateFixedCoordinates(getTrafficConfig())
}, { immediate: true, deep: true })

watch(() => props.isRunning, (ir) => {
  if (ir) {
    lastTime = performance.now()
    animationFrameId = requestAnimationFrame(gameLoop)
  } else if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
})

watch([userPersonIntervalMin, userPersonIntervalMax, userCarIntervalMin, userCarIntervalMax], () => {
  spawn.resetSpawnTimers()
})

const handleKeyDown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return

  const key = e.key.toLowerCase()
  const panels = props.config?.panels || []
  for (const panel of panels) {
    for (const ctrl of panel.controls || []) {
      const hotkey = ctrl.settings?.hotkey
      if (hotkey && hotkey.toLowerCase() === key) {
        e.preventDefault()
        handleControlClick(ctrl, panel, { x: panel.x || 0, y: panel.y || 0 })
        return
      }
    }
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)

  await integration.loadAllData()

  if (props.config && simElements.value.length === 0) {
    core.loadScene(props.config)
    await nextTick()
    core.updateFixedCoordinates(getTrafficConfig())
  }

  const autoResize = props.simSettings?.autoResize ?? true
  if (autoResize && containerRef.value) {
    const updateSceneSize = () => {
      if (!containerRef.value) return
      const rect = containerRef.value.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        sceneSize.value = { width: rect.width - 16, height: rect.height - 16 }
      }
    }
    updateSceneSize()
    resizeObserver = new ResizeObserver(() => updateSceneSize())
    resizeObserver.observe(containerRef.value)
  } else {
    if (props.config?.settings?.width) sceneSize.value.width = props.config.settings.width
    if (props.config?.settings?.height) sceneSize.value.height = props.config.settings.height
  }

  const cleanupScale = initScaling()
  ;(window as any).__cleanupScale = cleanupScale

  initAudioPools()

  // [ИСПРАВЛЕНО] ctx в API движка — функция: audio.ctx()
  const unlock = () => {
    audio.init()
    const c = audio.ctx()
    if (c && c.state === 'suspended') {
      c.resume().then(() => console.log('AudioContext resumed'))
    }
    window.removeEventListener('click', unlock)
  }
  window.addEventListener('click', unlock, { once: true })
  const c0 = audio.ctx()
  if (c0 && c0.state === 'suspended') {
    c0.resume()
  }

  if (props.isRunning) {
    lastTime = performance.now()
    animationFrameId = requestAnimationFrame(gameLoop)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (resizeObserver) resizeObserver.disconnect()
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  cleanupScaling()
  physics.clearAllTimers()
  resetAllAudioTimers()
  for (const agent of aiAgents.value) cleanupAgentSounds(agent.id)
  if ((window as any).__cleanupScale) (window as any).__cleanupScale()
})
</script>

<style scoped>
.simulator-widget {
  outline: none;
}

.person-avatar {
  display: flex;
  align-items: flex-end;
}

.person-svg-container,
.car-svg-container {
  width: 100%;
  line-height: 0;
}

.person-svg-container svg,
.car-svg-container svg {
  display: block;
  width: 100%;
  height: auto;
}

.person-avatar.is-paused :deep(.anim-arm-l),
.person-avatar.is-paused :deep(.anim-arm-r),
.person-avatar.is-paused :deep(.anim-leg-l),
.person-avatar.is-paused :deep(.anim-leg-r),
.person-avatar.is-paused :deep(.body-bounce) {
  animation-play-state: paused !important;
}

.person-avatar.is-exit :deep(svg) {
  transform: scaleX(-1);
}

.sim-canvas-wrapper :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: fill;
}

.gate-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.text-xxs {
  font-size: 0.65rem;
  line-height: 1;
}

.control-item {
  transition: all 0.1s ease;
}

.control-item:hover {
  filter: brightness(1.1);
}

.control-content.pressed {
  transform: scale(0.92);
  filter: brightness(0.85);
  transition: all 0.08s ease;
}

.gate-casing.pressed {
  transform: scale(0.92);
  filter: brightness(0.85);
  transition: all 0.08s ease;
}

.glow-indicator {
  background-color: #ef4444;
  box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.6);
  animation: led-pulse 0.1s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 1px 1px rgba(239, 68, 68, 0.9); }
}

.is-3d-gate {
  background-color: #111827 !important;
  padding: 7px !important;
  border: none !important;
  box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.9), 1px 1px 3px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(0, 0, 0, 1) !important;
}

.gate-casing {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: inset 0 -3px 7px rgba(0, 0, 0, 0.7);
}

.gate-casing::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 0%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}
</style>
