<!-- app\components\simulator\sprites\PersonSprite.vue -->
<template lang='pug'>
  .person-sprite(:class='directionClass' 
    :style="{ '--skin': appearance.skinTone, '--top': appearance.topColor, '--bottom': appearance.bottomColor }")
    .head
    .torso
    .legs
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps(['direction', 'appearance'])
const directionClass = computed(() => props.direction)
</script>

<style scoped>
.person-sprite {
  width: 20px; height: 40px;
  position: relative;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
}
.head {
  width: 12px; height: 12px;
  background: var(--skin, #fcd34d);
  border-radius: 50%;
  margin: 0 auto 1px;
  border: 1px solid rgba(0,0,0,0.2);
}
.person-sprite.exit .head { filter: brightness(0.7); }

.torso {
  width: 14px; height: 14px;
  background: var(--top, #ef4444);
  margin: 0 auto;
  border-radius: 3px;
}
.person-sprite.exit .torso { filter: brightness(0.7); }

.legs {
  width: 14px; height: 10px;
  background: var(--bottom, #1e3a8a);
  margin: 0 auto;
}
.person-sprite.exit .legs { filter: brightness(0.7); }
</style>