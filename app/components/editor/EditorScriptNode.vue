<template lang='pug'>
.node-wrapper.mb-2
  .card.border.bg-gray-800.border-gray-700.cursor-pointer(
    class="hover:border-blue-400"
    @click="$emit('select', node)"
  )
    .card-body.p-2.flex-row.items-center.justify-between
      .flex.items-center.gap-2
        span.badge.badge-sm.text-white(:class="colorClass") {{ icon }}
        .text-xs
          span.font-bold {{ title }}
          span.text-gray-500.ml-1 {{ desc }}
      
      .flex.gap-1
        //- Кнопка добавления с выбором ветки
        .dropdown.dropdown-end(v-if="hasChildren")
          label(tabindex="0" class="btn btn-xs btn-ghost btn-circle") +
          ul.dropdown-content.z-20.menu.p-2.shadow.bg-base-100.rounded-box.w-40.text-gray-800.text-xs
            li(v-for="opt in branchOptions" :key="opt.key")
              a(@click.stop="$emit('add-child', {parentId: node.id, type: 'action', branch: opt.key})") 
                | ➕ {{ opt.label }}
        
        button.btn.btn-xs.btn-ghost.btn-circle.text-error(@click.stop="$emit('delete', {node, siblings})") ✕

  //- Branches Rendering
  .flex.gap-2.mt-1(v-if="isCondition")
    .flex-1.pl-2.border-l-2.border-green-500.ml-3
      EditorScriptNode(
        v-for="(c, i) in node.branches.true" :key="c.id"
        :node="c" :siblings="node.branches.true" :depth="depth+1"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
      )
    .flex-1.pl-2.border-l-2.border-red-500
      EditorScriptNode(
        v-for="(c, i) in node.branches.false" :key="c.id"
        :node="c" :siblings="node.branches.false" :depth="depth+1"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
      )
      
  .pl-2.border-l-2.border-amber-500.ml-3.mt-1(v-if="isEvent")
    EditorScriptNode(
      v-for="(c, i) in node.branches.then" :key="c.id"
      :node="c" :siblings="node.branches.then" :depth="depth+1"
      @select="$emit('select', $event)"
      @delete="$emit('delete', $event)"
      @add-child="$emit('add-child', $event)"
    )

  .flex.flex-col.gap-1.mt-1(v-if="isTimer")
    .pl-2.border-l-2.border-emerald-500.ml-3
      EditorScriptNode(
        v-for="(c, i) in node.branches.on_tick" :key="c.id"
        :node="c" :siblings="node.branches.on_tick" :depth="depth+1"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
      )
    .pl-2.border-l-2.border-blue-500.ml-3
      EditorScriptNode(
        v-for="(c, i) in node.branches.on_complete" :key="c.id"
        :node="c" :siblings="node.branches.on_complete" :depth="depth+1"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
      )

  .pl-2.border-l-2.ml-3.mt-1(v-if="isParallel || isLoop" :style="{borderColor: isLoop ? '#f97316' : '#14b8a6'}")
    EditorScriptNode(
      v-for="(c, i) in node.branches.tasks" :key="c.id"
      :node="c" :siblings="node.branches.tasks" :depth="depth+1"
      @select="$emit('select', $event)"
      @delete="$emit('delete', $event)"
      @add-child="$emit('add-child', $event)"
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ScriptNode } from '../../types/scene'

const props = defineProps<{
  node: ScriptNode,
  siblings: ScriptNode[],
  depth: number
}>()

defineEmits(['select', 'delete', 'add-child'])

const isCondition = computed(() => props.node.nodeType === 'condition')
const isEvent = computed(() => props.node.nodeType === 'event')
const isTimer = computed(() => props.node.nodeType === 'timer')
const isParallel = computed(() => props.node.nodeType === 'parallel')
const isLoop = computed(() => props.node.nodeType === 'loop')
const hasChildren = computed(() => isCondition.value || isEvent.value || isTimer.value || isParallel.value || isLoop.value)

const colorClass = computed(() => {
  const map: Record<string, string> = {
    action: 'bg-blue-600', condition: 'bg-purple-600', parallel: 'bg-teal-600', loop: 'bg-orange-600',
    event: 'bg-amber-600', timer: 'bg-emerald-600', random: 'bg-rose-600'
  }
  return map[props.node.nodeType] || 'bg-gray-600'
})

const icon = computed(() => {
  if (props.node.nodeType === 'condition') return '❓'
  if (props.node.nodeType === 'event') return '📡'
  if (props.node.nodeType === 'timer') return '⏰'
  if (props.node.nodeType === 'loop') return '🔁'
  
  const n = props.node as any
  const icons: Record<string, string> = { 
    move: '🏃', move_relative: '➡️', rotate: '🔄', 
    gate_open: '🚪', gate_close: '🚪', car_honk: '📢', 
    traffic_light_red: '🔴', ui_message: '💬', wait: '⏳' 
  }
  return icons[n.type] || '⚙️'
})

const title = computed(() => {
  if (props.node.nodeType === 'condition') return 'Условие'
  if (props.node.nodeType === 'loop') return 'Цикл'
  if (props.node.nodeType === 'timer') return 'Таймер'
  if (props.node.nodeType === 'event') return 'Событие'
  
  const n = props.node as any
  const names: Record<string, string> = { 
    move: 'Идти', move_relative: 'Сдвинуть', 
    gate_open: 'Открыть', gate_close: 'Закрыть',
    ui_message: 'Сообщение', wait: 'Пауза'
  }
  return names[n.type] || 'Действие'
})

// Восстановлено описание (координаты, текст и т.д.)
const desc = computed(() => {
  const n = props.node as any
  if (props.node.nodeType === 'timer') return `${n.params.seconds} сек`
  if (n.type === 'move_relative') return `На ${n.params.x}, ${n.params.y}`
  if (n.type === 'ui_message') return n.params.text ? n.params.text.substring(0, 10) + '...' : ''
  return ''
})

// Опции для выпадающего меню (в какую ветку добавлять)
const branchOptions = computed(() => {
  if (isCondition.value) return [
    { key: 'true', label: 'Ветка ДА' },
    { key: 'false', label: 'Ветка НЕТ' }
  ]
  if (isTimer.value) return [
    { key: 'on_tick', label: 'Каждый тик' },
    { key: 'on_complete', label: 'По завершении' }
  ]
  if (isEvent.value) return [{ key: 'then', label: 'Тогда' }]
  if (isParallel.value || isLoop.value) return [{ key: 'tasks', label: 'В список' }]
  return []
})
</script>