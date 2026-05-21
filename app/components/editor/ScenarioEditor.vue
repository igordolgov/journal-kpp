<!-- components/editor/ScenarioEditor.vue -->
<template lang="pug">
.scenario-editor.flex.flex-col.h-full.bg-gray-900.text-white
  //- --- ПАНЕЛЬ УПРАВЛЕНИЯ ---
  .editor-toolbar.flex.flex-wrap.items-center.flex-none.gap-2.p-2.border-b.border-gray-700.bg-gray-800
    //- Вкладки сценариев
    .flex.flex-1.gap-1.overflow-x-auto.pb-1
      button.tab-item.flex.items-center.gap-1.px-3.py-1.rounded-md.text-xs.font-medium.cursor-pointer.transition-all.bg-gray-700.text-gray-300(
        v-for="s in scripts"
        :key="s.id"
        :class="{ 'bg-indigo-600 text-white': selectedScriptId === s.id }"
        class="hover:bg-gray-600"
        @click="$emit('select:script', s.id)"
      )
        span.trigger-icon.text-xs.opacity-70(v-if="s.trigger === 'scene_start'") ▶️
        span.trigger-icon.text-xs.opacity-70(v-else) ⏸️
        span.truncate {{ s.name }}
        button.close-btn.ml-1.opacity-50.hover_opacity-100(
          v-if="selectedScriptId === s.id"
          @click.stop="$emit('delete:script', s.id)"
        ) ✕

    //- Действия
    .flex.gap-2
      button.btn.btn-xs.btn-ghost.text-gray-400(@click="$emit('add:script')")
        span.mr-1 ➕
        | Сценарий
      button.btn.btn-xs.btn-ghost.text-gray-400(v-if="currentScript", @click="addTrack")
        span.mr-1 ➕
        | Дорожка

  //- --- ОСНОВНАЯ ОБЛАСТЬ ---
  .tracks-container.flex-1.overflow-y-auto.p-2.space-y-2(v-if="currentScript")
    //- Строка трека
    .track-row.flex.gap-2(v-for="(track, tIndex) in currentScript.tracks", :key="track.id")
      //- Заголовок трека
      .track-header.flex.flex-col.flex-shrink-0.justify-between.w-28.p-2.rounded-lg.bg-gray-800.border.border-gray-700
        input.input.input-ghost.input-xs.w-full.h-auto.p-0.font-bold.text-white(
          v-model="track.name", placeholder="Имя..."
        )
        .flex.items-center.justify-between.mt-1
          span.text-xxs.text-gray-500(v-if="tIndex > 0") Parallel
          button.btn.btn-xxs.btn-circle.btn-ghost.text-red-500(@click="removeTrack(tIndex)") ✕

      //- Таймлайн
      .track-timeline.flex.items-center.flex-1.gap-1.p-2.min-h-12.overflow-x-auto.rounded-lg.bg-gray-800.border.border-gray-700(
        :ref="el => setTrackRef(el, track.id)"
      )
        template(v-for="(block, bIndex) in track.sequence", :key="block.id")
          //- Блок
          .logic-block.flex.items-center.px-2.rounded.text-white.text-xs.font-medium.shadow.cursor-pointer.transition-all.relative.select-none.shrink-0.h-8(
            :class="getBlockClasses(block)"
            @click="openBlockEditor(track, block)"
          )
            span.icon.mr-1 {{ getBlockIcon(block) }}
            span.label {{ block.label }}
            
            //- Умные бейджи
            span.value-badge.ml-1.px-1.rounded.bg-black.bg-opacity-30.text-2xs.font-mono(
              v-if="getBadgeText(block)"
            ) {{ getBadgeText(block) }}

            button.delete-btn.absolute.-top-1.-right-1.w-4.h-4.bg-red-500.rounded-full.text-white.text-2xs.opacity-0.transition-opacity(
              @click.stop="removeBlock(track, bIndex)"
            ) ✕

          //- Стрелка
          .connector.text-gray-600.text-xs.select-none(v-if="bIndex < track.sequence.length - 1") →

        //- Кнопка добавления
        button.add-btn.px-3.py-1.rounded-lg.border-2.border-dashed.border-gray-600.text-gray-400.text-xs.font-bold.transition-all.bg-transparent.shrink-0.h-8.flex.items-center(
          class="hover:border-indigo-400 hover:text-indigo-300 hover:bg-gray-700"
          @click="openMenu($event, track)"
        ) ➕

  //- Плейсхолдер
  .flex-1.flex.items-center.justify-center.text-gray-500(v-else)
    .text-center
      p.text-2xl.mb-2 🎬
      p Выберите сценарий или создайте новый.

  //- --- МОДАЛКА РЕДАКТИРОВАНИЯ / ВВОДА ---
  dialog.modal(:class="isEditingBlock ? 'modal-open' : ''")
    .modal-box.max-w-xs.bg-gray-800.text-white.border.border-gray-700(v-if="editingBlock")
      h3.flex.items-center.gap-2.text-lg.font-bold.mb-4
        span {{ getBlockIcon(editingBlock) }}
        span {{ isCreatingNew ? 'Настройка:' : 'Редактирование:' }}

      //- 1. Ввод координат (Точка)
      template(v-if="editingBlock.type === 'point_coords'")
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Коорд. (X, Y)
          .flex.gap-2
            input.input.input-bordered.bg-gray-900.w-full(
              type="number", v-model.number="tempInput.x", placeholder="X"
            )
            input.input.input-bordered.bg-gray-900.w-full(
              type="number", v-model.number="tempInput.y", placeholder="Y"
            )

      //- 2. Ввод расстояния
      template(v-else-if="editingBlock.type === 'distance'")
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Расст.(px)
          input.input.input-bordered.bg-gray-900.w-full(
            type="number", v-model.number="tempInput.val", min="0"
          )

      //- 3. Выбор направления
      template(v-else-if="editingBlock.type === 'direction'")
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Направление
          .grid.grid-cols-4.gap-2.mt-1
            button.btn.btn-xl.bg-gray-700.text-white.border-2(
              v-for="dir in directions"
              :key="dir.val"
              :class="tempInput.val === dir.val ? 'border-blue-400 bg-gray-600' : 'border-transparent'"
              @click="tempInput.val = dir.val"
            ) {{ dir.icon }}

      //- 4. Настройки движения (Скорость)
      template(v-else-if="editingBlock.type === 'move'")
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Скорость (px/сек)
          input.input.input-bordered.bg-gray-900.w-full(
            type="number", v-model.number="editingBlock.valueConfig.speed"
          )

      //- 5. Настройки ожидания
      template(v-else-if="editingBlock.type === 'wait'")
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Длительность (сек)
          input.input.input-bordered.bg-gray-900.w-full(
            type="number", v-model.number="editingBlock.valueConfig.delay"
          )

      //- 6. Generic (прочее)
      template(v-else)
        .form-control.mb-3
          label.label
            span.label-text.text-gray-400 Значение
          input.input.input-bordered.bg-gray-900.w-full(
            v-model="editingBlock.valueConfig.exact"
          )

      .modal-action
        button.btn.btn-ghost.btn-sm(@click="closeBlockEditor") Отмена
        button.btn.btn-primary.btn-sm(@click="saveBlockChanges") Сохранить

  //- --- ВСПЛЫВАЮЩЕЕ МЕНЮ ---
  Teleport(to="body")
    .fixed.inset-0.z-40(v-if="menuState.isOpen", @click="closeMenu")
    transition(name="slide-up")
      .menu-card.fixed.z-50.w-72.max-h-96.overflow-y-auto.rounded-xl.border.border-gray-600.bg-gray-800.shadow-2xl(
        v-if="menuState.isOpen"
        :style="menuStyle"
        @click.stop
      )
        .p-2.border-b.border-gray-700.text-xs.font-bold.text-gray-300.uppercase.tracking-wider
          | {{ contextStatus.message || 'Выберите действие' }}

        .menu-section.p-2(v-if="availableActions.length > 0")
          .section-title.text-2xs.text-gray-500.uppercase.font-bold.mb-1.px-1 Действия
          .grid.grid-cols-2.gap-1
            button.menu-item.p-2.pl-5.rounded-md.text-sm.text-left.font-medium.text-gray-200.transition-colors.bg-transparent(
              v-for="opt in availableActions"
              :key="opt.type"
              class="hover:bg-gray-700"
              @click="selectOption(opt)"
            )
              span.mr-1 {{ getBlockIcon(opt) }}
              span {{ opt.label }}

        .menu-section.p-2(v-if="availableLogic.length > 0")
          .section-title.text-2xs.text-gray-500.uppercase.font-bold.mb-1.px-1 Логика
          .flex.flex-col.gap-1
            button.menu-item.w-full.p-2.rounded-md.text-sm.text-gray-200.text-left.bg-transparent(
              v-for="opt in availableLogic"
              :key="opt.type"
              class="hover:bg-gray-700"
              @click="selectOption(opt)"
            )
              span.mr-1 {{ getBlockIcon(opt) }}
              span {{ opt.label }}

        .menu-section.p-2(v-if="availableActors.length > 0")
          .section-title.text-2xs.text-gray-500.uppercase.font-bold.mb-1.px-1 Участники
          .flex.flex-col.gap-1
            button.menu-item.w-full.p-2.rounded-md.text-sm.text-gray-200.text-left.bg-transparent(
              v-for="opt in availableActors"
              :key="opt.type"
              class="hover:bg-gray-700"
              @click="selectOption(opt)"
            )
              span.mr-1 {{ getBlockIcon(opt) }}
              span {{ opt.label }}

        .menu-section.p-2(v-if="availableTargets.length > 0")
          .section-title.text-2xs.text-gray-500.uppercase.font-bold.mb-1.px-1 {{ targetSectionTitle }}
          .flex.flex-col.gap-1
            button.menu-item.w-full.p-2.rounded-md.text-sm.text-gray-200.text-left.bg-transparent(
              v-for="opt in availableTargets"
              :key="opt.type"
              class="hover:bg-gray-700"
              @click="selectOption(opt)"
            )
              span.mr-1 {{ getBlockIcon(opt) }}
              span {{ opt.label }}

        .menu-section.p-2(v-if="availableParams.length > 0")
          .section-title.text-2xs.text-gray-500.uppercase.font-bold.mb-1.px-1 Параметры
          .flex.flex-col.gap-1
            button.menu-item.w-full.p-2.rounded-md.text-sm.text-gray-200.text-left.bg-transparent(
              v-for="opt in availableParams"
              :key="opt.type"
              class="hover:bg-gray-700"
              @click="selectOption(opt)"
            )
              span.mr-1 {{ getBlockIcon(opt) }}
              span {{ opt.label }}
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import type { Script, ScriptTrack, LogicBlock, BlockKind, SceneElement } from '../../types/scene'

const props = defineProps<{
  scripts: Script[]
  selectedScriptId: string | null
  sceneElements?: SceneElement[]
}>()

const emit = defineEmits(['update:script', 'select:script', 'add:script', 'delete:script'])

// --- State ---
const isEditingBlock = ref(false)
const editingBlock = ref<LogicBlock | null>(null)
const editingTrack = ref<ScriptTrack | null>(null)
const isCreatingNew = ref(false) // Флаг: мы создаем новый блок или редактируем старый?

// Временное хранилище для простых инпутов (координаты, дистанция)
const tempInput = reactive({ x: 0, y: 0, val: '' as string | number })

const directions = [
  { val: 'up', icon: '⬆️' },
  { val: 'down', icon: '⬇️' },
  { val: 'left', icon: '⬅️' },
  { val: 'right', icon: '➡️' }
]

const menuState = reactive({
  isOpen: false,
  x: 0,
  y: 0,
  track: null as ScriptTrack | null
})

const trackRefs = reactive<Record<string, HTMLElement | null>>({})
const setTrackRef = (el: any, id: string) => { if (el) trackRefs[id] = el }

const scrollToBottom = (trackId: string) => {
  nextTick(() => {
    const el = trackRefs[trackId]
    if (el) el.scrollLeft = el.scrollWidth
  })
}

// --- Computed & Data ---
const currentScript = computed(() => props.scripts.find(s => s.id === props.selectedScriptId))
const currentTrackSequence = computed(() => menuState.track?.sequence || [])
const menuStyle = computed(() => ({ top: `${menuState.y}px`, left: `${menuState.x}px` }))

const icons: Record<string, string> = {
  spawn: '✨', despawn: '💨', move: '🚗', wait: '⏳', open: '🚪', speed: '⚡', delay: '⏱️',
  direction: '🧭', distance: '📏', point_coords: '📍', gate: '🚧', actor: '👤',
  loop: '🔄', condition: '❓', check_distance: '↔️', check_key: '🎹', wait_until: '⏹️', spawn_zone: '🅿️'
}

const getBlockIcon = (b: any) => icons[b.type] || (b.kind === 'actor' ? '👤' : '📦')

const getBlockClasses = (b: LogicBlock) => {
  const kindMap: Record<BlockKind, string> = {
    action: 'bg-blue-600 hover:bg-blue-500',
    logic: 'bg-pink-600 hover:bg-pink-500',
    actor: 'bg-emerald-600 hover:bg-emerald-500',
    target: 'bg-violet-600 hover:bg-violet-500',
    param: 'bg-amber-600 hover:bg-amber-500'
  }
  return kindMap[b.kind] || 'bg-gray-600'
}

// Генератор текста для бейджей
const getBadgeText = (b: LogicBlock) => {
  if (!b.valueConfig) return ''
  
  if (b.type === 'point_coords') {
    // Парсим строку "x, y"
    const parts = String(b.valueConfig.exact || '0,0').split(',')
    if (parts.length === 2) return `${parts[0].trim()}, ${parts[1].trim()}`
    return b.valueConfig.exact
  }
  if (b.type === 'distance') return `${b.valueConfig.exact || 0}px`
  if (b.type === 'direction') {
    const d = directions.find(d => d.val === b.valueConfig.exact)
    return d ? d.icon : b.valueConfig.exact
  }
  if (b.type === 'move') return `${b.valueConfig.speed || 200}px/c`
  if (b.type === 'wait') return `${b.valueConfig.delay || 1}c`
  
  return '' // Остальные не показываем, чтобы не захламлять
}

// --- Registry ---
const registry = computed(() => {
  const baseActions = [
    { kind: 'action' as BlockKind, type: 'spawn', label: 'Создать', valueConfig: { mode: 'exact', appearance: 'fade' } },
    { kind: 'action' as BlockKind, type: 'despawn', label: 'Удалить', valueConfig: { mode: 'exact', effect: 'fade' } },
    { kind: 'action' as BlockKind, type: 'move', label: 'Ехать', valueConfig: { mode: 'exact', speed: 200 } },
    { kind: 'action' as BlockKind, type: 'wait', label: 'Ждать', valueConfig: { mode: 'exact', delay: 1 } },
    { kind: 'action' as BlockKind, type: 'open', label: 'Открыть' },
  ]

  const baseLogic = [
    { kind: 'logic' as BlockKind, type: 'wait_until', label: 'Ждать условие' },
    { kind: 'logic' as BlockKind, type: 'check_distance', label: 'Проверка дистанции', valueConfig: { operator: '<', value: 50 } },
  ]

  // Параметры с пометкой immediateInput для открытия модалки
  const vectorParams = [
    { kind: 'param' as BlockKind, type: 'direction', label: 'Направление', meta: { immediateInput: true }, valueConfig: { mode: 'exact', exact: 'right' } },
    { kind: 'param' as BlockKind, type: 'distance', label: 'Расстояние', meta: { immediateInput: true }, valueConfig: { mode: 'exact', exact: 100 } },
  ]

  const actors: any[] = []
  const spawnZones: any[] = []
  const moveTargets: any[] = []

  if (props.sceneElements) {
    props.sceneElements.forEach(el => {
      const name = el.name || ''
      const isActor = ['car', 'truck', 'bus', 'human'].includes(el.category || '') || el.asset?.type === 'person'
      if (isActor) actors.push({ kind: 'actor' as BlockKind, type: el.id, label: name })

      const isSpawn = el.zoneType === 'spawn' || name.toLowerCase().includes('старт')
      const isTarget = ['gate', 'barrier', 'checkpoint'].includes(el.category || '') || name.toLowerCase().includes('финиш')

      if (isSpawn) spawnZones.push({ kind: 'target' as BlockKind, type: el.id, label: name, meta: { zoneType: el.zoneType } })
      if (isTarget) moveTargets.push({ kind: 'target' as BlockKind, type: el.id, label: name })
    })
  }

  // Добавляем опцию "Точка (X,Y)" с пометкой immediateInput
  const manualPoint = { kind: 'target' as BlockKind, type: 'point_coords', label: '📍 Точка (X,Y)', meta: { immediateInput: true }, valueConfig: { mode: 'exact', exact: '0, 0' } }
  
  if (spawnZones.length === 0) spawnZones.push(manualPoint)
  else spawnZones.push(manualPoint) // Всегда даем возможность ввести вручную

  if (moveTargets.length === 0) moveTargets.push(manualPoint)
  else moveTargets.push(manualPoint)

  if (actors.length === 0) actors.push({ kind: 'actor', type: 'any_car', label: 'Любая машина' })

  return {
    action: baseActions,
    logic: baseLogic,
    actors,
    spawnZones,
    moveTargets,
    param_vector: vectorParams
  }
})

// --- Context Logic ---
const analyzeContext = (sequence: LogicBlock[]) => {
  const state = { lastAction: null as LogicBlock | null, hasActor: false, hasTarget: false, hasDir: false, hasDist: false }

  // Сканируем хвост последовательности
  for (let i = sequence.length - 1; i >= 0; i--) {
    const b = sequence[i]
    if (b.kind === 'action' || b.kind === 'logic') { state.lastAction = b; break }
    if (b.kind === 'actor') state.hasActor = true
    if (b.kind === 'target') state.hasTarget = true
    if (b.type === 'direction') state.hasDir = true
    if (b.type === 'distance') state.hasDist = true
  }

  if (!state.lastAction) return { status: { isComplete: true, message: '', hint: '' }, needs: [] as any[] }

  const needs: any[] = []
  let isComplete = false, message = '', hint = ''
  const actionType = state.lastAction.type

  if (actionType === 'spawn') {
    if (!state.hasActor) { message = 'Кого создать?'; needs.push(...registry.value.actors) }
    else if (!state.hasTarget) { message = 'Где создать?'; needs.push(...registry.value.spawnZones) }
    else isComplete = true
  } else if (actionType === 'despawn') {
    if (!state.hasActor) { message = 'Кого удалить?'; needs.push(...registry.value.actors) }
    else isComplete = true
  } else if (actionType === 'move') {
    if (!state.hasActor) { message = 'Кто поедет?'; needs.push(...registry.value.actors) }
    else if (!state.hasTarget && !state.hasDir && !state.hasDist) {
      message = 'Куда ехать?'; needs.push(...registry.value.moveTargets); needs.push(...registry.value.param_vector)
    } else if (state.hasDir && !state.hasDist && !state.hasTarget) {
      message = 'Как далеко?'; needs.push(registry.value.param_vector.find(p => p.type === 'distance')!)
    } else if (state.hasDist && !state.hasDir && !state.hasTarget) {
      message = 'В какую сторону?'; needs.push(registry.value.param_vector.find(p => p.type === 'direction')!)
    } else isComplete = true
  } else if (actionType === 'check_distance') {
    if (!state.hasActor) { message = 'Кто проверяет?'; needs.push(...registry.value.actors) }
    else if (!state.hasTarget) { message = 'С чем сравнить?'; needs.push(...registry.value.actors); needs.push(...registry.value.moveTargets) }
    else isComplete = true
  } else if (actionType === 'wait_until') {
    if (!state.hasTarget) { message = 'Чего ждем?'; needs.push(...registry.value.moveTargets) }
    else isComplete = true
  } else isComplete = true

  return { status: { isComplete, message, hint }, needs }
}

const contextAnalysis = computed(() => analyzeContext(currentTrackSequence.value))
const contextStatus = computed(() => contextAnalysis.value.status)

const availableActions = computed(() => contextStatus.value.isComplete ? registry.value.action : [])
const availableLogic = computed(() => contextStatus.value.isComplete ? registry.value.logic : [])
const availableActors = computed(() => contextAnalysis.value.needs.filter(b => b.kind === 'actor'))
const availableTargets = computed(() => contextAnalysis.value.needs.filter(b => b.kind === 'target'))
const availableParams = computed(() => contextAnalysis.value.needs.filter(b => b.kind === 'param'))

const targetSectionTitle = computed(() => {
  const lastAction = currentTrackSequence.value.find(b => b.kind === 'action' || b.kind === 'logic')
  if (lastAction?.type === 'spawn') return '📍 Место спавна'
  if (lastAction?.type === 'move') return '🎯 Куда ехать'
  return 'Цель'
})

// --- Methods ---

const addTrack = () => {
  if (!currentScript.value) return
  const tracks = [...currentScript.value.tracks, { id: `t_${Date.now()}`, name: `Поток ${currentScript.value.tracks.length + 1}`, sequence: [] }]
  emit('update:script', { id: currentScript.value.id, key: 'tracks', val: tracks })
}

const removeTrack = (index: number) => {
  if (!currentScript.value) return
  const tracks = currentScript.value.tracks.filter((_, i) => i !== index)
  emit('update:script', { id: currentScript.value.id, key: 'tracks', val: tracks })
}

// ГЛАВНАЯ ЛОГИКА: Выбор опции из меню
const selectOption = (opt: any) => {
  if (!menuState.track) return

  // Если опция требует немедленного ввода (например, координаты)
  if (opt.meta?.immediateInput) {
    openInputModal(opt, menuState.track)
  } else {
    // Иначе просто добавляем блок
    addBlockToTrack(menuState.track, opt)
    closeMenu()
  }
}

const openInputModal = (opt: any, track: ScriptTrack) => {
  // Готовим темплейт блока
  const block = { ...opt, id: `b_${Date.now()}`, valueConfig: JSON.parse(JSON.stringify(opt.valueConfig || {})) }
  
  editingBlock.value = block
  editingTrack.value = track
  isCreatingNew.value = true
  
  // Парсинг начальных значений для инпутов
  if (opt.type === 'point_coords') {
    const [x, y] = String(block.valueConfig.exact || '0,0').split(',').map(Number)
    tempInput.x = x || 0
    tempInput.y = y || 0
  } else if (opt.type === 'distance') {
    tempInput.val = block.valueConfig.exact || 100
  } else if (opt.type === 'direction') {
    tempInput.val = block.valueConfig.exact || 'right'
  }

  closeMenu() // Закрываем контекстное меню, открываем модалку
  isEditingBlock.value = true
}

const saveBlockChanges = () => {
  if (!editingBlock.value || !editingTrack.value) return

  // Синтаксический сахар: обновляем valueConfig из временных инпутов
  if (editingBlock.value.type === 'point_coords') {
    editingBlock.value.valueConfig.exact = `${tempInput.x}, ${tempInput.y}`
  } else if (editingBlock.value.type === 'distance') {
    editingBlock.value.valueConfig.exact = tempInput.val
  } else if (editingBlock.value.type === 'direction') {
    editingBlock.value.valueConfig.exact = tempInput.val
  }

  if (isCreatingNew.value) {
    // Если это новый блок, добавляем его
    addBlockToTrack(editingTrack.value, editingBlock.value)
  } else {
    // Если редактируем старый, обновляем
    updateBlockInTrack(editingTrack.value, editingBlock.value)
  }

  closeBlockEditor()
}

const addBlockToTrack = (track: ScriptTrack, blockTemplate: any) => {
  const newBlock: LogicBlock = {
    ...blockTemplate,
    id: `b_${Date.now()}`,
    valueConfig: blockTemplate.valueConfig ? JSON.parse(JSON.stringify(blockTemplate.valueConfig)) : undefined
  }
  const updatedTracks = currentScript.value?.tracks.map(t =>
    t.id === track.id ? { ...t, sequence: [...t.sequence, newBlock] } : t
  )
  if (currentScript.value) {
    emit('update:script', { id: currentScript.value.id, key: 'tracks', val: updatedTracks })
    scrollToBottom(track.id)
  }
}

const updateBlockInTrack = (track: ScriptTrack, block: LogicBlock) => {
  const updatedTracks = currentScript.value?.tracks.map(t => {
    if (t.id === track.id) {
      return { ...t, sequence: t.sequence.map(b => b.id === block.id ? block : b) }
    }
    return t
  })
  if (currentScript.value) emit('update:script', { id: currentScript.value.id, key: 'tracks', val: updatedTracks })
}

const removeBlock = (track: ScriptTrack, index: number) => {
  const updatedTracks = currentScript.value?.tracks.map(t => {
    if (t.id === track.id) {
      const seq = [...t.sequence]; seq.splice(index, 1); return { ...t, sequence: seq }
    }
    return t
  })
  if (currentScript.value) emit('update:script', { id: currentScript.value.id, key: 'tracks', val: updatedTracks })
}

const openBlockEditor = (track: ScriptTrack, block: LogicBlock) => {
  // Разрешаем редактировать только осмысленные параметры
  const editable = ['move', 'wait', 'point_coords', 'distance', 'direction', 'spawn']
  if (!editable.includes(block.type)) return

  editingBlock.value = JSON.parse(JSON.stringify(block))
  editingTrack.value = track
  isCreatingNew.value = false // Режим редактирования

  // Парсинг данных в инпуты
  if (block.type === 'point_coords') {
    const [x, y] = String(block.valueConfig?.exact || '0,0').split(',').map(Number)
    tempInput.x = x || 0; tempInput.y = y || 0
  } else if (block.type === 'distance') {
    tempInput.val = block.valueConfig?.exact || 0
  } else if (block.type === 'direction') {
    tempInput.val = block.valueConfig?.exact || 'right'
  }

  isEditingBlock.value = true
}

const closeBlockEditor = () => {
  isEditingBlock.value = false
  editingBlock.value = null
  editingTrack.value = null
}

const openMenu = (event: MouseEvent, track: ScriptTrack) => {
  menuState.isOpen = true
  menuState.track = track
  let x = event.clientX, y = event.clientY
  const menuWidth = 288, menuHeight = 350, padding = 10
  if (x + menuWidth + padding > window.innerWidth) x = window.innerWidth - menuWidth - padding
  if (y + menuHeight + padding > window.innerHeight) y = window.innerHeight - menuHeight - padding
  menuState.x = Math.max(padding, x)
  menuState.y = Math.max(padding, y)
}

const closeMenu = () => {
  menuState.isOpen = false
  menuState.track = null
}
</script>

<style scoped>
.logic-block:hover .delete-btn { opacity: 1; }
.menu-item.type-action { border-left: 3px solid #2563eb; }
.menu-item.type-logic { border-left: 3px solid #db2777; }
.menu-item.type-actor { border-left: 3px solid #059669; }
.menu-item.type-target { border-left: 3px solid #7c3aed; }
.menu-item.type-param { border-left: 3px solid #d97706; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.15s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(10px); }
</style>