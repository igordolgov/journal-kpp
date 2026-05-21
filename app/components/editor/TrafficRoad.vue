<!-- app/components/editor/TrafficRoad.vue -->
<template lang="pug">
.traffic-road.relative.overflow-hidden.w-full.h-full(style="background-color: #4b5563;")
  // Декор дороги: разделительная линия и бордюры
  .absolute.inset-0.pointer-events-none
    .absolute.top-0.left-0.right-0.h-1.bg-white.opacity-10
    .absolute.bottom-0.left-0.right-0.h-1.bg-white.opacity-10
    .absolute.left-0.right-0(style="top: 50%; transform: translateY(-50%);")
      svg.w-full.h-4(xmlns="http://www.w3.org/2000/svg")
        line(x1="0" y1="50%" x2="100%" y2="50%" stroke="oklch(80% 0.1 90)" stroke-width="2" stroke-dasharray="40, 30")

  // Рендер машин
  template(v-for="car in cars" :key="car.id")
    .absolute.pointer-events-none.will-change-transform(
      :ref="el => setCarRef(car.id, el)"
      :style="{ width: car.w + 'px', height: car.h + 'px', top: car.y + 'px', left: '0px' }"
    )
      .w-full.h-full(v-html="car.svg")
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useAudioEngine } from '~/composables/useAudioEngine'

const audio = useAudioEngine()

const props = defineProps<{
  width: number
  height: number
  isRunning: boolean
  // [НАСТРОЙКА] Интервал спавна машин (в секундах). Чем меньше, тем плотнее поток.
  spawnRate?: number
  // [НАСТРОЙКА] Минимальная скорость машин (px/сек)
  minSpeed?: number
  // [НАСТРОЙКА] Максимальная скорость машин (px/сек)
  maxSpeed?: number
}>()

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
  lane: 'top' | 'bottom'
  color: string
  svg: string
  transformSetter?: (val: string) => void
  audioPoolId?: string
}

const cars = ref<Car[]>([])
let carIdCounter = 0
let spawnTimer = 0
let lastTime = 0

// --- КОНСТАНТЫ НАСТРОЕК ---
const CAR_WIDTH = 80          // [НАСТРОЙКА] Ширина машины (px)
const CAR_HEIGHT = 40         // [НАСТРОЙКА] Высота машины (px)

// [НАСТРОЙКА] Палитра цветов машин. Можно расширить или изменить.
const CAR_COLORS = ['forestgreen', 'brown', 'blueviolet', 'darkkhaki', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f8fafc', '#1e293b']

// [НАСТРОЙКА] Дефолтные значения скорости, если не переданы через props
const MIN_LIMIT = 50          // Мин. скорость по умолчанию
const MAX_LIMIT = 500         // Макс. скорость по умолчанию

// [НАСТРОЙКА] Физика движения
const STOP_DISTANCE = 40      // Дистанция, на которой машина начинает тормозить (px)
const DETECTION_RADIUS = 200  // Радиус "зрения" машины для обнаружения впереди идущей (px)
const REACTION_SPEED = 0.5    // Скорость реакции (как быстро меняется speed к targetSpeed)

const DEFAULT_SPAWN_RATE = 3  // Интервал спавна по умолчанию (сек)

/**
 * Генератор SVG машины.
 * @param color - цвет кузова.
 */
const getCarSvg = (color: string) => `
  <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
    <path d="M10,40 Q5,40 5,35 L5,50 Q5,55 10,55 L110,55 Q115,55 115,50 L115,35 Q115,40 110,40 Z" fill="#374151"/>
    <rect x="10" y="20" width="100" height="30" rx="5" fill="${color}"/>
    <path d="M25,20 Q30,5 50,5 L70,5 Q90,5 95,20 Z" fill="#87CEEB" stroke="${color}" stroke-width="2"/>
    <circle cx="30" cy="50" r="8" fill="#1f2937"/><circle cx="30" cy="50" r="4" fill="#9ca3af"/>
    <circle cx="90" cy="50" r="8" fill="#1f2937"/><circle cx="90" cy="50" r="4" fill="#9ca3af"/>
    <rect x="70" y="12" width="6" height="4" rx="1" fill="#fbbf24"/>
  </svg>
`

/**
 * Регистрация рефки элемента для GSAP quickSetter.
 * Позволяет обновлять transform напрямую, минуя Vue reactivity, для высокой производительности.
 */
const setCarRef = (id: number, el: any) => {
  if (el) {
    const car = cars.value.find(c => c.id === id)
    if (car) {
      car.transformSetter = gsap.quickSetter(el, "transform")
      const sx = car.lane === 'top' ? -1 : 1
      el.style.transform = `translate(${car.x}px, 0px) scaleX(${sx})`
    }
  }
}

const getSafeSpeed = (s: number | undefined, def: number) => (s !== undefined && s > 0) ? s : def

/**
 * Создание объекта машины.
 */
const createCar = (lane: 'top' | 'bottom', onScreen: boolean): Car | undefined => {
  if (!props.width || !props.height) return

  // Расчет скорости
  const minSpd = getSafeSpeed(props.minSpeed, MIN_LIMIT)
  const maxSpd = getSafeSpeed(props.maxSpeed, MAX_LIMIT)
  const speed = Math.random() * (maxSpd - minSpd) + minSpd
  const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]
  
  // Расчет позиции Y (центр полосы)
  const laneHeight = props.height / 2
  const yOffset = lane === 'top' 
    ? (laneHeight / 2) - (CAR_HEIGHT / 2) 
    : laneHeight + (laneHeight / 2) - (CAR_HEIGHT / 2)

  // Расчет начальной позиции X
  let x = 0
  if (lane === 'top') x = onScreen ? props.width * 0.5 : props.width + CAR_WIDTH // Верхняя едет справа налево (x уменьшается)
  else x = onScreen ? props.width * 0.2 : -CAR_WIDTH // Нижняя едет слева направо (x увеличивается)

  const newCar: Car = {
    id: ++carIdCounter,
    x, y: yOffset, w: CAR_WIDTH, h: CAR_HEIGHT,
    speed, maxSpeed: maxSpd, targetSpeed: speed,
    lane, color, svg: getCarSvg(color)
  }
  return newCar
}

/**
 * Расчет громкости звука на основе позиции.
 * Машины громче в центре экрана и тише у краев.
 */
const getSpatialVolumeFactor = (car: Car): number => {
  const leftBound = -CAR_WIDTH
  const rightBound = props.width + CAR_WIDTH
  const carCenter = car.x + CAR_WIDTH / 2
  
  // Нормализуем позицию от 0 до 1
  let t = (carCenter - leftBound) / (rightBound - leftBound)
  t = Math.min(1, Math.max(0, t))
  
  // Пик громкости в центре (t=0.5)
  let factor = 1 - Math.abs(t - 0.5) * 2
  factor = Math.pow(factor, 1.5) // Экспоненциальное затухание
  return factor
}

const initCarAudio = (car: Car) => {
  if (!props.isRunning) return
  const poolId = `traffic-tyre-${car.id}`
  car.audioPoolId = poolId
  // Создаем пул для шума шин
  audio.createPool(poolId, 'tyre-noise', 1)
  audio.playFromPool(poolId, 'tyre-noise', 0) // Запускаем с 0 громкостью
}

const updateCarAudioVolume = (car: Car, speedRatio: number) => {
  if (!car.audioPoolId) return
  
  // [НАСТРОЙКА] Громкость шин: база 0.4, зависит от скорости
  let baseVolume = 0
  if (speedRatio > 0.05) {
    baseVolume = 0.4 * Math.min(1, speedRatio * 1.5)
  }
  
  const spatialFactor = getSpatialVolumeFactor(car)
  const finalVolume = baseVolume * spatialFactor
  audio.updateVolume(car.audioPoolId, finalVolume, 0.016)
}

const disposeCarAudio = (car: Car) => {
  if (car.audioPoolId) {
    audio.disposePool(car.audioPoolId)
  }
}

/**
 * Главный цикл обновления (GSAP Ticker).
 */
const updateLoop = (time: number) => {
  if (!props.isRunning) return

  if (lastTime === 0) {
    lastTime = time
    return
  }

  const dt = Math.min((time - lastTime), 0.1) // Delta time в секундах
  lastTime = time
  const currentCars = cars.value

  // 1. Обновление физики каждой машины
  currentCars.forEach(car => {
    if (!car.transformSetter) return

    // Поиск машины впереди (лидера) в том же ряду
    let leader: Car | null = null
    let minDist = Infinity
    
    currentCars.forEach(other => {
      if (other.id === car.id || other.lane !== car.lane) return
      const dist = Math.abs(other.x - car.x)
      // Определяем, кто впереди, в зависимости от направления движения ряда
      const isAhead = car.lane === 'top' ? other.x < car.x : other.x > car.x
      
      if (isAhead && dist < DETECTION_RADIUS && dist < minDist) {
        minDist = dist
        leader = other
      }
    })

    // Логика торможения
    if (leader && minDist < STOP_DISTANCE) {
      const brakeFactor = Math.min(1, minDist / STOP_DISTANCE)
      car.targetSpeed = car.maxSpeed * brakeFactor // Тормозим пропорционально дистанции
    } else {
      car.targetSpeed = car.maxSpeed // Газуем
    }

    // Плавное изменение текущей скорости (симуляция инерции/реакции)
    car.speed += (car.targetSpeed - car.speed) * REACTION_SPEED * dt
    
    // Движение
    const direction = car.lane === 'top' ? -1 : 1
    car.x += car.speed * direction * dt

    // Применение трансформации (GSAP quickSetter)
    const sx = car.lane === 'top' ? -1 : 1
    car.transformSetter(`translate(${car.x}px, 0px) scaleX(${sx})`)

    // Обновление звука
    const speedRatio = car.speed / car.maxSpeed
    updateCarAudioVolume(car, speedRatio)
  })

  // 2. Спавн новых машин
  spawnTimer += dt
  const rate = props.spawnRate ?? DEFAULT_SPAWN_RATE
  
  if (spawnTimer >= rate) {
    // Выбор случайного ряда
    const lane = Math.random() > 0.5 ? 'top' : 'bottom'
    const newCar = createCar(lane, false) // false = спавн за пределами экрана
    if (newCar) {
      cars.value = [...cars.value, newCar]
      initCarAudio(newCar)
    }
    spawnTimer = 0
  }

  // 3. Удаление машин, ушедших за экран
  const idsToRemove: number[] = []
  currentCars.forEach(car => {
    const isOffscreen = car.lane === 'bottom' 
      ? car.x > props.width + CAR_WIDTH * 2 
      : car.x < -CAR_WIDTH * 2
    if (isOffscreen) {
      idsToRemove.push(car.id)
      disposeCarAudio(car)
    }
  })

  if (idsToRemove.length > 0) {
    cars.value = cars.value.filter(car => !idsToRemove.includes(car.id))
  }

  // 4. Отправка статистики наверх
  const carsCount = currentCars.length
  let avgSpeed = 0
  if (carsCount > 0) {
    avgSpeed = currentCars.reduce((sum, car) => sum + car.speed, 0) / carsCount
  }
  emit('traffic-update', { count: carsCount, avgSpeed })
}

// --- Жизненный цикл компонента ---

watch(() => props.isRunning, (val) => {
  if (import.meta.server) return

  if (val) {
    // Старт симуляции
    lastTime = 0
    spawnTimer = 0
    
    // Полная очистка перед стартом
    for (const car of cars.value) disposeCarAudio(car)
    cars.value = []
    
    // Создание начальных машин (уже на экране для красоты)
    const t = createCar('top', true)
    const b = createCar('bottom', true)
    if (t) { cars.value.push(t); initCarAudio(t) }
    if (b) { cars.value.push(b); initCarAudio(b) }

    nextTick(() => {
      gsap.ticker.add(updateLoop)
    })
  } else {
    // Пауза симуляции
    gsap.ticker.remove(updateLoop)
    for (const car of cars.value) disposeCarAudio(car)
    cars.value = []
  }
}, { immediate: true })

onUnmounted(() => {
  if (import.meta.server) return
  gsap.ticker.remove(updateLoop)
  // Очистка всех аудио пулов при уничтожении компонента
  for (const car of cars.value) {
    disposeCarAudio(car)
  }
})
</script>