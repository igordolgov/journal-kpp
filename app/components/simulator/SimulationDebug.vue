<!-- components/simulator/SimulationDebug.vue -->
<template lang="pug">
.debug-layer.absolute.inset-0.pointer-events-none.z-50(
  v-if="enabled"
)
  svg.w-full.h-full(
    xmlns="http://www.w3.org/2000/svg"
    overflow="visible"
  )
    //- Проходимся по всем машинам
    template(v-for="v in vehicles" :key="v.id")
      //- 1. ГАБАРИТЫ (Зеленый полупрозрачный бокс)
      rect(
        :x="v.x"
        :y="v.y"
        :width="v.width"
        :height="v.height"
        fill="rgba(34, 197, 94, 0.2)"
        stroke="rgba(34, 197, 94, 0.8)"
        stroke-width="1"
        :transform="`rotate(${radToDeg(v.rotation || 0)}, ${v.x + v.width/2}, ${v.y + v.height/2})`"
      )

      //- 2. ВЕКТОР НАПРАВЛЕНИЯ (Красная линия)
      line(
        :x1="v.x + v.width/2"
        :y1="v.y + v.height/2"
        :x2="calcVectorX(v, 40)"
        :y2="calcVectorY(v, 40)"
        stroke="red"
        stroke-width="2"
        stroke-dasharray="4"
      )

      //- 3. ЗОНА ВИДИМОСТИ (Желтый "туннель" проверки)
      //- Мы рисуем полигон, который представляет собой "туннель" из физики
      polygon(
        :points="getVisionTunnel(v)"
        fill="rgba(250, 204, 21, 0.1)"
        stroke="rgba(250, 204, 21, 0.4)"
        stroke-width="1"
      )

      //- 4. ИНФОРМЕР СКОРОСТИ (Текст)
      text(
        :x="v.x + v.width/2"
        :y="v.y - 5"
        fill="white"
        font-size="10"
        text-anchor="middle"
        font-family="monospace"
      ) {{ Math.round(v.velocity || 0) }} km/h
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SimObject } from './usePhysics' // Импортируем интерфейс, если он вынесен, или определяем тут

const props = defineProps<{
  enabled: boolean
  vehicles: any[] // Массив машин
}>()

// Константы должны совпадать с физикой
const PHYSICS_CONSTS = {
  MIN_WIDTH: 20,
  LOOK_AHEAD_DIST: 200, // Дистанция "зрения" для отрисовки
}

const radToDeg = (rad: number) => rad * (180 / Math.PI)

// Хелперы для координат
const getCenter = (v: SimObject) => ({
  x: v.x + v.width / 2,
  y: v.y + v.height / 2
})

const calcVectorX = (v: SimObject, len: number) => {
  const rot = v.rotation || 0
  return getCenter(v).x + Math.cos(rot) * len
}
const calcVectorY = (v: SimObject, len: number) => {
  const rot = v.rotation || 0
  return getCenter(v).y + Math.sin(rot) * len
}

/**
 * Рисует "туннель" проверки коллизий.
 * Это точно та же геометрия, что используется в checkTrafficAhead.
 */
const getVisionTunnel = (v: SimObject) => {
  const center = getCenter(v)
  const rot = v.rotation || 0
  
  // Векторы направления и перпендикуляра
  const dirX = Math.cos(rot)
  const dirY = Math.sin(rot)
  
  // Перпендикуляр (нормаль)
  const perpX = -dirY
  const perpY = dirX

  // Параметры туннеля из физики
  // Берем половину ширины машины (как в логике)
  const halfW = (v.width || PHYSICS_CONSTS.MIN_WIDTH) / 2
  const length = PHYSICS_CONSTS.LOOK_AHEAD_DIST

  // 4 точки полигона
  // Левая ближняя
  const p1 = {
    x: center.x - perpX * halfW,
    y: center.y - perpY * halfW
  }
  // Правая ближняя
  const p2 = {
    x: center.x + perpX * halfW,
    y: center.y + perpY * halfW
  }
  // Правая дальняя
  const p3 = {
    x: center.x + dirX * length + perpX * halfW,
    y: center.y + dirY * length + perpY * halfW
  }
  // Левая дальняя
  const p4 = {
    x: center.x + dirX * length - perpX * halfW,
    y: center.y + dirY * length - perpY * halfW
  }

  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`
}
</script>

<style scoped>
.debug-layer {
  /* Убеждаемся, что слой поверх всего, но не мешает кликам */
  pointer-events: none;
}
</style>