<template lang='pug'>
  .mt-auto.pt-2.border-t.border-gray-700
    .flex.justify-between.items-end.gap-2
        
        //- -- БЛОК ПЕРЕГОВОРНИКА --
        .flex.flex-col.gap-1
            button.btn-square-yellow(@click='$emit("set-intercom", "gate")')
              span.text-lg 🚗
              span(class="text-[8px]") ВОР
            button.btn-square-yellow(@click='$emit("set-intercom", "wicket")')
              span.text-lg 🚶
              span(class="text-[8px]") КАЛ

        //- -- БЛОК КНОПОК --
        //- Группа Ворота
        .flex.flex-col.items-center
          .text-gray-500.uppercase.font-bold(class="text-[9px]") ВОРОТА
          .flex.gap-1
            button.btn-round-green(@click='$emit("gate-action", "open")')
              .led(:class='gatePosition >= 100 ? "led-on" : "led-off"')
              span.label ОТКР
            button.btn-round-green(@click='$emit("gate-action", "stop")')
              .led(:class='gateState === "moving" ? "led-on-red" : "led-off"')
              span.label СТОП
            button.btn-round-green(@click='$emit("gate-action", "close")')
              .led(:class='gatePosition <= 0 ? "led-on" : "led-off"')
              span.label ЗАКР

        //- Группа Калитка
        .flex.flex-col.items-center
          .text-gray-500.uppercase.font-bold(class="text-[9px]") КАЛИТКА
          .flex.gap-1
            button.btn-round-green(@click='$emit("wicket-action", "open")')
              .led(:class='wicketState === "unlocked" ? "led-on" : "led-off"')
              span.label ОТКР
            button.btn-round-green(@click='$emit("wicket-action", "close")')
              .led.led-off
              span.label ЗАКР
</template>

<script setup lang="ts">
defineProps<{
  gatePosition: number
  gateState: string
  wicketState: string
}>()

defineEmits(['set-intercom', 'gate-action', 'wicket-action'])
</script>

<style scoped>
/* --- КНОПКИ (Зеленые) --- */
.btn-round-green {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #15803d;
  border-bottom: 4px solid #166534;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  box-shadow: 0 6px 8px rgba(0,0,0,0.3);
  transition: all 0.1s;
  outline: none;
  color: white;
}
.btn-round-green:active {
  border-bottom-width: 0;
  transform: translateY(3px);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
  background-color: #16a34a;
}

/* --- ПЕРЕКЛЮЧАТЕЛИ (Желтые) --- */
.btn-square-yellow {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  background-color: #ca8a04;
  border-bottom: 3px solid #a16207;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.2);
  transition: all 0.1s;
  color: white;
}
.btn-square-yellow.active {
  background-color: #facc15;
  color: black;
  border-color: #eab308;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
  transform: scale(0.95);
}

/* --- ЛАМПОЧКИ --- */
.led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgba(0,0,0,0.3);
  transition: all 0.3s;
}
.led-off { background-color: rgba(0,0,0,0.4); box-shadow: inset 0 1px 2px rgba(0,0,0,0.5); }
.led-on { background-color: #22c55e; box-shadow: 0 0 8px #22c55e; }
.led-on-red { background-color: #ef4444; box-shadow: 0 0 8px #ef4444; }

.label {
  font-size: 7px;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
}
</style>