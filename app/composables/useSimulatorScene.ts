// composables/useSimulatorScene.ts
// Назначение: Подготовка данных для рендеринга сцены. Рассчитывает координаты,
// стили позиционирования и пробрасывает данные внешности для SVG-компонентов.

import { computed } from 'vue'

// Определяем типы для пропсов для лучшей типизации
interface SimulatorProps {
  gatePosition: number
  wicketState: 'locked' | 'unlocked'
  wicketIsClear: boolean
  config: any
  event: any
}

export const useSimulatorScene = (props: SimulatorProps) => {
  
  // ---------------------------------------------------------------------------
  // КОНФИГУРАЦИЯ СЦЕНЫ
  // ---------------------------------------------------------------------------
  const scene = computed(() => props.config?.scene || {})
  
  // Стили для машин (если используются)
  const vehicleStyle = computed(() => ({
    width: `${scene.value.vehicleWidth || 100}px`,
    height: `${scene.value.vehicleHeight || 160}px`
  }))

  // ---------------------------------------------------------------------------
  // КОНСТАНТЫ КООРДИНАТ (В процентах от экрана)
  // ---------------------------------------------------------------------------
  const PERSON_POINTS = computed(() => {
    const baseY = scene.value.personStopY || 58
    return {
      X_RIGHT_HIDDEN: 130, // Точка появления (справа за кадром)
      X_CENTER: 52,        // Центр калитки
      Y_WAITING: baseY,    // Y перед калиткой
      Y_MID: 85,           // Y внутри (прошел калитку) - немного ниже
      Y_DOWN_HIDDEN: 140   // Y точка выхода (внизу) - УВЕЛИЧЕНО для видимости ухода
    }
  })

  // ---------------------------------------------------------------------------
  // ЛОГИКА: Расчет координат персонажа
  // ---------------------------------------------------------------------------
  const calcPersonCoords = (event: any) => {
    const stage = event.stage
    const points = PERSON_POINTS.value
    
    switch (stage) {
      case 'approaching':
        // Появляется справа на уровне калитки
        return { x: points.X_RIGHT_HIDDEN, y: points.Y_WAITING }
      case 'waiting':
        // Подходит к центру калитки
        return { x: points.X_CENTER, y: points.Y_WAITING }
      case 'processing':
        // Проходит внутрь и останавливается
        return { x: points.X_CENTER, y: points.Y_MID }
      case 'leaving':
        // Уходит вниз за пределы экрана
        return { x: points.X_CENTER, y: points.Y_DOWN_HIDDEN }
      default:
        return { x: points.X_RIGHT_HIDDEN, y: points.Y_WAITING }
    }
  }

  // ---------------------------------------------------------------------------
  // ОБРАБОТКА СОБЫТИЯ (Processor)
  // ---------------------------------------------------------------------------
  const processEvent = (event: any) => {
    // Проверка валидности события
    if (!event || !event.stage) return null
    const validStages = ['approaching', 'waiting', 'processing', 'leaving']
    if (!validStages.includes(event.stage)) return null

    const type = event.type
    
    // 1. Расчет координат
    const coords = type === 'vehicle' 
      ? { x: 35, y: 20 } // Координаты для машины (статичные)
      : calcPersonCoords(event)
    
    // 2. Определение состояния движения (для анимации ходьбы)
    // Двигается, если подходит или уходит
    let isMoving = false
    if (type === 'person') {
      isMoving = event.stage === 'approaching' || event.stage === 'leaving'
    }

    // 3. Расчет времени перехода (GSAP или CSS transition)
    // Используем скорость из конфига
    const speed = scene.value.personSpeed || 0.02
    let duration = 0
    const points = PERSON_POINTS.value
    
    if (type === 'person') {
      // Длительность = Расстояние / Скорость
      if (event.stage === 'waiting') {
        // Движение по X: от X_RIGHT_HIDDEN до X_CENTER
        const dist = Math.abs(points.X_RIGHT_HIDDEN - points.X_CENTER)
        duration = dist / speed
      } else if (event.stage === 'processing') {
        // Движение по Y: от Y_WAITING до Y_MID
        const dist = Math.abs(points.Y_WAITING - points.Y_MID)
        duration = dist / speed
      } else if (event.stage === 'leaving') {
        // Движение по Y: от Y_MID до Y_DOWN_HIDDEN
        const dist = Math.abs(points.Y_MID - points.Y_DOWN_HIDDEN)
        duration = dist / speed
      }
      
      // Защита от нулевой скорости или слишком быстрой анимации
      if (duration < 50) duration = 2000
    }

    // 4. Формирование стилей
    // ВАЖНО: z-index выносим в стиль, чтобы персонаж был поверх калитки
    const posStyle = { 
      position: 'absolute',
      left: `${coords.x}%`,
      top: `${coords.y}%`,
      opacity: 1,
      transition: 'none',
      zIndex: 100
    }

    // 5. Возврат объекта для рендера
    return {
      id: event.id,
      type,
      direction: event.direction,
      isMoving,
      stage: event.stage,
      yVal: coords.y,
      posStyle,
      transitionMs: duration,
      // ВАЖНО: Пробрасываем объект внешности из события в компонент
      appearance: event.appearance 
    }
  }

  // ---------------------------------------------------------------------------
  // СПИСКИ ДЛЯ РЕНДЕРА (Computed Lists)
  // ---------------------------------------------------------------------------

  // Персонажи на переднем плане (если нужно, пока null)
  const personFront = computed(() => null)

  // Персонажи на заднем плане (основной слой)
  const personBack = computed(() => {
    if (!props.event) return null
    const obj = processEvent(props.event)
    if (!obj || obj.type !== 'person') return null
    
    // Объединяем стили позиции с остальными данными
    return { 
      ...obj, 
      style: obj.posStyle 
    }
  })
  
  // Списки машин (пустые, если не используются)
  const outsideVehicles = computed(() => [])
  const insideVehicles = computed(() => [])

  // ---------------------------------------------------------------------------
  // СТИЛИ ШЛАГБАУМА
  // ---------------------------------------------------------------------------
  const barsStyle = computed(() => {
    const w = scene.value.barWidth || 8
    const gap = scene.value.barGap || 10
    const color = scene.value.barColor || '#6b7280'
    return { 
      backgroundImage: `linear-gradient(to right, ${color} 0, ${color} ${w}px, transparent ${w}px, transparent ${w + gap}px)`, 
      backgroundSize: `${w + gap}px 100%`, 
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)' 
    }
  })

  // Вспомогательные стили
  const personStyle = computed(() => ({
    width: `${scene.value.personWidth || 40}px`,
    height: `${scene.value.personHeight || 80}px`
  }))

  const personWalkDuration = computed(() => scene.value.personWalkDuration || 4000)

  // ---------------------------------------------------------------------------
  // ВОЗВРАТ ДАННЫХ
  // ---------------------------------------------------------------------------
  return { 
    scene, 
    vehicleStyle, 
    personStyle, 
    barsStyle, 
    outsideVehicles, 
    insideVehicles, 
    personFront, 
    personBack, 
    personWalkDuration 
  }
}