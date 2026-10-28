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

    //- [№39] на узких экранах текст прячем: освобождает место кнопкам хедера
    .text-xxs(
      class="text-base-content/50 max-lg:hidden"
    )
      | Режим: {{ isRunning ? 'Запущен' : 'Пауза' }}
      span.ml-2.text-info(v-if="aiAgents.length > 0") (Агентов: {{ aiAgents.length }})
      span.ml-2.text-success(v-if="usedPeopleIds.size > 0") (Уникальных: {{ usedPeopleIds.size }})

    .flex.items-center.gap-1
      //- [Фаза 5] Lucide-кнопки вместо эмодзи; активное состояние — через bg-primary/20
      //- [№31-БЕЗ-ПОВОРОТА] кнопка «Поворот спрайтов» и её флаг удалены
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="showDebug = !showDebug"
        :class="showDebug ? 'text-warning bg-warning/20' : 'text-base-content/40'"
        title="Показать физику"
      )
        Activity.w-4.h-4
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="showFps = !showFps"
        :class="showFps ? 'text-success bg-success/20' : 'text-base-content/40'"
        title="Счётчик FPS (джанки)"
      )
        Gauge.w-4.h-4
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="toggleSettingsPopover"
        :class="showSettings ? 'text-warning bg-warning/20' : 'text-base-content/40'"
        title="Настройки"
      )
        SlidersHorizontal.w-4.h-4
      //- [№28-ЖИВАЯ-ПАНЕЛЬ] live-настройки движения/логики людей поверх симулятора
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="togglePeopleTuning"
        :class="showPeopleTuning ? 'text-success bg-success/20' : 'text-base-content/40'"
        title="Движение и логика людей (живые настройки)"
      )
        PersonStanding.w-4.h-4
      //- [№15-ЗВУК] mute/громкость симулятора
      button.btn.btn-xs.btn-ghost.btn-square(
        @click="userMuted = !userMuted"
        :class="userMuted ? 'text-error bg-error/20' : 'text-base-content/40'"
        :title="userMuted ? 'Включить звук' : 'Выключить звук'"
      )
        VolumeX.w-4.h-4(v-if="userMuted")
        Volume2.w-4.h-4(v-else)
      //- [№39-МОБИЛЬНОЕ] развернуть док на весь экран (телефон/планшет)
      button.btn.btn-xs.btn-ghost.btn-square(
        v-if="props.expandable"
        :class="props.fullscreen ? 'text-info bg-info/20' : 'text-base-content/40'"
        :title="props.fullscreen ? 'Свернуть в окно' : 'Во весь экран'"
        @click="$emit('toggle-fullscreen')"
      )
        Minimize2.w-4.h-4(v-if="props.fullscreen")
        Maximize2.w-4.h-4(v-else)
      button.btn.btn-xs.btn-ghost.btn-square(
        class="hover:text-error text-base-content/40"
        @click="$emit('close')"
        title="Закрыть"
      )
        X.w-4.h-4

    //- Панель настроек (поп-овер)
    .absolute.top-11.right-2.z-50.w-56.rounded-lg.p-3.shadow-xl(
      v-if="showSettings"
      class="bg-gray-900 border border-white/10 max-w-[calc(100vw-1rem)]"
    )
      .text-xs.font-bold.mb-2(
        class="text-base-content/70"
      ) НАСТРОЙКИ
      .flex.flex-col.gap-2
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Макс. агентов
          input.input.input-xs(type="number" v-model.number="userMaxAgents" min="1" max="50" placeholder="10")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Интервал пеших (мин-макс)
          .flex.gap-1
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMin" min="45" placeholder="60")
            input.input.input-xs.w-16(type="number" v-model.number="userPersonIntervalMax" min="45" placeholder="120")
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Интервал авто (мин-макс)
          .flex.gap-1
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMin" min="60" placeholder="90")
            input.input.input-xs.w-16(type="number" v-model.number="userCarIntervalMax" min="60" placeholder="180")
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
        label.flex.items-center.gap-2.text-xs.cursor-pointer(
          class="text-base-content/60"
        )
          input(type="checkbox" v-model="userArrivalBrake")
          span Торможение у точки останова
        label.flex.flex-col.text-xs(
          class="text-base-content/60"
        )
          span Громкость звука ({{ Math.round(userVolume * 100) }}%)
          input(type="range" min="0" max="100" step="5" v-model.number="userVolume" @input="userMuted = false")
        button.btn.btn-xs.btn-outline.btn-error.mt-2(@click="resetSettings") Сбросить

    //- [№28-ЖИВАЯ-ПАНЕЛЬ] компактная панель «Движение и логика людей» поверх
    //- симулятора: тумблер механизма + плавный ползунок у каждого параметра.
    //- Физика перечитывает настройки на каждом тике — изменения действуют сразу
    .absolute.top-11.right-2.z-50.w-72.flex.flex-col.rounded-lg.p-2.shadow-xl(
      v-if="showPeopleTuning"
      class="bg-gray-900 border border-white/10 max-h-[calc(100%-3.5rem)] max-w-[calc(100vw-1rem)]"
    )
      .flex.items-center.justify-between.mb-1.flex-none
        span(class="text-[10px] font-bold text-base-content/70") ДВИЖЕНИЕ И ЛОГИКА ЛЮДЕЙ
        .flex.items-center.gap-1
          button.btn.btn-ghost.btn-xs.px-1(
            class="text-warning"
            title="Сохранить значения в конфиг (переживут перезапуск приложения)"
            @click="savePersonTuning"
          ) сохранить
          button.btn.btn-ghost.btn-xs.px-1(
            class="text-warning"
            title="Вернуть все значения к дефолтам"
            @click="resetPersonTuning"
          ) сброс
      .flex.flex-col.min-h-0.overflow-y-auto(class="gap-0.5 pr-1")
        template(v-for="(f, i) in personTuningFields" :key="f.key")
          div(
            v-if="f.group && f.group !== (personTuningFields[i - 1]?.group ?? null)"
            class="mt-1 mb-0.5 px-1 uppercase tracking-wider text-[9px] font-bold text-base-content/40"
          ) {{ f.group }}
          div(
            class="rounded px-1 py-0.5 hover:bg-white/5"
            :class="f.toggleKey && !ptModel[f.toggleKey] ? 'opacity-40' : ''"
          )
            .flex.items-center.gap-1
              input.toggle.toggle-xs.toggle-primary(
                v-if="f.toggleKey"
                type="checkbox"
                v-model="ptModel[f.toggleKey]"
              )
              span.flex-1.truncate.leading-tight(
                :title="f.hint"
                class="text-[10px] text-base-content/80"
              ) {{ f.label }}
              span.whitespace-nowrap.font-mono(
                class="text-[10px] text-base-content/60"
              ) {{ fmtTuneVal(f, ptModel[f.key]) }} {{ f.unit }}
            input.w-full(
              class="range range-xs range-primary mt-0.5"
              type="range"
              :min="f.min"
              :max="f.max"
              :step="f.step"
              v-model.number="ptModel[f.key]"
            )

  //- Основной холст симуляции
  //- [БАГ-РЕПОРТ-8-ВЫРАВНИВАНИЕ] окно симулятора прижато ВЛЕВО (как было
  //- раньше): justify-start/items-start вместо центрирования.
  .relative.flex.flex-1.items-start.justify-start.overflow-hidden.bg-gray-800(ref="containerRef")
    //- [СХЕМА-ТРАЕКТОРИЙ] холст имеет КОНФИГ-размер сцены (например 1280x720)
    //- и целиком масштабируется под контейнер (scale, origin center).
    //- Раньше sceneSize перезаписывался размером контейнера: сцена обрезалась,
    //- а точки спавна/деспавна (fallback от sceneSize) ползли за контейнером.
    //- [БАГ-РЕПОРТ-8-ВЫРАВНИВАНИЕ] origin top-left: масштаб ведётся от
    //- левого-верхнего угла, сцена не уплывает от левого края
    //- [№16-FPS] счётчик кадров: текст пишет gameLoop раз в секунду напрямую в DOM (без ререндеров)
    .absolute.top-2.left-2.z-50.px-2.py-1.rounded.font-mono.text-xs.whitespace-nowrap(
      v-if="showFps"
      ref="fpsHudNode"
      class="bg-black/70 text-green-400"
    ) FPS
    .sim-canvas-wrapper.relative.overflow-hidden.shrink-0(
      :style="{ width: sceneSize.width + 'px', height: sceneSize.height + 'px', transform: `scale(${scale})`, transformOrigin: 'top left' }"
    )
      template(v-for="el in simElements" :key="el.id")
        //- [№14-ПЛАВНОСТЬ-DEV] :ref-колбеки регистрируют узлы в реестрах paint-моста;
        //- монтирующие стили читают RAW-объект (см. getElementStyle), поэтому рендер
        //- не подписывается на x/y/zIndex — покадровые записи делает paintScene
        .absolute.cursor-pointer(
          :style="getElementStyle(el)"
          :ref="n => setAgentNode(el, n)"
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
            :class="{ 'is-paused': mountPaused(el), 'is-exit': el.direction === 'exit' }"
            :style="personAvatarStyle(el)"
            :ref="n => setAvatarNode(el, n)"
          )
            //- [ФИКС-ЗЕРКАЛО] выходящие зеркалятся inline-стилем на обёртке:
            //- прежнее правило .person-avatar.is-exit :deep(svg) в сборке
            //- не срабатывало (специфичность/скоуп), и выходящие выглядели
            //- неотличимо от входящих. Inline-стиль не зависит от CSS-скоупа.
            .person-svg-container(v-html="el.asset.svg || ' '")
          .w-full.h-full.relative(v-else-if="el.asset?.type === 'car'")
            //- [№41-РАКУРСЫ] три вида машины: бок профиль виден по умолчанию,
            //- спереди/сзади скрыты CSS и включаются paint-мостом по settings._view
            //- (мгновенно, без ререндера — как зеркало/пауза ног).
            .car-svg-container.car-view-side(v-html="el.asset.svg || ' '")
            .car-svg-container.car-view-front(v-if="el.asset.svgFront" v-html="el.asset.svgFront || ' '")
            .car-svg-container.car-view-rear(v-if="el.asset.svgRear" v-html="el.asset.svgRear || ' '")
          .gate-wrapper.w-full.h-full(
            v-else-if="el.asset?.type === 'svg'"
            :data-gate-id="el.id"
            :style="getGateStyle(el)"
            :class="{ 'gate-unlocked': gateUnlocked(el) }"
            :ref="n => setGateNode(el, n)"
          )
            div(v-html="getDynamicSvg(el)")
          .w-full.h-full(v-else :style="{ backgroundColor: el.asset?.content || '#888' }")

      //- [№31-ШЕСТЕРНЯ] приводная шестерня у нижне-левого угла ворот: крутится
      //- при открытии (против часовой) и закрытии (по часовой); угол пишет paint
      template(v-for="el in gearGates" :key="'gear_' + el.id")
        .gate-gear-overlay.absolute.pointer-events-none(
          :style="gearStyle(el)"
          :ref="n => setGearNode(el, n)"
          v-html="gearMarkup"
        )

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
            :x1="cmdCenter(cmd.actor, 'x', 'width')" :y1="cmdCenter(cmd.actor, 'y', 'height')"
            :x2="cmdCenter(cmd.target, 'x', 'width')" :y2="cmdCenter(cmd.target, 'y', 'height')"
            :ref="n => setLineNode(cmd, n)"
            stroke="#22c55e" stroke-width="2" stroke-dasharray="4"
          )

      .absolute.inset-0.pointer-events-none(style="z-index: 1000")
        template(v-for="el in simElements" :key="'label_' + el.id")
          .absolute.text-label(
            v-if="(el.asset?.type === 'person' || el.asset?.type === 'car') && visibleAgentLabels.has(el.id)"
            :style="getLabelStyle(el)"
            :ref="n => setLabelNode(el, n)"
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

    //- [PAYROLL] HUD баланса: ребёнок containerRef, не scale-обёртки —
    //- иначе чип сжимался бы transform'ом сцены и ловил бы клики
    SimulatorPayrollHud

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

    //- [СМЕНА] симуляция запущена без принятой смены — всплывающее окно
    .absolute.inset-0.flex.items-center.justify-center(
      v-if="shiftWarningOpen"
      style="z-index: 1100"
      class="bg-black/70"
    )
      .rounded-xl.p-5.shadow-2xl(
        class="bg-gray-900 border border-white/10 w-85"
      )
        .flex.items-center.gap-2.mb-2
          ShieldAlert.w-5.h-5(class="text-warning")
          span.text-sm.font-bold(class="text-warning") Смена не принята
        p.text-xs.leading-relaxed.mb-4(
          class="text-base-content/70"
        ) Симуляция запущена без принятой смены. Примите смену, чтобы вести журнал проходов и начислять зарплату.
        .flex.justify-end.gap-2
          button.btn.btn-ghost.btn-xs(@click="shiftWarningOpen = false") Продолжить без смены
          button.btn.btn-primary.btn-xs(@click="acceptShiftFromSim") Принять смену
</template>

<script setup lang="ts">
// app/components/SimulatorWidget.vue — script
// [ИСПРАВЛЕНО v3]: типизация стилевых функций через CSSProperties — строковые
// литералы ('flex'/'absolute'/'none') без контекстного типа расширяются до
// string и не проходят CSSProperties; функции из useSimulatorUI/useSimulatorCore
// обёрнуты с приведением (их исходники возвращают widening-объекты).
import { ref, watch, onMounted, onUnmounted, nextTick, computed, reactive, toRaw } from 'vue'
import type { CSSProperties } from 'vue'
import TrafficRoad from './editor/TrafficRoad.vue'
// [PAYROLL] HUD баланса смены — оверлей поверх холста
import SimulatorPayrollHud from './SimulatorPayrollHud.vue'
import { useSimulatorCore } from '../composables/simulator/useSimulatorCore'
import { useSimulatorPhysics } from '../composables/simulator/useSimulatorPhysics'
import { useSimulatorSpawn } from '../composables/simulator/useSimulatorSpawn'
import { useSimulatorScripts } from '../composables/simulator/useSimulatorScripts'
import { useSimulatorAudio } from '../composables/simulator/useSimulatorAudio'
import { useSimulatorUI, type ActiveIntercom } from '../composables/simulator/useSimulatorUI'
import { useSimulatorRendering } from '../composables/simulator/useSimulatorRendering'
import { useSimulatorIntegration } from '../composables/useSimulatorIntegration'
// [PAYROLL] шина событий оплаты и реестр проходов (ground truth)
import { publishGateOpened, publishGateNoEntry } from '~/utils/payrollBus'
import { markPayrollPass, peekPayrollPass } from '~/utils/payrollPass'
// [№31-ШЕСТЕРНЯ] генератор SVG шестерни ворот
import { generateSlidingGateSVG, generateWicketSVG, getGateGearSvg } from '../constants/library'
import { useAudioEngine } from '../composables/useAudioEngine'
// [ФИКС-НАСТРОЙКИ] сохранение настроек поповера симулятора между запусками
import { loadWidgetSettings, saveWidgetSettings } from '~/utils/widgetSettings'
// [ФИКС-флуд-4] чистая санитизация интервалов спавна
import { sanitizeSpawnInterval } from '~/utils/simTuning'
// [№28-ЖИВАЯ-ПАНЕЛЬ] реестр настроек движения/логики людей: компактная панель
// поверх симулятора (значения живут в config.simulator.personTuning и
// применяются физикой на ходу — refreshPersonTuning на каждом тике)
import { PERSON_TUNING_FIELDS, defaultPersonTuning } from '~/utils/personTuning'
import type { PersonTuningField } from '~/utils/personTuning'
import { useConfig } from '~/composables/useConfig'
// [СМЕНА] напоминание о принятии смены при запуске симуляции
import { useShift } from '~/composables/useShift'
import {
  PERSON_WIDTH,
  PERSON_HEIGHT,
  CAR_WIDTH,
  CAR_HEIGHT
} from '~/utils/simulatorConstants'
// [№14-ПЛАВНОСТЬ-DEV] императивный мост физика -> DOM: покадровые стили пишутся
// напрямую (paintScene из gameLoop), Vue перерисовывает только структурные события
import {
  paintAgent, paintLabel, paintGate, paintGateGear, paintCommandLine,
  isAgentPaused, labelTransform, snapshotPrevPositions,
} from '~/utils/simulatorPaint'
// [Фаза 5] Lucide: хедер и empty state
import {
  Activity, SlidersHorizontal, X, Gauge,
  MonitorX, PencilRuler, ShieldAlert, Volume2, VolumeX, PersonStanding,
  Maximize2, Minimize2
} from '@lucide/vue'

const audio = useAudioEngine()

const props = defineProps<{
  config: any
  scripts?: any[]
  isRunning: boolean
  simSettings?: any
  /** [№39-МОБИЛЬНОЕ] показывать кнопку «во весь экран» (только док лейаута) */
  expandable?: boolean
  /** [№39-МОБИЛЬНОЕ] состояние «во весь экран» (владеет им лейаут) */
  fullscreen?: boolean
}>()
const emit = defineEmits(['close', 'toggle-fullscreen'])

// [СМЕНА] симуляция запущена без принятой смены — всплывающее напоминание.
// loadCurrentShift() перечитывает store 'shifts': активная смена могла ещё
// не попасть в память на момент монтирования дока.
const { currentShift, loadCurrentShift } = useShift()
const shiftStartModal = useState('shift-start-modal', () => false)
const shiftWarningOpen = ref(false)
const acceptShiftFromSim = () => {
  shiftWarningOpen.value = false
  shiftStartModal.value = true
}

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
// [№21-ТОРМОЖЕНИЕ] тумблер эксперимента заказчика: плавное торможение
// у точки останова (поповер «НАСТРОЙКИ», сохраняется в localStorage)
const userArrivalBrake = ref(true)

// [№15-ЗВУК] громкость/тишина симулятора: кнопка mute в хедере + слайдер
// в поповере. setMasterVolume в движке существовал, но не вызывался никем.
const userVolume = ref(0.6)
const userMuted = ref(false)
const effectiveVolume = computed(() => (userMuted.value ? 0 : userVolume.value))
const applyMasterVolume = () => audio.setMasterVolume(effectiveVolume.value)
// Сворачивание окна: rAF замирает, а зацикленные двигатели продолжают
// звучать с последней громкостью — глушим masterGain до возврата.
const onVisibilityChange = () => {
  audio.setMasterVolume(document.hidden ? 0 : effectiveVolume.value)
}

const resetSettings = () => {
  userMaxAgents.value = null
  userPersonIntervalMin.value = null
  userPersonIntervalMax.value = null
  userCarIntervalMin.value = null
  userCarIntervalMax.value = null
  userMaxGroupSize.value = null
  userMaxNonFamily.value = null
  userArrivalBrake.value = true
  showSettings.value = false
}

// [ФИКС-НАСТРОЙКИ] настройки поповера («Макс. агентов» и остальные)
// сохраняются в localStorage и восстанавливаются при монтировании:
// док-панель монтируется через v-if и раньше обнуляла их при каждом
// открытии/перезапуске приложения. null = «не задано пользователем».
const getLocalStorage = (): Storage | null =>
  (typeof localStorage !== 'undefined') ? localStorage : null

const applySavedWidgetSettings = () => {
  const saved = loadWidgetSettings(getLocalStorage())
  userMaxAgents.value = saved.maxAgents
  userPersonIntervalMin.value = saved.personIntervalMin
  userPersonIntervalMax.value = saved.personIntervalMax
  userCarIntervalMin.value = saved.carIntervalMin
  userCarIntervalMax.value = saved.carIntervalMax
  userMaxGroupSize.value = saved.maxGroupSize
  userMaxNonFamily.value = saved.maxNonFamily
  userVolume.value = saved.volume ?? 0.6
  userMuted.value = saved.muted ?? false
  userArrivalBrake.value = saved.arrivalBrake !== false
}
applySavedWidgetSettings()

let widgetSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [userMaxAgents, userPersonIntervalMin, userPersonIntervalMax,
   userCarIntervalMin, userCarIntervalMax, userMaxGroupSize, userMaxNonFamily,
   userArrivalBrake, userVolume, userMuted],
  () => {
    if (widgetSaveTimer) clearTimeout(widgetSaveTimer)
    widgetSaveTimer = setTimeout(() => {
      saveWidgetSettings(getLocalStorage(), {
        maxAgents: userMaxAgents.value,
        personIntervalMin: userPersonIntervalMin.value,
        personIntervalMax: userPersonIntervalMax.value,
        carIntervalMin: userCarIntervalMin.value,
        carIntervalMax: userCarIntervalMax.value,
        maxGroupSize: userMaxGroupSize.value,
        maxNonFamily: userMaxNonFamily.value,
        volume: userVolume.value,
        muted: userMuted.value,
        arrivalBrake: userArrivalBrake.value,
      })
    }, 400)
  }
)

// [№17-ЗВУК] кнопка mute и слайдер громкости не меняли фактическую громкость:
// applyMasterVolume вызывался только при монтировании/возврате видимости/
// первом клике (unlock), а вотчера на userVolume/userMuted не было — клик
// лишь переворачивал флаг и сохранял его в localStorage. Теперь любое
// изменение громкости/тишины немедленно применяется к masterGain.
watch([userVolume, userMuted], () => applyMasterVolume())

const integration = useSimulatorIntegration()
const { allPeople, usedPeopleIds } = integration

// [ИСПРАВЛЕНО] алиасы + типизированные обёртки: возврат core/ui-функций —
// объекты с расширенными до string литералами, приведение через as CSSProperties
const { getElementStyle: _getElementStyle, getGateStyle: _getGateStyle, ...core } = useSimulatorCore(simElements)
// [№14-ПЛАВНОСТЬ-DEV] монтирующие стили читают СЫРЫЙ объект (toRaw): чтение прокси
// в рендере подписывало бы виджет на x/y/zIndex/settings — пересборка каждый кадр.
// Реактивными остаются только структурные поля (id, name, occupants, asset).
const getElementStyle = (el: any): CSSProperties =>
  _getElementStyle(toRaw(el), lastPaintAlpha) as CSSProperties
const getGateStyle = (el: any): CSSProperties => _getGateStyle(toRaw(el)) as CSSProperties

// [№24-РУЧКА] разблокированная калитка (ручка зелёная/повёрнута) — CSS-класс
// на обёртке ворот; сам поворот и цвет делает main.css, покадровых записей нет.
// isAjar и wicketAjar — один и тот же замок (второй ключ читает физика).
const gateUnlocked = (el: any): boolean => {
  const s: any = el?.settings
  return !!(s && (s.isOpen || s.isAjar || s.wicketAjar))
}

// [П1][№12] темп шага: --walk-hold задаёт ФАЗУ CSS-анимации ходьбы
// (секунды). Физика наращивает фазу пропорционально пути
// (settings._walkHold), когда человек идёт медленнее крейсерской, —
// ноги перебирают реже и никогда быстрее естественного темпа.
// Выходящие сохраняют зеркало на этой же обёртке.
const personAvatarStyle = (el: any): Record<string, string> => {
  const r = toRaw(el)
  const style: Record<string, string> = {
    '--walk-hold': String((r.settings as any)?._walkHold ?? 0),
  }
  if (r.direction === 'exit') style.transform = 'scaleX(-1)'
  return style
}

// [ФИКС-флуд-4] интервалы машин: дефолт 90-180с (было 60-120с), пол 60с,
// потолок минимума 180с. Санитизация — чистая функция
// sanitizeSpawnInterval (tests/sim-tuning.test.ts).
const simOpts = computed(() => {
  const car = sanitizeSpawnInterval(
    userCarIntervalMin.value ?? props.simSettings?.carSpawnIntervalMin,
    userCarIntervalMax.value ?? props.simSettings?.carSpawnIntervalMax,
    60, 180, 90, 180,
  )
  return {
    ...props.simSettings,
    maxGroupSize: userMaxGroupSize.value ?? 4,
    maxNonFamily: userMaxNonFamily.value ?? 1,
    personWidth: PERSON_WIDTH,
    personHeight: PERSON_HEIGHT,
    carWidth: CAR_WIDTH,
    carHeight: CAR_HEIGHT,
    carSpawnIntervalMin: car.min,
    carSpawnIntervalMax: car.max,
  }
})

const spawn = useSimulatorSpawn(
  simElements, aiAgents, sceneSize,
  core.fixedXPerson, core.fixedYPerson, core.fixedXCar, core.fixedYCar,
  integration,
  simOpts
)

// --- [PAYROLL] Рождение событий оплаты ---
// Ручной режим — переключатель «Автозапись журнала» (Настройки → Симулятор).
// Авто-режим = свободная симуляция: журнал пишет система, из оплаты остаются
// только события ворот. Ручной режим = полный расчёт, включая записи.
const isManualJournal = computed(() => props.simSettings?.autoJournal === false)

// [stage-8.1] Тип прохода: settings.gateType — источник истины (его
// допроставляет useSimulatorCore при клике), иначе имя элемента, иначе
// ширина. Чистая ширина<=60 промахивалась по калиткам 80px без gateType —
// отсюда «ворота» в штрафах за проход через калитку.
const gateTypeOf = (gate: any): 'gate' | 'wicket' => {
  if (!gate) return 'gate'
  const s = gate.settings || {}
  if (s.gateType) return s.gateType === 'wicket' ? 'wicket' : 'gate'
  const name = String(gate.name || '').toLowerCase()
  if (name.includes('калитка') || name.includes('wicket')) return 'wicket'
  return gate.width && gate.width <= 60 ? 'wicket' : 'gate'
}

const onAgentArrive = (agent: any) => {
  if (!isManualJournal.value) return
  const personId = agent.element?.personId
  if (!personId) return
  // Члены группы идут следом за лидером — след прохода ведётся один
  // на группу, иначе наказания/бонусы умножаются на состав семьи
  if (agent.groupId && !agent.isLeader) return
  // След регистрируется на водителя/пешего. Пассажиров машины не наказываем:
  // за журнал отвечает водитель — иначе штрафы заспамят каждую поездку.
  // [PAYROLL stage-7.1] Попутчики запоминаются в следе (companionIds):
  // журнальная запись по ним оценивается по следу водителя/лидера, а
  // «запись без прохода» не штрафует за запись реального пассажира
  const companionIds: number[] = []
  if (agent.type === 'car' && Array.isArray(agent.occupants)) {
    for (const occ of agent.occupants) {
      if (occ?.id != null && Number(occ.id) !== Number(personId)) companionIds.push(Number(occ.id))
    }
  }
  if (Array.isArray(agent.groupMembers)) {
    for (const member of agent.groupMembers) {
      const memberId = member?.element?.personId
      if (memberId != null && Number(memberId) !== Number(personId)) companionIds.push(Number(memberId))
    }
  }
  // [stage-8.1] тип калитки/ворот фиксируем в следе по фактическому
  // объекту агента — формулировка штрафа не зависит от повторного
  // поиска элемента в момент пересечения
  const arriveGate = simElements.value.find(g => String(g.id) === String(agent.gateId ?? ''))
  markPayrollPass({
    personId,
    fio: agent.element?.name || '',
    plate: agent.element?.asset?.plate,
    direction: agent.direction,
    gateId: agent.gateId,
    gateType: gateTypeOf(arriveGate),
    ts: Date.now(),
    companionIds,
  })
}

const onAgentCrossing = (agent: any, waitMs: number, gate?: any) => {
  // Одно событие на группу (считаем лидера): семья из четырёх человек
  // не должна начислять бонус ворот четырежды
  if (agent.groupId && !agent.isLeader) return
  // Событие ворот — в обоих режимах: ворота открывает человек (кнопка
  // панели/клик), бонусы и штрафы ожидания честны и в свободной симуляции
  publishGateOpened({
    waitMs,
    gateType: gateTypeOf(gate),
    gateId: agent.gateId || (gate ? String(gate.id) : undefined),
    personId: agent.element?.personId,
    fio: agent.element?.name || '',
    plate: agent.element?.asset?.plate,
    direction: agent.direction,
  })
  // Открыл ворота, а записи нет — критический штраф (только ручной режим)
  if (isManualJournal.value && agent.element?.personId) {
    const pass = peekPayrollPass(agent.element.personId)
    if (pass && !pass.recordedTs) {
      publishGateNoEntry({
        personId: pass.personId,
        fio: pass.fio,
        plate: pass.plate,
        direction: pass.direction,
        gateId: pass.gateId,
        gateType: pass.gateType ?? gateTypeOf(gate),
      })
    }
  }
}

// [№15-ПЕРФ] кэш getTrafficConfig: раньше вызывался на КАЖДОГО агента в
// КАЖДОМ кадре из updateAgentAudio (фильтр всей сцены: 50 агентов x 60 кадров
// = до 3000 лишних фильтров/сек). Теперь один расчёт на кадр: gameLoop сбрасывает
// кэш первым вызовом, аудио и остальные подсистемы читают готовый объект.
let trafficConfigCache: ReturnType<typeof getTrafficConfig> | null = null
const getCachedTrafficConfig = () => {
  if (!trafficConfigCache) trafficConfigCache = getTrafficConfig()
  return trafficConfigCache
}

const audioCtrl = useSimulatorAudio(
  simElements, aiAgents, sceneSize,
  () => getCachedTrafficConfig(),
  activeIntercoms
)
const { visibleAgentLabels, initAudioPools, updateAllAudio, resetAllAudioTimers, stopAllCarEngines, cleanupAgentSounds } = audioCtrl

// [№21-ТОРМОЖЕНИЕ] тумблер торможения у точки останова: живой геттер поверх
// настроек сцены (физика читает simOpts.* на каждом тике; прототип
// сохраняет чтение остальных полей напрямую из props.simSettings)
// [№28-ЖИВАЯ-ПАНЕЛЬ] модель настроек людей для live-панели: объект
// props.simSettings.personTuning (общий с config.simulator — правки видны
// в Настройках и сохраняются кнопкой «сохранить»); если simSettings не
// передан (scenario-editor) — локальный фолбэк из дефолтов. Физика получает
// его через own-свойство personTuning (геттер) и перечитывает каждый тик.
const configStore = useConfig()
const showPeopleTuning = ref(false)
const personTuningFields = PERSON_TUNING_FIELDS
const localPersonTuning = reactive<Record<string, number | boolean>>(defaultPersonTuning())
const ptModel = computed<Record<string, number | boolean>>(() => {
  const pt = (props.simSettings as any)?.personTuning
  return pt && typeof pt === 'object' ? pt : localPersonTuning
})
const ensureTuningDefaults = () => {
  const pt = ptModel.value
  for (const [key, def] of Object.entries(defaultPersonTuning())) {
    if (pt[key] === undefined) pt[key] = def
  }
}
ensureTuningDefaults()
const fmtTuneVal = (f: PersonTuningField, v: unknown): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '--'
  return f.step < 1 ? n.toFixed(2) : String(Math.round(n))
}
const resetPersonTuning = () => Object.assign(ptModel.value, defaultPersonTuning())
const savePersonTuning = async () => {
  try {
    await configStore.saveConfig()
  } catch (e) {
    console.warn('[SimulatorWidget] настройки людей не сохранены:', e)
  }
}
const toggleSettingsPopover = () => {
  showSettings.value = !showSettings.value
  if (showSettings.value) showPeopleTuning.value = false
}
const togglePeopleTuning = () => {
  showPeopleTuning.value = !showPeopleTuning.value
  if (showPeopleTuning.value) {
    showSettings.value = false
    ensureTuningDefaults()
  }
}
const physicsSimOpts: any = Object.create((props.simSettings ?? {}) as object, {
  arrivalBrake: { get: () => userArrivalBrake.value, enumerable: true },
  // [№28-ЖИВАЯ-ПАНЕЛЬ] own-свойство с геттером: физика каждый тик читает
  // актуальный объект personTuning (панель работает даже без simSettings)
  personTuning: { get: () => ptModel.value, enumerable: true },
})

const physics = useSimulatorPhysics(
  simElements, aiAgents, sceneSize,
  core.openGateWithSound, core.closeGateWithSound, core.stopGate,
  physicsSimOpts,
  (agent) => {
    spawn.handleAgentDone(agent)
    cleanupAgentSounds(agent.id)
  },
  // [PAYROLL] хуки моментов «подошёл» и «начал проход»
  { onAgentArrive, onAgentCrossing }
)

const rendering = useSimulatorRendering(containerRef, sceneSize)
const { scale, updateScale, initScaling, cleanupScaling } = rendering

// [СХЕМА-ТРАЕКТОРИЙ] размер сцены задают настройки конфига — при их смене
// пересчитываем масштаб подгонки
watch(sceneSize, () => updateScale(), { deep: true })

const scriptsHandler = useSimulatorScripts(simElements, activeCommands, ref(props.isRunning), props.scripts)

const ui = useSimulatorUI(
  simElements, core.openGateWithSound, core.closeGateWithSound, core.stopGate,
  activeIntercoms,
  activeCallButtonId,
  core.unlockWicket
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
  // [№14-ПЛАВНОСТЬ-DEV] позиция translate3d от 0/0 (RAW): прежние left/top
  // пересчитывали layout каждый кадр; покадрово пишет paintScene (paintLabel)
  const r = toRaw(el)
  return {
    left: '0px',
    top: '0px',
    transform: labelTransform(r, lastPaintAlpha),
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
  // [ФИКС-маршрут] сцена «ворота + калитка без метки»: без этого фолбэка
  // пешеходным выбирались те же ворота — люди шли к автомобильному проходу
  if (!personGate && gates.length) personGate = gates.find(g => g !== carGate) ?? gates[0]

  // [ФИКС-флуд-2] санитарные пределы темпа: старые сцены хранят агрессивные
  // интервалы (4-10с) и перекрывали глобальные настройки; пол не даёт потоку
  // душить ручной журнал, потолок отсекает бессмысленные значения
  // [ФИКС-флуд-4] темп снижен ещё вдвое: пешие 60-120с (было 40-90с),
  // пол 45с, потолок минимума 150с, максимум до 300с. Санитизация —
  // чистая функция sanitizeSpawnInterval (tests/sim-tuning.test.ts).
  const person = sanitizeSpawnInterval(
    userPersonIntervalMin.value ?? st.intervalMin ?? st.spawnIntervalMin ?? props.simSettings?.spawnIntervalMin,
    userPersonIntervalMax.value ?? st.intervalMax ?? st.spawnIntervalMax ?? props.simSettings?.spawnIntervalMax,
    45, 150, 60, 120,
  )

  return {
    enabled: st.enabled ?? true,
    // [ФИКС-флуд] Редактор сохраняет spawnIntervalMin/Max, симулятор читал
    // intervalMin — ключи не совпадали, интервал пешеходов всегда был
    // дефолтным 10-30с независимо от настроек. Цепочка: оверрайд поповера
    // -> сцена (оба ключа) -> глобальные настройки -> безопасный дефолт.
    intervalMin: person.min,
    intervalMax: person.max,
    personSpeed: st.personSpeed ?? 40,
    carSpeed: st.carSpeed ?? 100,
    carGateId: (st.carGateId ?? carGate?.id) || '',
    personGateId: (st.personGateId ?? personGate?.id) || '',
    gateCloseDelay: st.gateCloseDelay ?? 10,
    wicketCloseDelay: st.wicketCloseDelay ?? 0,
    maxAgents: Math.min(50, Math.max(1, Number(userMaxAgents.value ?? st.maxAgents ?? props.simSettings?.maxAgents ?? 10) || 10)),
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
    const s = toRaw(el.settings) || {}
    if (s.gateType === 'wicket') return generateWicketSVG(el.width || 80, el.height || 120, s)
    return generateSlidingGateSVG(el.width || 320, el.height || 120, s)
  }
  return el.asset?.content || ''
}

// [№31-ШЕСТЕРНЯ] шестерня ставится на откатные ворота/шлагбаум (не на калитку).
// Центр — нижне-левый угол полотна (точка привода), размер пропорционален высоте.
const gearGates = computed(() =>
  simElements.value.filter((el: any) => {
    const r = toRaw(el) as any
    return (r.category === 'gate' || r.category === 'barrier') &&
      r.asset?.type === 'svg' && r.settings?.gateType !== 'wicket'
  })
)
const GATE_GEAR_Z = 320 // над полотном ворот (300), под людьми базы (400+)
const gearStyle = (el: any): Record<string, string | number> => {
  const r = toRaw(el) as any
  const size = Math.round(Math.min(40, Math.max(18, (r.height || 120) * 0.28)))
  return {
    left: `${(r.x || 0) - size / 2}px`,
    top: `${(r.y || 0) + (r.height || 0) - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: GATE_GEAR_Z,
  }
}

// ---------------------------------------------------------------------------
// [№14-ПЛАВНОСТЬ-DEV] императивный paint-мост: реестры DOM-узлов + покадровая
// запись стилей из gameLoop, минуя ререндер Vue. Шаблон регистрирует узлы (:ref),
// Vue перерисовывает только структурные события (спавн/деспавн/клики/настройки).
// ---------------------------------------------------------------------------
const agentNodes = new Map<string, {
  node: HTMLElement | null
  avatar: HTMLElement | null
  // [№41-РАКУРСЫ] контейнеры видов машины (null у людей)
  carViews?: { side: HTMLElement | null; front: HTMLElement | null; rear: HTMLElement | null } | null
}>()
const labelNodes = new Map<string, HTMLElement | null>()
const gateNodes = new Map<string, HTMLElement | null>()
const lineNodes = new Map<string, SVGLineElement | null>()

const setAgentNode = (el: any, n: any) => {
  const id = String(el.id)
  const rec = agentNodes.get(id) ?? { node: null, avatar: null, carViews: null }
  rec.node = (n as HTMLElement) || null
  // [№41-РАКУРСЫ] контейнеры видов машины для paint-моста:
  // ищем ОДИН раз на монтировании, а не в покадровом цикле.
  rec.carViews = el.asset?.type === 'car' && n
    ? {
        side: (n.querySelector('.car-view-side') as HTMLElement | null),
        front: (n.querySelector('.car-view-front') as HTMLElement | null),
        rear: (n.querySelector('.car-view-rear') as HTMLElement | null),
      }
    : null
  agentNodes.set(id, rec)
}
const setAvatarNode = (el: any, n: any) => {
  const id = String(el.id)
  const rec = agentNodes.get(id) ?? { node: null, avatar: null }
  rec.avatar = (n as HTMLElement) || null
  agentNodes.set(id, rec)
}
const setLabelNode = (el: any, n: any) => {
  labelNodes.set(String(el.id), (n as HTMLElement) || null)
}
const setGateNode = (el: any, n: any) => {
  gateNodes.set(String(el.id), (n as HTMLElement) || null)
}
// [№31-ШЕСТЕРНЯ] DOM-узлы шестерён (ключ — id ворот) + их SVG-разметка
const gearNodes = new Map<string, HTMLElement | null>()
const gearMarkup = getGateGearSvg()
const setGearNode = (el: any, n: any) => {
  gearNodes.set(String(el.id), (n as HTMLElement) || null)
}
const setLineNode = (cmd: any, n: any) => {
  lineNodes.set(String(cmd.id), (n as SVGLineElement) || null)
}

// Начальный класс паузы конечностей (RAW — без подписки рендера)
const mountPaused = (el: any): boolean => isAgentPaused(toRaw(el))

// Центр элемента для линий команд на монтировании (RAW)
const cmdCenter = (el: any, axis: 'x' | 'y', size: 'width' | 'height'): string => {
  const r = toRaw(el) as any
  return String((r?.[axis] ?? 0) + (r?.[size] ?? 0) / 2)
}

// Чистка реестров при структурных изменениях (спавн/деспавн меняют длину)
const prunePaintMaps = () => {
  const ids = new Set<string>()
  for (const e of simElements.value) ids.add(String(toRaw(e).id))
  for (const k of Array.from(agentNodes.keys())) if (!ids.has(k)) agentNodes.delete(k)
  for (const k of Array.from(labelNodes.keys())) if (!ids.has(k)) labelNodes.delete(k)
  for (const k of Array.from(gateNodes.keys())) if (!ids.has(k)) gateNodes.delete(k)
  for (const k of Array.from(gearNodes.keys())) if (!ids.has(k)) gearNodes.delete(k)
  for (const k of Array.from(lineNodes.keys())) if (!ids.has(k)) lineNodes.delete(k)
}
watch(() => simElements.value.length, prunePaintMaps)

// Покадровая запись: агенты (позиция/слой/пауза ног/фаза шага), лейблы,
// стрелы ворот, линии команд. Чтение через toRaw — без прокси и без отслеживания.
const paintScene = (alpha = 1) => {
  // [№31-БЕЗ-ПОВОРОТА] флаг enableVisualRotation удалён — агенты не вращаются
  const els = simElements.value
  for (let i = 0; i < els.length; i++) {
    const el = toRaw(els[i]) as any
    const id = String(el.id)
    const rec = agentNodes.get(id)
    if (rec) paintAgent(rec, el, alpha)
    const ln = labelNodes.get(id)
    if (ln) paintLabel(ln, el, alpha)
    const gn = gateNodes.get(id)
    if (gn) paintGate(gn, el.settings)
    const gr = gearNodes.get(id)
    if (gr) paintGateGear(gr, el.settings, el.width)
  }
  const cmds = activeCommands.value
  for (let i = 0; i < cmds.length; i++) {
    const cmd = toRaw(cmds[i]) as any
    if (!cmd.actor || !cmd.target || cmd.isReversing) continue
    paintCommandLine(lineNodes.get(String(cmd.id)) ?? null, cmd.actor, cmd.target, alpha)
  }
}

// [№19-УТЕЧКА] флаг живого цикла: animationFrameId перезаписывается в трёх
// точках старта (mount/watch/gameLoop), cancel гасит только ПОСЛЕДНИЙ
// queued rAF - при повторных открытиях симулятора прошлые циклы
// оставались живыми (рывки со второго запуска: каждый rAF-тик
// дублировал физику/аудио/paint). Единый страж: новые кадры
// перевыставляются, только пока loopActive; stop гасит всё.
let animationFrameId: number | null = null
let loopActive = false
let lastTime = 0

// [№15-ФИКС-ШАГ] Физика — фиксированными подшагами 1/60с (аккумулятор),
// рендер — интерполяция между prev-снимком и текущим состоянием (alpha).
// Раньше dt равнялся длительности реального кадра (до 0.1с): каждый неровный
// кадр (dev-рантайм, GC, HMR) удваивал визуальный шаг — остаточные дёргания.
// Теперь неровность кадра меняет только ЧИСЛО подшагов, а не их длину.
const PHYSICS_FIXED_DT = 1 / 60
const PHYSICS_MAX_SUBSTEPS = 4 // анти-спираль: при лаге >66мс симуляция замедляется, а не телепортируется
let physicsAccumulator = 0
// [№17-ПРЫЖОК] последний alpha интерполяции: шаблонные стили
// (getElementStyle/getLabelStyle) обязаны писать ТУ ЖЕ интерполированную
// позицию, что и paint-мост — иначе структурный ререндер (спавн/деспавн/
// zIndex-событие) перезаписывает трансформы ВСЕХ агентов текущей физпозицией
// на один кадр: прыжок вперёд и назад (у заказчика читался как «телепорт
// за 2-3мм до точки остановки»; до №15 не проявлялся — интерполяции не было).
let lastPaintAlpha = 1
// [№16] переиспользуемый буфер RAW-элементов: без аллокации массива каждый
// кадр (раньше map() создавал новый массив 60 раз/сек — паузы GC в кадре).
const rawElsBuf: any[] = []
// [№16-FPS] прибор диагностики: средний FPS, % кадров >25мс (джанки) и худший кадр — окно 1с.
const showFps = ref(false)
const fpsHudNode = ref<HTMLElement | null>(null)
let fpsFrames = 0
let fpsJank = 0
let fpsWorst = 0
let fpsAccum = 0

const gameLoop = (timestamp: number) => {
  if (!props.isRunning || !loopActive) { loopActive = false; return }
  const rawDelta = timestamp - lastTime
  lastTime = timestamp
  const dt = Math.min(rawDelta / 1000, 0.1)
  // [№16-FPS] статистика кадра: окно 1с, запись текста напрямую в DOM (без ререндера)
  fpsFrames++
  fpsAccum += rawDelta
  if (rawDelta > fpsWorst) fpsWorst = rawDelta
  if (rawDelta > 25) fpsJank++
  if (fpsAccum >= 1000 && fpsFrames > 0) {
    const hud = fpsHudNode.value
    if (hud) hud.textContent = `FPS ${Math.round((fpsFrames * 1000) / fpsAccum)} · джанки ${Math.round((fpsJank / fpsFrames) * 100)}% · макс ${Math.round(fpsWorst)}мс`
    fpsFrames = 0
    fpsJank = 0
    fpsWorst = 0
    fpsAccum = 0
  }
  // [ФИКС-ЗАСТРЯНИЕ] броня игрового цикла: ЛЮБОЕ исключение в подсистеме
  // (спавн/физика/скрипты/аудио) раньше убивало rAF-цикл навсегда — вся
  // сцена замирала («зависают вошедшие люди»), а сторожа внутри физики
  // не спасали, потому что физика тоже больше не вызывалась. Каждый шаг
  // изолирован; requestAnimationFrame вне try — кадр всегда перевыстраивается.
  try {
    trafficConfigCache = null
    const cfg = getCachedTrafficConfig()
    // [ФИКС-ЗАСТРЯНИЕ] сторож ворот: лечит зависшие isAnimating/isOpen
    core.updateGateWatchdog(dt)
    let paintAlpha = 1 // [№15] доля подшага для интерполяции рендера
    if (cfg.enabled) {
      try {
        spawn.updateSpawnLogic(dt, cfg, allPeople.value.length > 0, cfg.maxAgents)
      } catch (e) { console.error('[gameLoop] спавн:', e) }
      try {
        // [№15-ФИКС-ШАГ] prev-снимок + подшаги фиксированной длины
        const elsNow = simElements.value
        if (rawElsBuf.length !== elsNow.length) rawElsBuf.length = elsNow.length
        for (let i = 0; i < elsNow.length; i++) rawElsBuf[i] = toRaw(elsNow[i]) as any
        snapshotPrevPositions(rawElsBuf)
        physicsAccumulator = Math.min(physicsAccumulator + dt, PHYSICS_FIXED_DT * (PHYSICS_MAX_SUBSTEPS + 1))
        let substeps = 0
        while (physicsAccumulator >= PHYSICS_FIXED_DT && substeps < PHYSICS_MAX_SUBSTEPS) {
          physics.updateAiMovement(PHYSICS_FIXED_DT, { carGateId: cfg.carGateId, personGateId: cfg.personGateId })
          physicsAccumulator -= PHYSICS_FIXED_DT
          substeps++
        }
        if (substeps === PHYSICS_MAX_SUBSTEPS) physicsAccumulator = 0 // сброс хвоста при лаге
        paintAlpha = Math.min(1, physicsAccumulator / PHYSICS_FIXED_DT)
        lastPaintAlpha = paintAlpha
      } catch (e) { console.error('[gameLoop] физика:', e) }
      try { scriptsHandler.processScriptLogic(dt) } catch (e) { console.error('[gameLoop] скрипты:', e) }
      try { scriptsHandler.updateActiveCommands(dt) } catch (e) { console.error('[gameLoop] команды:', e) }
    }
    try { updateAllAudio(dt) } catch (e) { console.error('[gameLoop] аудио:', e) }
    // [№14-ПЛАВНОСТЬ-DEV] покадровая запись стилей напрямую в DOM (агенты,
    // лейблы, стрелы ворот, линии команд) — без ререндера Vue
    try { paintScene(paintAlpha) } catch (e) { console.error('[gameLoop] paint:', e) }
  } catch (e) {
    console.error('[gameLoop] кадр:', e)
  }
  if (!loopActive) return // [№19-УТЕЧКА] цикл остановлен - не перевыставляться
  animationFrameId = requestAnimationFrame(gameLoop)
}

// [№19-УТЕЧКА] единая точка останова: cancel + сброс стража
const stopGameLoop = () => {
  loopActive = false
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null }
}
const startGameLoop = () => {
  if (loopActive) return // уже жив - повторный rAF создал бы второй цикл
  loopActive = true
  lastTime = performance.now()
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
    startGameLoop()
    } else {
    stopGameLoop()
    // [ФИКС-звук] Пауза/выключение симуляции: игровой цикл остановлен,
    // updateAllAudio не работает — глушим моторы машин и мотор ворот,
    // иначе гул продолжается с последней громкостью.
    resetAllAudioTimers()
    stopAllCarEngines()
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
  // [№15-ЗВУК] обработчик сворачивания окна + стартовая громкость
  document.addEventListener('visibilitychange', onVisibilityChange)
  applyMasterVolume()

  await integration.loadAllData()

  if (props.config && simElements.value.length === 0) {
    core.loadScene(props.config)
    await nextTick()
    core.updateFixedCoordinates(getTrafficConfig())
  }

  // [СХЕМА-ТРАЕКТОРИЙ] autoResize больше НЕ подменяет размер сцены размером
  // контейнера (это обрезало сцену и сдвигало fallback-точки спавна);
  // вместо этого пересчитывается масштаб подгонки
  const autoResize = props.simSettings?.autoResize ?? true
  if (autoResize && containerRef.value) {
    resizeObserver = new ResizeObserver(() => updateScale())
    resizeObserver.observe(containerRef.value)
    updateScale()
  } else {
    if (props.config?.settings?.width) sceneSize.value.width = props.config.settings.width
    if (props.config?.settings?.height) sceneSize.value.height = props.config.settings.height
    updateScale()
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
    applyMasterVolume() // [№15-ЗВУК] masterGain создан — применяем сохранённую громкость
  }
  window.addEventListener('click', unlock, { once: true })
  const c0 = audio.ctx()
  if (c0 && c0.state === 'suspended') {
    c0.resume()
  }

  // [СМЕНА] при КАЖДОМ запуске симулятора смена считается непринятой:
  // окно «Смена не принята» всплывает всегда, пока охранник не нажмёт
  // «Принять смену». loadCurrentShift лишь освежает данные активной смены.
  try {
    await loadCurrentShift()
  } catch (e) {
    console.warn('[SimulatorWidget] не удалось проверить смену:', e)
  }
  shiftWarningOpen.value = true

  if (props.isRunning) startGameLoop()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (resizeObserver) resizeObserver.disconnect()
  stopGameLoop()
  cleanupScaling()
  physics.clearAllTimers()
  resetAllAudioTimers()
  stopAllCarEngines()
  for (const agent of aiAgents.value) cleanupAgentSounds(agent.id)
  agentNodes.clear(); labelNodes.clear(); gateNodes.clear(); gearNodes.clear(); lineNodes.clear()
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

/* [№41-РАКУРСЫ] вертикальные ракурсы машины скрыты до первого paint:
   paint-мост пишет display block/none напрямую по settings._view. */
.car-view-front,
.car-view-rear {
  display: none;
}

.person-avatar.is-paused :deep(.anim-arm-l),
.person-avatar.is-paused :deep(.anim-arm-r),
.person-avatar.is-paused :deep(.anim-leg-l),
.person-avatar.is-paused :deep(.anim-leg-r),
.person-avatar.is-paused :deep(.body-bounce) {
  animation-play-state: paused !important;
}

/* [ФИКС-ЗЕРКАЛО] правило ".person-avatar.is-exit :deep(svg) { transform: scaleX(-1) }"
   удалено: в собранной версии оно не срабатывало. Зеркало выходящих теперь
   inline-стилем на обёртке .person-avatar (шаблон выше) — вне CSS-скоупа. */

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
