<!-- app/components/editor/TrafficRoad.vue -->
<template lang="pug">
.traffic-road.relative.overflow-hidden.w-full.h-full(style="background-color: #4b5563;")
  .absolute.inset-0.pointer-events-none(aria-hidden="true")
    .absolute.top-0.left-0.right-0.h-1.bg-white.opacity-10
    .absolute.bottom-0.left-0.right-0.h-1.bg-white.opacity-10
    .absolute.left-0.right-0(style="top: 50%; transform: translateY(-50%);")
      svg.w-full.h-4(xmlns="http://www.w3.org/2000/svg")
        line(x1="0" y1="50%" x2="100%" y2="50%" stroke="oklch(80% 0.1 90)" stroke-width="2" stroke-dasharray="40, 30")

  template(v-for="car in cars" :key="car.id")
    .absolute.pointer-events-none(
      :ref="el => setCarRef(car.id, el)"
      :style="carStyle(car)"
    )
      .w-full.h-full(v-html="car.svg")
</template>

<script setup lang="ts">
import { shallowRef, onUnmounted, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useAudioEngine } from '~/composables/useAudioEngine'
// [№44-ФОНОВЫЙ-ТРАФИК] машины фоновой дороги = ТЕ ЖЕ спрайты, что у машин
// основного симулятора (simulatorSvg): легковой профиль и грузовик с будкой,
// те же пропорции и палитра. Локальный упрощённый генератор удалён.
import { getCarSvg, getTruckSvg } from '~/utils/simulatorSvg'
import { CAR_COLORS, TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE } from '~/utils/simulatorConstants'

const audio = useAudioEngine()

const props = withDefaults(defineProps<{
  width: number
  height: number
  isRunning: boolean
  spawnRate?: number
  minSpeed?: number
  maxSpeed?: number
}>(), {
  spawnRate: 3,
  minSpeed: 50,
  maxSpeed: 500,
})

const emit = defineEmits<{
  (e: 'traffic-update', data: { count: number; avgSpeed: number }): void
}>()

interface Car {
  id: number
  x: number
  y: number
  w: number
  h: number
  speed: number
  maxSpeed: number
  targetSpeed: number
  lane: Lane
  color: string
  isTruck: boolean
  svg: string
  el: HTMLElement | null
}

type Lane = 'top' | 'bottom'

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

const CAR_W = 80
const CAR_H = 40

// [№44-ФОНОВЫЙ-ТРАФИК] грузовик крупнее легковой ровно как в основном
// симуляторе: TRUCK_WIDTH_SCALE/TRUCK_HEIGHT_SCALE от 80x40 -> 96x52
// (viewBox 120x65 спрайта совпадает по пропорции с 96x52).
const TRUCK_W = Math.round(CAR_W * TRUCK_WIDTH_SCALE)
const TRUCK_H = Math.round(CAR_H * TRUCK_HEIGHT_SCALE)
// доля грузовиков в потоке — как у машин в БД (TRUCK_TYPE_SHARE = 0.1)
const TRUCK_SHARE = 0.1
// край экрана с запасом под самый крупный транспорт (спавн/деспавн за кадром)
const SPAWN_MARGIN = TRUCK_W

const MIN_GAP = 50
const DETECTION_RADIUS = 300
const REACTION_SPEED = 8

const SPAWN_BUFFER = CAR_W * 2.5

const AUDIO_POOL_ID = 'traffic-road-tyres'
const EMIT_INTERVAL = 0.25

// ---------------------------------------------------------------------------
// Стиль машины
// ---------------------------------------------------------------------------

// [№44-ФОНОВЫЙ-ТРАФИК] размер — по машине: у грузовика свой w/h (96x52)
const carStyle = (car: Car): Record<string, string> => ({
  width: car.w + 'px',
  height: car.h + 'px',
  top: car.y + 'px',
  left: '0px',
  willChange: 'transform',
  backfaceVisibility: 'hidden',
  transform: 'translateZ(0)',
})

// ---------------------------------------------------------------------------
// Состояние
// ---------------------------------------------------------------------------

const cars = shallowRef<Car[]>([])
let carIdCounter = 0
let spawnTimer = 0
let lastTime = 0
let lastEmitTime = 0
let audioInitialized = false

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ---------------------------------------------------------------------------
// Аудио
// ---------------------------------------------------------------------------

const initAudio = () => {
  if (audioInitialized) return
  audio.createPool(AUDIO_POOL_ID, 'tyre-noise', 1)
  audio.playFromPool(AUDIO_POOL_ID, 'tyre-noise', 0)
  audioInitialized = true
}

const disposeAudio = () => {
  if (!audioInitialized) return
  audio.disposePool(AUDIO_POOL_ID)
  audioInitialized = false
}

const spatialFactor = (carX: number): number => {
  const left = -CAR_W
  const right = props.width + CAR_W
  const center = carX + CAR_W / 2
  let t = (center - left) / (right - left)
  t = clamp(t, 0, 1)
  const v = 1 - Math.abs(t - 0.5) * 2
  return Math.pow(v, 1.5)
}

const updateMasterVolume = () => {
  let peak = 0
  const list = cars.value
  for (let i = 0; i < list.length; i++) {
    const car = list[i]
    // [ИСПРАВЛЕНО] noUncheckedIndexedAccess: guard элемента массива
    if (!car) continue
    const speedRatio = car.speed / car.maxSpeed
    if (speedRatio < 0.05) continue
    const base = 0.35 * Math.min(1, speedRatio * 1.5)
    const v = base * spatialFactor(car.x)
    if (v > peak) peak = v
  }
  audio.updateVolume(AUDIO_POOL_ID, peak, 0.05)
}

// ---------------------------------------------------------------------------
// Создание машины
// ---------------------------------------------------------------------------

const createCar = (lane: Lane, onScreen: boolean): Car | undefined => {
  if (!props.width || !props.height) return undefined

  const minSpd = clamp(props.minSpeed, 1, props.maxSpeed - 1)
  const maxSpd = clamp(props.maxSpeed, minSpd + 1, 2000)
  const speed = lerp(minSpd, maxSpd, Math.random())
  // [ИСПРАВЛЕНО] индекс массива даёт string | undefined — fallback
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] ?? '#808080'

  // [№44-ФОНОВЫЙ-ТРАФИК] тип транспорта случайно: ~10% грузовиков, как в
  // основном симуляторе. Спрайт и размер берутся от типа.
  const isTruck = Math.random() < TRUCK_SHARE
  const w = isTruck ? TRUCK_W : CAR_W
  const h = isTruck ? TRUCK_H : CAR_H

  const laneH = props.height / 2
  const y = lane === 'top' ? laneH / 2 - h / 2 : laneH + laneH / 2 - h / 2

  let x: number
  if (lane === 'top') {
    x = onScreen ? props.width * (0.3 + Math.random() * 0.5) : props.width + SPAWN_MARGIN
  } else {
    x = onScreen ? props.width * (0.1 + Math.random() * 0.4) : -SPAWN_MARGIN
  }

  return {
    id: ++carIdCounter,
    x, y, w, h,
    speed, maxSpeed: maxSpd, targetSpeed: speed,
    lane, color, isTruck,
    svg: isTruck ? getTruckSvg(color) : getCarSvg(color),
    el: null,
  }
}

// ---------------------------------------------------------------------------
// Спавн
// ---------------------------------------------------------------------------

const canSpawnInLane = (lane: Lane): boolean => {
  const spawnX = lane === 'top' ? props.width + SPAWN_MARGIN : -SPAWN_MARGIN
  const list = cars.value
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    // [ИСПРАВЛЕНО] guard элемента массива
    if (!c) continue
    if (c.lane !== lane) continue
    if (Math.abs(c.x - spawnX) < SPAWN_BUFFER) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Ссылка на DOM-элемент
// ---------------------------------------------------------------------------

// [ИСПРАВЛЕНО] el: any — Vue передаёт Element | ComponentPublicInstance | null,
// аннотация HTMLElement | null не проходит проверку вызова из :ref
const setCarRef = (id: number, el: any) => {
  if (!el) return
  const list = cars.value
  for (let i = 0; i < list.length; i++) {
    const car = list[i]
    if (car && car.id === id) {
      car.el = el
      const sx = car.lane === 'top' ? -1 : 1
      el.style.transform = `translate3d(${car.x}px, 0px, 0px) scaleX(${sx})`
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Главный цикл
// ---------------------------------------------------------------------------

const updateLoop = (time: number) => {
  if (!props.isRunning) return

  if (lastTime === 0) { lastTime = time; return }
  const dt = Math.min(time - lastTime, 0.1)
  lastTime = time

  const list = cars.value

  // ── 1. Сортировка рядов ──────────────────────────────────────────────
  const topLane: Car[] = []
  const bottomLane: Car[] = []

  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (!c) continue
    if (c.lane === 'top') topLane.push(c)
    else bottomLane.push(c)
  }

  topLane.sort((a, b) => b.x - a.x)
  bottomLane.sort((a, b) => a.x - b.x)

  // ── 2. Физика рядов ─────────────────────────────────────────────────
  const processLane = (sorted: Car[]) => {
    for (let i = 0; i < sorted.length; i++) {
      const car = sorted[i]
      // [ИСПРАВЛЕНО] guard элемента массива
      if (!car || !car.el) continue

      const leader = i > 0 ? sorted[i - 1] : null
      const distToLeader = leader ? Math.abs(leader.x - car.x) : Infinity

      if (leader && distToLeader < DETECTION_RADIUS) {
        const t = clamp((distToLeader - MIN_GAP) / (DETECTION_RADIUS - MIN_GAP), 0, 1)
        const ease = t * t * (3 - 2 * t)
        car.targetSpeed = lerp(leader.speed, car.maxSpeed, ease)
      } else {
        car.targetSpeed = car.maxSpeed
      }

      car.speed = lerp(car.speed, car.targetSpeed, 1 - Math.exp(-REACTION_SPEED * dt))

      const dir = car.lane === 'top' ? -1 : 1
      car.x += car.speed * dir * dt

      const roundedX = Math.round(car.x * 100) / 100
      const sx = car.lane === 'top' ? -1 : 1
      car.el.style.transform = `translate3d(${roundedX}px, 0px, 0px) scaleX(${sx})`
    }
  }

  processLane(topLane)
  processLane(bottomLane)

  // ── 3. Аудио ────────────────────────────────────────────────────────
  updateMasterVolume()

  // ── 4. Спавн ────────────────────────────────────────────────────────
  spawnTimer += dt
  if (spawnTimer >= props.spawnRate) {
    const topOk = canSpawnInLane('top')
    const botOk = canSpawnInLane('bottom')

    if (topOk || botOk) {
      let lane: Lane
      if (topOk && botOk) lane = Math.random() > 0.5 ? 'top' : 'bottom'
      else lane = topOk ? 'top' : 'bottom'

      const newCar = createCar(lane, false)
      if (newCar) cars.value = [...cars.value, newCar]
      spawnTimer = 0
    }
  }

  // ── 5. Удаление ─────────────────────────────────────────────────────
  let needsFilter = false
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    // [ИСПРАВЛЕНО] guard элемента массива
    if (!c) continue
    const off = c.lane === 'bottom' ? c.x > props.width + c.w * 2 : c.x < -c.w * 2
    if (off) { needsFilter = true; break }
  }

  if (needsFilter) {
    cars.value = list.filter(c => {
      if (c.lane === 'bottom') return c.x <= props.width + c.w * 2
      return c.x >= -c.w * 2
    })
  }

  // ── 6. Статистика ──────────────────────────────────────────────────
  if (time - lastEmitTime > EMIT_INTERVAL) {
    lastEmitTime = time
    const count = list.length
    let avgSpeed = 0
    if (count > 0) {
      let sum = 0
      // [ИСПРАВЛЕНО] optional chaining + fallback
      for (let i = 0; i < count; i++) sum += list[i]?.speed ?? 0
      avgSpeed = sum / count
    }
    emit('traffic-update', { count, avgSpeed })
  }
}

// ---------------------------------------------------------------------------
// Жизненный цикл
// ---------------------------------------------------------------------------

watch(() => props.isRunning, (running) => {
  if (import.meta.server) return

  if (running) {
    lastTime = 0
    spawnTimer = 0
    lastEmitTime = 0
    cars.value = []

    initAudio()

    const t = createCar('top', true)
    const b = createCar('bottom', true)
    const initial: Car[] = []
    if (t) initial.push(t)
    if (b) initial.push(b)
    cars.value = initial

    nextTick(() => {
      gsap.ticker.add(updateLoop)
    })
  } else {
    gsap.ticker.remove(updateLoop)
    cars.value = []
    disposeAudio()
  }
}, { immediate: true })

onUnmounted(() => {
  if (import.meta.server) return
  gsap.ticker.remove(updateLoop)
  disposeAudio()
})
</script>