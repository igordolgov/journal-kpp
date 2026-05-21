<!-- sprites\VehicleSprite.vue -->
<template lang='pug'>
  .vehicle-sprite(:class='directionClass')
    .body
      .windshield(v-if='isFront')
      .trunk(v-if='isRear')
    .cabin(v-if='isFront')
    .roof(v-if='isRear')
    .wheel.front
    .wheel.back
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps(['direction'])
const isFront = computed(() => props.direction === 'enter') // Въезд = вид спереди
const isRear = computed(() => props.direction === 'exit')   // Выезд = вид сзади
const directionClass = computed(() => props.direction)
</script>

<style scoped>
.vehicle-sprite {
  width: 60px; height: 100px;
  position: relative;
  filter: drop-shadow(0 5px 5px rgba(0,0,0,0.3));
}
/* Кузова */
.body {
  width: 100%; height: 45%;
  background: #3b82f6;
  position: absolute; top: 25%;
  border: 2px solid #1e40af;
  border-radius: 8px;
}
/* Вид спереди (Въезд) */
.vehicle-sprite.enter .body { top: 35%; border-radius: 8px 8px 4px 4px; }
.cabin {
  position: absolute; width: 80%; height: 20%;
  background: #1e3a8a; top: 40%; left: 10%;
  border-radius: 2px;
}
.windshield {
  position: absolute; width: 80%; height: 15%;
  background: rgba(255,255,255,0.3);
  top: 38%; left: 10%;
}

/* Вид сзади (Выезд) */
.vehicle-sprite.exit .body { top: 25%; background: #2563eb; }
.roof {
  position: absolute; width: 70%; height: 25%;
  background: #1e40af; top: 20%; left: 15%;
  border-radius: 3px;
}
.trunk {
  position: absolute; width: 60%; height: 10%;
  background: #1e3a8a; top: 70%; left: 20%;
}

/* Колеса */
.wheel {
  width: 10px; height: 18px;
  background: #1f2937; border-radius: 3px;
  position: absolute;
}
.front { bottom: 10px; }
.back { top: 30px; }
</style>