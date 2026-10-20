<!-- app/components/simulator/PersonAvatar.vue -->
<!-- Назначение: SVG-аватар персонажа (вид спереди/сзади) с анимацией ходьбы.
     Логическая сетка 50x100; ВСЯ геометрия берётся из utils/avatarGeometry.ts
     (общий источник с personSvgRenderer.ts — симулятор рисует того же персонажа).
     [РЕФАКТОРИНГ 2026-10] Подгонка частей тела: плечи привязаны к краю торса,
     шея, локоть с изгибом, кисти, ботинки-туфли, капюшон, пиджак.
     [РЕФИТ ГОЛОВЫ 2026-10] Причёски/лицо/уборы вычисляются в computeHeadDecor
     из эллипса головы: волосы «сидят» на черепе при любом faceWidth, дубликаты
     путей с симулятором удалены (раньше масштабирующая группа scale(faceWidth)
     в симуляторе сдвигала волосы вбок, а височные пряди висели в воздухе).
     Анимация: общий rAF-тикер, стоп без рывка, стопы отрываются в фазе
     переноса, подскок физически корректен. -->
<template lang="pug">
svg(
  viewBox="0 0 50 100"
  :width="width"
  :height="height"
  xmlns="http://www.w3.org/2000/svg"
  style="overflow: visible;"
)
  //- Группа всего персонажа: покачивание + подскок + дыхание.
  //- Масштаб ребёнка вокруг точки земли (25, 97), чтобы ноги не отрывались от пола.
  g(:style="mainStyle")
    //- === 0. КАПЮШОН: задник (за всем телом, виден по бокам и над макушкой) ===
    path(
      v-if="clothingStyle === 'hoodie'"
      :d="geo.hood.backD"
      :fill="geo.hood.color"
    )

    //- === 1. ЗАДНЯЯ РУКА (рисуется первой, чтобы быть ПОЗАДИ тела) ===
    g(:style="backArmStyle")
      path(:d="geo.armBack.pathD" :stroke="geo.armBack.skinColor" :stroke-width="geo.armBack.stroke" fill="none" stroke-linecap="round")
      path(v-if="geo.armBack.sleeveD" :d="geo.armBack.sleeveD" :stroke="geo.armBack.sleeveColor" :stroke-width="geo.armBack.stroke + 0.7" fill="none" stroke-linecap="round")
      circle(:cx="geo.armBack.handCx" :cy="geo.armBack.handCy" :r="geo.armBack.handR" :fill="geo.armBack.skinColor")

    //- === 2. НОГИ (рисуются до торса: бёдра прикрыты) ===
    //- Задняя нога
    g(:style="backLegStyle")
      line(:x1="geo.legBack.hipX" :y1="geo.legBack.hipY" :x2="geo.legBack.hipX" :y2="geo.legBack.ankleY" :stroke="geo.legBack.color" :stroke-width="geo.legBack.stroke" stroke-linecap="round")
      path(:d="geo.legBack.shoeD" :fill="geo.legBack.shoeColor")

    //- Передняя нога
    g(:style="frontLegStyle")
      line(:x1="geo.legFront.hipX" :y1="geo.legFront.hipY" :x2="geo.legFront.hipX" :y2="geo.legFront.ankleY" :stroke="geo.legFront.color" :stroke-width="geo.legFront.stroke" stroke-linecap="round")
      path(:d="geo.legFront.shoeD" :fill="geo.legFront.shoeColor")

    //- === 3. ШЕЯ (соединяет голову и торс; низ прячется под торсом) ===
    rect(:x="geo.neck.x" :y="geo.neck.y" :width="geo.neck.w" :height="geo.neck.h" :fill="geo.skin")

    //- === ТУЛОВИЩЕ ===
    //- Мужское тело (прямоугольник)
    rect(:x="geo.torso.l" y="32" :width="geo.torso.w * 2" height="34" rx="4" :fill="appearance.topColor || '#3b82f6'" v-if="!geo.isFemale")
    //- Женское тело (кривая с талией)
    path(:d="geo.femaleTorsoPath" :fill="appearance.topColor || '#3b82f6'" v-else)

    //- === ОДЕЖДА (накладывается поверх базового торса) ===
    //- Юбка
    template(v-if="clothingStyle === 'skirt'")
      path(:d="geo.skirtPathD" :fill="appearance.skirtColor || '#64748b'")

    //- Платье
    template(v-if="clothingStyle === 'dress'")
      path(:d="geo.dressPathD" :fill="appearance.topColor || '#3b82f6'")

    //- Пиджак
    template(v-if="clothingStyle === 'suit'")
      g(v-if="view === 'back'")
        path(:d="geo.suit.backD" :fill="geo.suit.color")
        line(x1="25" y1="38" x2="25" y2="66" stroke="black" stroke-width="1" opacity="0.3")
      g(v-if="view === 'front'")
        path(:d="geo.suit.jacketFrontD" :fill="geo.suit.color")
        path(:d="geo.suit.shirtD" fill="#f8fafc")
        path(:d="geo.suit.tieKnotD" :fill="appearance.bottomColor || '#1e293b'")
        path(:d="geo.suit.tieBladeD" :fill="appearance.bottomColor || '#1e293b'")
        path(:d="geo.suit.lapelLD" stroke="black" stroke-width="0.8" fill="none" opacity="0.35")
        path(:d="geo.suit.lapelRD" stroke="black" stroke-width="0.8" fill="none" opacity="0.35")

    //- === 4. ПЕРЕДНЯЯ РУКА (рисуется после тела, чтобы перекрывать его) ===
    g(:style="frontArmStyle")
      path(:d="geo.armFront.pathD" :stroke="geo.armFront.skinColor" :stroke-width="geo.armFront.stroke" fill="none" stroke-linecap="round")
      path(v-if="geo.armFront.sleeveD" :d="geo.armFront.sleeveD" :stroke="geo.armFront.sleeveColor" :stroke-width="geo.armFront.stroke + 0.7" fill="none" stroke-linecap="round")
      circle(:cx="geo.armFront.handCx" :cy="geo.armFront.handCy" :r="geo.armFront.handR" :fill="geo.armFront.skinColor")

    //- === 5. УШИ + ГОЛОВА ===
    //- Уши рисуются ДО головы: видны половинки по бокам черепа
    g(v-html="decor.ears")
    ellipse(:cx="geo.head.cx" :cy="geo.head.cy" :rx="geo.head.rx" :ry="geo.head.ry" :fill="geo.skin")

    //- === 6. ВОЛОСЫ (включая чёлку из-под убора; координаты уже содержат faceWidth) ===
    g(v-html="decor.hair")

    //- === 7. ЛИЦО: глаза/брови/нос/рот, очки, растительность ===
    template(v-if="view === 'front'")
      g(v-html="decor.face")
      g(v-html="decor.glasses")
      g(v-html="decor.facialHair")

    //- === 8. КАПЮШОН: ободок поверх волос ===
    path(
      v-if="clothingStyle === 'hoodie'"
      :d="geo.hood.rimD"
      :fill="geo.hood.color"
    )

    //- === 9. ГОЛОВНОЙ УБОР (купол вычислен по эллипсу головы) ===
    g(v-if="hasHat" v-html="decor.hat")
</template>

<script setup lang="ts">
// app/components/simulator/PersonAvatar.vue — script
// Геометрия, поза и головной декор — из utils/avatarGeometry.ts;
// здесь только фаза анимации и стили трансформаций.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  computeAvatarGeometry,
  computeHeadDecor,
  walkPose,
  subscribeWalkTick,
  TAU,
  WALK_BASE_CYCLE_S,
} from '~/utils/avatarGeometry'

const props = defineProps<{
  appearance: any
  width: number
  height: number
  view: 'front' | 'back'
  isMoving?: boolean
}>()

// --- Фазы анимации (общий rAF-тикер на все аватары) ---
const phase = ref(0)
const walkWeight = ref(0) // 0..1: плавный старт/стоп без рывка
const breath = ref(0)     // тонкое дыхание в покое
let idlePhase = 0
let unsubTick: (() => void) | null = null

onMounted(() => {
  unsubTick = subscribeWalkTick((dt) => {
    idlePhase += dt
    const speed = props.appearance?.animation?.speed ?? 1
    if (props.isMoving) {
      walkWeight.value = Math.min(1, walkWeight.value + dt * 3.5)
      phase.value = (phase.value + ((dt * TAU) / WALK_BASE_CYCLE_S) * speed) % TAU
    } else if (walkWeight.value > 0) {
      // Стоп: фаза докручивается, амплитуды затухают — конечности плавно
      // приходят в нейтраль (раньше transition 0.3s дёргал их за один шаг)
      walkWeight.value = Math.max(0, walkWeight.value - dt * 4)
      phase.value = (phase.value + ((dt * TAU) / WALK_BASE_CYCLE_S) * speed) % TAU
    }
    breath.value = Math.sin(idlePhase * 1.7) * 0.3 * (1 - walkWeight.value)
  })
})
onUnmounted(() => {
  if (unsubTick) unsubTick()
  unsubTick = null
})

// --- Геометрия, поза и головной декор (причёска/лицо/убор) ---
const geo = computed(() => computeAvatarGeometry(props.appearance))
const pose = computed(() => walkPose(phase.value, props.appearance, walkWeight.value))
const decor = computed(() => computeHeadDecor(props.appearance, props.view, geo.value.head))

// --- Базовые признаки внешности ---
const isChild = computed(() => props.appearance?.ageGroup === 'child')
const hasHat = computed(() => props.appearance?.headwear && props.appearance?.headwear !== 'none')
const clothingStyle = computed(() => props.appearance?.clothingStyle || 'standard')

// --- Общая группа: покачивание + подскок + дыхание; ребёнок масштабируется
// вокруг точки земли (25, 97) — раньше scale вокруг центра уводил ноги в воздух
const mainStyle = computed(() => ({
  transformOrigin: '25px 97px',
  transform:
    `translate(${pose.value.swayX.toFixed(3)}px, ${(pose.value.bounceY + breath.value).toFixed(3)}px)` +
    (isChild.value ? ' scale(0.8)' : ''),
}))

// --- Стили конечностей: вращение вокруг плеча/бедра; у ног добавлен подъём
// стопы в фазе переноса (translateY вдоль повернутой ноги)
const backArmStyle = computed(() => ({
  transformOrigin: `${geo.value.armBack.shoulderX}px ${geo.value.armBack.shoulderY}px`,
  transform: `rotate(${pose.value.backArm.angle.toFixed(2)}deg)`,
}))
const frontArmStyle = computed(() => ({
  transformOrigin: `${geo.value.armFront.shoulderX}px ${geo.value.armFront.shoulderY}px`,
  transform: `rotate(${pose.value.frontArm.angle.toFixed(2)}deg)`,
}))
const backLegStyle = computed(() => ({
  transformOrigin: `${geo.value.legBack.hipX}px ${geo.value.legBack.hipY}px`,
  transform: `rotate(${pose.value.backLeg.angle.toFixed(2)}deg) translateY(${(-pose.value.backLeg.lift).toFixed(2)}px)`,
}))
const frontLegStyle = computed(() => ({
  transformOrigin: `${geo.value.legFront.hipX}px ${geo.value.legFront.hipY}px`,
  transform: `rotate(${pose.value.frontLeg.angle.toFixed(2)}deg) translateY(${(-pose.value.frontLeg.lift).toFixed(2)}px)`,
}))
</script>

<style scoped>
line { shape-rendering: geometricPrecision; }
</style>
