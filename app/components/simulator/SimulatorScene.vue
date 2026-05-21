<!-- app\components\simulator\SimulatorScene.vue -->
<template lang='pug'>
  .relative.overflow-hidden.border-r-2.border-gray-700.pointer-events-none(class="w-1/2")
    
    //- 1. ФОН
    .absolute.inset-0.z-0
      .absolute.top-0.left-0.right-0(class="h-1/4" :style='{ background: `linear-gradient(to bottom, ${scene.skyColorTop}, ${scene.skyColorBottom})` }')
      .absolute.left-0.right-0.bottom-12(class="top-1/4" :style='{ backgroundColor: scene.roadColor }')
      .absolute.bottom-0.left-0.right-0.h-12(:style='{ backgroundColor: scene.grassColor }')

    //- 2. СЛОЙ СНАРУЖИ (Z-10) - ПОД калиткой
    .absolute.inset-0.z-10.pointer-events-none
      
      //- Человек (всегда здесь)
      //- Исправлено: объединяем стили в один объект через массив
      .absolute.transition-all.ease-linear(v-if='personBack' 
        :style='[personBack.style, { transitionDuration: personBack.transitionMs + "ms" }]'
      )
        .sprite-anchor
          SpritePerson(:direction='personBack.direction' :is-moving='personBack.isMoving' :size-style='personStyle')
          .absolute.-top-8.px-2.py-0_5.rounded.text-white.text-xs.whitespace-nowrap.font-bold(class="left-1/2 -translate-x-1/2" :class='personBack.direction === "enter" ? "bg-blue-500" : "bg-red-500"')
            | {{ personBack.direction === 'enter' ? '⬇ ВЪЕЗД' : '⬆ ВЫЕЗД' }}

    //- 3. ВОРОТА
    .absolute.z-20(:style='{ top: "15%", height: "45%", left: "0", width: scene.gateWidthPercent + "%" }')
      .absolute.left-2.inset-y-0.w-5.bg-gray-700.shadow.z-20.rounded-t
      .absolute.right-0.inset-y-0.w-4.bg-gray-700.shadow.z-20
      .absolute.inset-0.z-10.gate-leaf(:style='{ transform: `translateX(-${gatePosition}%)` }')
        .absolute.inset-0(:style='barsStyle')
        .absolute.inset-0.border-4.border-gray-700.pointer-events-none

    //- 4. КАЛИТКА
    .absolute.z-20(:style='{ top: "15%", height: "45%", right: "0", width: (100 - scene.gateWidthPercent) + "%" }')
      .absolute.left-0.top-4.w-2.h-8.bg-gray-700.rounded-full.z-20
      .absolute.left-0.bottom-4.w-2.h-8.bg-gray-700.rounded-full.z-20
      .absolute.inset-0.origin-left.transition-transform.duration-500.z-10(
        :style='{ transform: wicketState === "unlocked" ? "perspective(500px) rotateY(-90deg)" : "rotateY(0deg)" }'
      )
        .absolute.inset-0(:style='barsStyle')
        .absolute.inset-0.border-2.border-gray-700.pointer-events-none

    //- 5. СЛОЙ ВНУТРИ (Z-30) - НАД калиткой
    .absolute.inset-0.z-30.pointer-events-none
      //- Пусто

</template>

<script setup lang="ts">
import { useSimulatorScene } from '~/composables/useSimulatorScene'
import SpriteVehicle from './SpriteVehicle.vue'
import SpritePerson from './SpritePerson.vue'

const props = defineProps<{
  gatePosition: number
  wicketState: 'locked' | 'unlocked'
  wicketIsClear: boolean
  config: any
  event: any
}>()

const { 
  scene, barsStyle, vehicleStyle, personStyle, 
  outsideVehicles, insideVehicles, 
  personFront, personBack, 
  personWalkDuration
} = useSimulatorScene(props)
</script>

<style scoped>
.gate-leaf {
  will-change: transform;
  transition: transform 1s linear; 
}

.sprite-anchor {
  transform: translate(-50%, -100%);
  position: absolute;
  will-change: transform;
  z-index: 5; 
}
</style>