<!-- app/components/simulator/PersonAvatar.vue -->
<template lang="pug">
//- Главный холст (логическая сетка 50x100)
svg(
  :viewBox='`0 0 50 100`'
  :width="width"
  :height="height"
  xmlns="http://www.w3.org/2000/svg"
  style="overflow: visible;"
)
  //- Группа всего персонажа (отвечает за покачивание и подскоки при ходьбе)
  g(
    :style='{ transform: mainTransform, transition: isMoving ? "none" : "transform 0.3s ease-out" }'
  )
    //- === 1. ЗАДНЯЯ РУКА (рисуется первой, чтобы быть ПОЗАДИ тела) ===
    g(:style='{ transformOrigin: `${backArmX}px 38px`, transform: `rotate(${backArmAngle}deg)` }')
      line(:x1="backArmX" y1="38" :x2="backArmX - 5" y2="56" :stroke="appearance.skinTone || '#fbbf24'" stroke-width="5" stroke-linecap="round")

    //- === 2. НОГИ ===
    //- Передняя нога (ближе к зрителю)
    g(:style='{ transformOrigin: `${frontLegX}px 64px`, transform: `rotate(${frontLegAngle}deg)` }')
      line(:x1="frontLegX" y1="64" :x2="frontLegX" y2="92" :stroke="legStrokeColor" :stroke-width="legStroke" stroke-linecap="round")
      ellipse(:cx="frontLegX" cy="95" rx="4" ry="2" :fill="appearance.shoeColor || '#1f2937'")
      
    //- Задняя нога (дальше от зрителя)
    g(:style='{ transformOrigin: `${backLegX}px 64px`, transform: `rotate(${backLegAngle}deg)` }')
      line(:x1="backLegX" y1="64" :x2="backLegX" y2="92" :stroke="legStrokeColor" :stroke-width="legStroke" stroke-linecap="round")
      ellipse(:cx="backLegX" cy="95" rx="4" ry="2" :fill="appearance.shoeColor || '#1f2937'")

    //- === ТУЛОВИЩЕ ===
    //- Мужское тело (прямоугольник)
    rect(:x="torsoL" y="32" :width="torsoW * 2" height="34" rx="4" :fill="appearance.topColor || '#3b82f6'" v-if="!isFemale")
    //- Женское тело (сложная кривая с талией, путь собирается в скрипте)
    path(:d="femaleTorsoPath" :fill="appearance.topColor || '#3b82f6'" v-else)

    //- === ОДЕЖДА НИЗА (накладывается поверх базового торса) ===
    //- Капюшон
    template(v-if="clothingStyle === 'hoodie'")
      path(d="M18 28 Q25 12 32 28 L30 38 L20 38 Z" :fill="darkenColor(appearance.topColor || '#3b82f6', 20)")
      
    //- Юбка
    template(v-if="clothingStyle === 'skirt'")
      path(:d='\`M${wL} 50 L${hipL - 2} 78 L${hipR + 2} 78 L${wR} 50 Z\`' :fill="appearance.skirtColor || '#64748b'")
      
    //- Платье
    template(v-if="clothingStyle === 'dress'")
      path(:d='\`M${wL - 1} 48 L${hipL - 3} 84 L${hipR + 3} 84 L${wR + 1} 48 Z\`' :fill="appearance.topColor || '#3b82f6'")
      
    //- Пиджак (спинка и полочки)
    template(v-if="clothingStyle === 'suit'")
      g(v-if="view === 'back'")
        path(:d='\`M${torsoL} 32 L25 38 ${torsoR} 32 ${torsoR} 66 ${torsoL} 66 Z\`' :fill="suitColor")
        line(x1="25" y1="38" x2="25" y2="66" stroke="black" stroke-width="1" opacity="0.3")
      g(v-if="view === 'front'")
        path(:d='\`M${torsoL} 32 ${torsoL+10} 52 ${torsoL} 52 Z\`' :fill="suitColor")
        path(:d='\`M${torsoR} 32 ${torsoR-10} 52 ${torsoR} 52 Z\`' :fill="suitColor")
        path(d="M24 36 L25 56 L26 36 Z" :fill="appearance.bottomColor || '#1e293b'")

    //- === 3. ПЕРЕДНЯЯ РУКА (рисуется после тела, чтобы перекрывать его) ===
    g(:style='{ transformOrigin: `${frontArmX}px 38px`, transform: `rotate(${frontArmAngle}deg)` }')
      line(:x1="frontArmX" y1="38" :x2="frontArmX + 5" y2="56" :stroke="appearance.skinTone || '#fbbf24'" stroke-width="5" stroke-linecap="round")

    //- === 4. ГОЛОВА ===
    ellipse(cx="25" cy="18" :rx="headRx" ry="13" :fill="appearance.skinTone || '#fbbf24'")

    //- === 5. ВОЛОСЫ ===
    g(:style='{ transformOrigin: "25px 18px", transform: hairTransform }')
      
      //- --- ВИД СЗАДИ ---
      template(v-if="view === 'back'")
        template(v-if="safeRecedingHairline")
          path(d="M14 12 Q11 20 14 24 L36 24 Q39 20 36 12 Z" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'long'")
          path(d="M12 24 Q14 4 25 5 Q35 4 38 24" :fill="appearance.hairColor || '#000'")
          path(d="M14 18 Q12 28 15 45" :stroke="appearance.hairColor || '#000'" stroke-width="6" fill="none" stroke-linecap="round")
          path(d="M36 18 Q38 28 35 45" :stroke="appearance.hairColor || '#000'" stroke-width="6" fill="none" stroke-linecap="round")
        template(v-else-if="safeHairStyle === 'braid'")
          path(d="M14 18 Q15 4 25 5 Q35 4 36 18" :fill="appearance.hairColor || '#000'")
          path(d="M24 18 L24 55 L26 55 L26 18" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'ponytail'")
          path(d="M14 18 Q15 4 25 5 Q35 4 36 18" :fill="appearance.hairColor || '#000'")
          path(d="M31 14 Q41 20 39 44 L36 42 Q37 20 29 16 Z" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'bun'")
          path(d="M14 18 Q15 4 25 5 Q35 4 36 18" :fill="appearance.hairColor || '#000'")
          circle(cx="25" cy="7" r="6" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'curly'")
          path(d="M13 16 Q19 4 25 5 Q31 4 37 16" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'mohawk'")
          path(d="M22 12 L23 0 L25 8 L27 -2 L29 12" :fill="appearance.hairColor || '#000'")
        template(v-else-if="safeHairStyle === 'short'")
          path(d="M14 24 Q12 4 25 5 Q38 4 36 24" :fill="appearance.hairColor || '#000'")

      //- --- ВИД СПЕРЕДИ ---
      template(v-if="view === 'front'")
        template(v-if="safeRecedingHairline")
          path(d="M12 16 Q13 10 16 12 L16 16 Z" :fill="appearance.hairColor || '#000'")
          path(d="M38 16 Q37 10 34 12 L34 16 Z" :fill="appearance.hairColor || '#000'")
        
        template(v-else-if="safeHairStyle !== 'bald' && !hasHat")
          template(v-if="safeHairStyle === 'mohawk'")
            path(d="M22 10 L23 0 L25 8 L27 -2 L29 10" :fill="appearance.hairColor || '#000'")
            
          path(d="M14 11 Q15 4 25 5 Q35 4 36 11" :fill="appearance.hairColor || '#000'" v-if="safeHairStyle === 'short'")
          
          path(d="M13 12 Q19 4 25 5 Q31 4 37 12" :fill="appearance.hairColor || '#000'" v-if="safeHairStyle === 'curly'")
          
          template(v-if="safeHairStyle === 'long'")
            path(d="M14 11 Q15 4 25 5 Q35 4 36 11" :fill="appearance.hairColor || '#000'")
            path(d="M14 11 Q12 18 15 38" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")
            path(d="M36 11 Q38 18 35 38" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")
          
          template(v-if="safeHairStyle === 'braid'")
            path(d="M14 11 Q15 4 25 5 Q35 4 36 11" :fill="appearance.hairColor || '#000'")
            path(d="M34 11 Q38 22 36 44" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")
          
          template(v-if="safeHairStyle === 'ponytail'")
            path(d="M14 11 Q15 4 25 5 Q35 4 36 11" :fill="appearance.hairColor || '#000'")
          
          template(v-if="safeHairStyle === 'bun'")
            path(d="M14 11 Q15 4 25 5 Q35 4 36 11" :fill="appearance.hairColor || '#000'")
            circle(cx="25" cy="7" r="6" :fill="appearance.hairColor || '#000'")

        template(v-if="safeHairStyle !== 'bald' && hasHat")
          path(d="M15 11 Q16 8 25 9 Q34 8 35 11" :fill="appearance.hairColor || '#000'" v-if="['short', 'long', 'braid', 'ponytail', 'sides'].includes(safeHairStyle)")
          path(d="M15 12 Q19 8 25 9 Q31 8 35 12" :fill="appearance.hairColor || '#000'" v-if="safeHairStyle === 'curly'")
          path(d="M20 11 Q19 8 25 9 Q31 8 30 11" :fill="appearance.hairColor || '#000'" v-if="safeHairStyle === 'bun'")
          
          //- Боковые пряди для длинных волос под шляпой
          template(v-if="safeHairStyle === 'long'")
            path(d="M15 11 Q13 18 16 38" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")
            path(d="M35 11 Q37 18 34 38" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")
          
          //- Коса под шляпой
          template(v-if="safeHairStyle === 'braid'")
            path(d="M34 11 Q38 22 36 44" :stroke="appearance.hairColor || '#000'" stroke-width="4" fill="none" stroke-linecap="round")

    //- === 6. ЛИЦО ===
    template(v-if="view === 'front'")
      circle(cx="21" cy="15" r="1.2" :fill="appearance.eyeColor || '#1e293b'")
      circle(cx="29" cy="15" r="1.2" :fill="appearance.eyeColor || '#1e293b'")
      
      //- Очки
      template(v-if="appearance.glasses === 'glasses'")
        rect(x="17.5" y="12" width="7" height="6" rx="1.5" stroke="#222" stroke-width="0.8" fill="none")
        rect(x="25.5" y="12" width="7" height="6" rx="1.15" stroke="#222" stroke-width="0.8" fill="none")
        path(d="M24.5 15 L25.5 15" stroke="#222" stroke-width="0.8")
        path(d="M17.5 14.5 L14 13.5" stroke="#222" stroke-width="0.8")
        path(d="M32.5 14.5 L36 13.5" stroke="#222" stroke-width="0.8")
      template(v-if="appearance.glasses === 'round'")
        circle(cx="21" cy="15" r="3.5" stroke="#222" stroke-width="0.8" fill="none")
        circle(cx="29" cy="15" r="3.5" stroke="#222" stroke-width="0.8" fill="none")
        path(d="M17 15 L14 14" stroke="#222" stroke-width="0.8")
        path(d="M33 15 L36 14" stroke="#222" stroke-width="0.8")
      template(v-if="appearance.glasses === 'sunglasses'")
        rect(x="17.5" y="11.5" width="7" height="7" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)")
        rect(x="25.5" y="11.5" width="7" height="7" rx="1.5" stroke="#111" stroke-width="1" fill="rgba(0,0,0,0.5)")
        path(d="M24.5 15 L25.5 15" stroke="#111" stroke-width="1.2")
        path(d="M17.5 14.5 L14 13.5" stroke="#111" stroke-width="1")
        path(d="M32.5 14.5 L36 13.5" stroke="#111" stroke-width="1")

      //- Рот
      path(d="M22 20 Q25 23 28 20" stroke="#1e293b" stroke-width="1" fill="none" stroke-linecap="round" v-if="isFemale")
      line(x1="22" y1="21" x2="28" y2="21" stroke="#1e293b" stroke-width="1" stroke-linecap="round" v-else)
      
      //- Ресницы (только у женщин)
      template(v-if="isFemale")
        line(x1="19" y1="13.5" x2="20.5" y2="12.5" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round")
        line(x1="31" y1="13.5" x2="29.5" y2="12.5" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round")

      //- Борода / Щетина
      template(v-if="appearance.facialHair && appearance.facialHair !== 'none'")
        rect(x="20" y="20" width="10" height="3" rx="1.5" :fill="appearance.hairColor || '#000'" v-if="appearance.facialHair === 'mustache'")
        path(d="M22 23 Q25 28 28 23" :fill="appearance.hairColor || '#000'" v-if="appearance.facialHair === 'goatee'")
        path(d="M18 23 Q25 34 32 23" :fill="appearance.hairColor || '#000'" v-if="appearance.facialHair === 'beard'")
        path(d="M21 20 Q25 24 29 20" :fill="appearance.hairColor || '#000'" v-if="appearance.facialHair === 'stubble'")

    //- === 7. ГОЛОВНОЙ УБОР ===
    template(v-if="hasHat")
      g(v-if="view === 'back'")
        path(d="M14 10 Q25 -2 36 10" :fill="hatColor" v-if="appearance.headwear === 'cap'")
        rect(x="10" y="10" width="30" height="3" rx="1.5" :fill="hatColor" v-if="appearance.headwear === 'cap'")
        rect(x="17" y="-4" width="16" height="13" rx="3" :fill="hatColor" v-if="appearance.headwear === 'hat'")
        rect(x="8" y="8" width="34" height="3" rx="1.5" :fill="hatColor" v-if="appearance.headwear === 'hat'")
        path(d="M15 12 Q16 -1 25 1 Q34 -1 35 12" :fill="hatColor" v-if="appearance.headwear === 'beanie'")
        rect(x="14" y="8" width="22" height="5" rx="2" :fill="hatColor" v-if="appearance.headwear === 'beanie'")
      g(v-if="view === 'front'")
        path(d="M14 10 Q25 -2 36 10" :fill="hatColor" v-if="appearance.headwear === 'cap'")
        rect(x="10" y="10" width="30" height="3" rx="1.5" :fill="hatColor" v-if="appearance.headwear === 'cap'")
        rect(x="17" y="-4" width="16" height="13" rx="3" :fill="hatColor" v-if="appearance.headwear === 'hat'")
        rect(x="8" y="8" width="34" height="3" rx="1.5" :fill="hatColor" v-if="appearance.headwear === 'hat'")
        path(d="M15 12 Q16 -1 25 1 Q34 -1 35 12" :fill="hatColor" v-if="appearance.headwear === 'beanie'")
        rect(x="14" y="8" width="22" height="5" rx="2" :fill="hatColor" v-if="appearance.headwear === 'beanie'")
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  appearance: any
  width: number
  height: number
  view: 'front' | 'back'
  isMoving?: boolean
}>()

const phase = ref(0)
let lastTime = performance.now()
let animFrame: number | null = null

const animate = (currentTime: number) => {
  const dt = (currentTime - lastTime) / 1000
  lastTime = currentTime
  if (props.isMoving) {
    const speed = props.appearance?.animation?.speed ?? 1
    phase.value += dt * 4 * speed
  }
  animFrame = requestAnimationFrame(animate)
}

onMounted(() => { animFrame = requestAnimationFrame(animate) })
onUnmounted(() => { if (animFrame) cancelAnimationFrame(animFrame) })

const isChild = computed(() => props.appearance?.ageGroup === 'child')
const isFemale = computed(() => props.appearance?.gender === 'female')
const hasHat = computed(() => props.appearance?.headwear && props.appearance?.headwear !== 'none')
const hatColor = computed(() => props.appearance?.headwearColor || '#1e293b')
const clothingStyle = computed(() => props.appearance?.clothingStyle || 'standard')
const suitColor = computed(() => props.appearance?.topColor ? darkenColor(props.appearance.topColor, 40) : '#000000')

const headRx = computed(() => 11 * (props.appearance?.faceWidth || 1))

const bodyScaleX = computed(() => props.appearance?.bodyWidth || 1)
const torsoW = computed(() => 12 * bodyScaleX.value)
const torsoL = computed(() => 25 - torsoW.value)
const torsoR = computed(() => 25 + torsoW.value)

const hipL = computed(() => 25 - (torsoW.value * 1.1))
const hipR = computed(() => 25 + (torsoW.value * 1.1))
const wL = computed(() => 25 - (torsoW.value * 0.65))
const wR = computed(() => 25 + (torsoW.value * 0.65))

const femaleTorsoPath = computed(() => {
  const sW = torsoW.value * 0.85 
  const sL = 25 - sW, sR = 25 + sW;
  const bottomL = hipL.value + 4; 
  const bottomR = hipR.value - 4;
  return `M${sL} 32 C${sL} 40 ${wL.value} 45 ${wL.value} 50 L${bottomL} 66 L${bottomR} 66 L${wR.value} 50 C${wR.value} 45 ${sR} 40 ${sR} 32 Z`;
})

const legStroke = computed(() => {
  if (isFemale.value && (clothingStyle.value === 'skirt' || clothingStyle.value === 'dress')) return 5;
  return isFemale.value ? 6 : 7;
})

const legStrokeColor = computed(() => {
  if (clothingStyle.value === 'skirt' || clothingStyle.value === 'dress') {
    return props.appearance?.skinTone || '#fbbf24'
  }
  return props.appearance?.bottomColor || '#1e293b'
})

const hairTransform = computed(() => `scale(${props.appearance?.faceWidth || 1}, 1)`)

const legBaseOffset = computed(() => isFemale.value ? 4 : 7)
const legSpread = computed(() => legBaseOffset.value + (bodyScaleX.value - 1) * 3)
const frontLegX = computed(() => 25 + legSpread.value)
const backLegX = computed(() => 25 - legSpread.value)

const armBaseOffset = computed(() => isFemale.value ? 9 : 10)
const armSpread = computed(() => armBaseOffset.value + (bodyScaleX.value - 1) * 2)
const frontArmX = computed(() => 25 + armSpread.value)
const backArmX = computed(() => 25 - armSpread.value)

const darkenColor = (hex: string, amount: number) => {
  hex = hex.replace('#', '')
  let r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amount)
  let g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amount)
  let b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const frontLegAngle = computed(() => Math.sin(phase.value) * ((props.appearance?.animation?.swingAmplitude ?? 3) / 10) * 25)
const backLegAngle = computed(() => -Math.sin(phase.value) * ((props.appearance?.animation?.swingAmplitude ?? 3) / 10) * 25)
const frontArmAngle = computed(() => -Math.sin(phase.value) * (props.appearance?.animation?.armSwing ?? 20))
const backArmAngle = computed(() => Math.sin(phase.value) * (props.appearance?.animation?.armSwing ?? 20))
const bodySwayX = computed(() => Math.sin(phase.value) * ((props.appearance?.animation?.swingAmplitude ?? 3) / 10) * 2)
const bodyBounceY = computed(() => -Math.pow(Math.sin(phase.value), 2) * ((props.appearance?.animation?.bounceAmplitude ?? 2) / 8) * 3.5)

const mainTransform = computed(() => {
  const sway = `translate(${bodySwayX.value}px, ${bodyBounceY.value}px)`
  return isChild.value ? `scale(0.8) ${sway}` : sway
})

// ЗАЩИТА: мужчины не могут иметь женские прически, даже если в базе данных ошибка
const safeHairStyle = computed(() => {
  const id = props.appearance?.hairStyleId;
  if (props.appearance?.gender === 'male' && ['long', 'ponytail', 'bun', 'braid'].includes(id)) {
    return 'short'; 
  }
  // Женщины не могут иметь ирокез (кроме детей)
  if (props.appearance?.gender === 'female' && id === 'mohawk' && props.appearance?.ageGroup !== 'child') {
    return 'short';
  }
  return id;
})

// Пожилые мужчины ВСЕГДА имеют залысины визуально
const safeRecedingHairline = computed(() => {
  if (props.appearance?.gender === 'male' && props.appearance?.ageGroup === 'elder') {
    return true;
  }
  return props.appearance?.hasRecedingHairline || false;
})
</script>

<style scoped>
line { shape-rendering: geometricPrecision; }
</style>