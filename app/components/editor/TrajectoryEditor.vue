<!-- app/components/editor/TrajectoryEditor.vue -->
<template lang='pug'>
.rounded.bg-gray-800(
  class="p-2"
)
  //- Две колонки: Въезд | Выезд
  .grid.grid-cols-2(
    class="gap-6"
  )
    template(v-for="section in sections" :key="section.title")
      .trajectory-section
        //- Заголовок секции
        .section-title(
          :class="section.color"
        ) {{ section.title }}

        //- Точки
        template(v-for="point in section.points" :key="point.prefix")
          .trajectory-point
            .point-label(
              :class="point.color"
            )
              span.point-emoji {{ point.emoji }}
              span.point-text {{ point.label }}

            //- X и Y — в одной строке
            .point-inputs
              .input-pair
                .input-cell
                  span.input-label X
                  input.traj-input(
                    type="number"
                    step="1"
                    :value="settings?.[point.prefix+'X'] ?? ''"
                    @input="update(point.prefix, 'x', $event)"
                  )
                .input-cell
                  span.input-label Y
                  input.traj-input(
                    type="number"
                    step="1"
                    :value="settings?.[point.prefix+'Y'] ?? ''"
                    @input="update(point.prefix, 'y', $event)"
                  )
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  settings: Record<string, any> | null
  gateType: string | null | undefined
}>()

const emit = defineEmits<{
  (e: 'update:settings', settings: Record<string, any>): void
}>()

interface TrajectoryPoint {
  prefix: string
  label: string
  emoji: string
  color: string
}

interface TrajectorySection {
  title: string
  subtitle?: string
  color: string
  points: TrajectoryPoint[]
}

const sections = computed<TrajectorySection[]>(() => {
  const gate = props.gateType
  if (!gate) return []

  const isCar = gate === 'sliding'
  const emoji = isCar ? '🚗' : '👤'
  const enterColor = 'text-green-400'
  const exitColor = 'text-red-400'

  const enterPrefix = isCar ? 'EnterCar' : 'EnterPerson'
  const exitPrefix = isCar ? 'ExitCar' : 'ExitPerson'

  const makeSection = (direction: 'enter' | 'exit', color: string, emoji: string, prefix: string) => {
    const points: TrajectoryPoint[] = [
      { prefix: `spawn${prefix}`, label: 'Спавн', emoji, color: 'text-green-400' },
      { prefix: `stop${prefix}`, label: 'Остановка', emoji, color: direction === 'enter' ? (isCar ? 'text-orange-400' : 'text-cyan-400') : (isCar ? 'text-pink-400' : 'text-purple-400') },
      { prefix: `cross${prefix}`, label: 'Движение', emoji, color: 'text-yellow-400' },
      { prefix: `despawn${prefix}`, label: 'Деспавн', emoji, color: 'text-gray-400' }
    ]
    const title = direction === 'enter' ? (isCar ? '⬇ ВЪЕЗД' : '⬇ ВХОД') : (isCar ? '⬆ ВЫЕЗД' : '⬆ ВЫХОД')
    return { title, color, points }
  }

  return [
    makeSection('enter', enterColor, emoji, enterPrefix),
    makeSection('exit', exitColor, emoji, exitPrefix)
  ]
})

const update = (prefix: string, axis: 'x' | 'y', event: Event) => {
  const rawValue = (event.target as HTMLInputElement).value
  const newSettings = { ...(props.settings || {}) }
  const key = `${prefix}${axis.toUpperCase()}`
  if (rawValue === '' || rawValue === null) {
    delete newSettings[key]
  } else {
    newSettings[key] = Number(rawValue)
  }
  emit('update:settings', newSettings)
}
</script>

<style scoped>
/* ==========================================
   СЕКЦИЯ
   ========================================== */
.trajectory-section {
  min-width: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================
   ТОЧКА ТРАЕКТОРИИ
   ========================================== */
.trajectory-point {
  margin-bottom: 0.5rem;
}

.point-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.point-emoji {
  font-size: 12px;
  flex-shrink: 0;
}

.point-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================
   ПОЛЯ X / Y — В ОДНОЙ СТРОКЕ
   ========================================== */
.point-inputs {
  padding-left: 0.5rem;
}

.input-pair {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-cell {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.input-label {
  font-size: 10px;
  color: #6b7280;
  flex-shrink: 0;
  text-align: center;
}

.traj-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 4px;
  font-size: 11px;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 3px;
  color: #e5e7eb;
  outline: none;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
}
.traj-input::-webkit-outer-spin-button,
.traj-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.traj-input:focus {
  border-color: #3b82f6;
}

/* ==========================================
   БАЗОВЫЙ ШРИФТ
   ========================================== */
.text-xxs {
  font-size: 12px;
  line-height: 1.1;
}
</style>