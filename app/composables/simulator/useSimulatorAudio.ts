// composables/simulator/useSimulatorAudio.ts
import { ref, type Ref } from 'vue'
import { useAudioEngine } from '~/composables/useAudioEngine'
import type { AiAgent, SceneElement, TrafficConfig } from '~/types/simulator'
import type { ActiveIntercom } from './useSimulatorUI'

export function useSimulatorAudio(
  simElements: Ref<SceneElement[]>,
  aiAgents: Ref<AiAgent[]>,
  sceneSize: Ref<{ width: number; height: number }>,
  getTrafficConfig: () => TrafficConfig,
  activeIntercoms: Ref<Set<ActiveIntercom>>
) {
  // Инициализация аудио движка внутри функции (безопасно для SSR)
  const audio = useAudioEngine()

  // --- Локальное состояние звуков (Кэши для избежания утечек памяти) ---
  const stepTimers = new Map<string, number>()      // Таймеры шагов для каждого агента
  const carPrevSpeeds = new Map<string, number>()   // Предыдущая скорость машины (для определения торможения)
  const lastBrakeTime = new Map<string, number>()   // Время последнего скрипа тормозов
  const carHornPlayed = new Set<string>()           // Флаг: уже сигналил ли автомобиль
  const carPendingDispose = new Map<string, ReturnType<typeof setTimeout>>() // Таймеры отложенной очистки пулов
  
  // Реактивная переменная для хранения ID агентов, у которых нужно показать метку
  const visibleAgentLabels = ref(new Set<string>())

  /**
   * Проверка попадания точки в полигон (Ray Casting Algorithm)
   * Используется для проверки нахождения агента в зоне переговорника сложной формы.
   */
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
    if (!polygon || polygon.length < 3) return false
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y
      const xj = polygon[j].x, yj = polygon[j].y
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  /**
   * Обновление видимости меток на основе активных переговорников.
   */
  const updateIntercomAndLabels = () => {
    const newVisibleIds = new Set<string>()
    
    if (!activeIntercoms.value.size) {
      visibleAgentLabels.value = newVisibleIds
      return
    }

    activeIntercoms.value.forEach(intercom => {
      for (const agent of aiAgents.value) {
        // 1. Фильтр по направлению (вход/выход)
        if (agent.direction !== intercom.direction) continue
        // 2. Фильтр по типу (пеший/авто)
        if (intercom.travelMode && agent.travelMode !== intercom.travelMode) continue

        const el = agent.element
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        let inZone = false

        // 3. Проверка по полигону (приоритет)
        if (intercom.territoryPolygon && intercom.territoryPolygon.length > 0) {
          inZone = isPointInPolygon({ x: cx, y: cy }, intercom.territoryPolygon)
        } else {
          // 4. Проверка по радиусу (fallback)
          const dist = Math.hypot(cx - intercom.x, cy - intercom.y)
          inZone = dist <= intercom.range
        }

        if (inZone) {
          // Логика групп: метка показывается только у лидера.
          // Если агент в группе, но он НЕ лидер -> пропускаем.
          if (agent.groupId && !agent.isLeader) {
            continue
          }
          newVisibleIds.add(el.id)
        }
      }
    })
    
    // Триггерим реактивность Vue заменой объекта
    visibleAgentLabels.value = newVisibleIds
  }

  /**
   * Инициализация пулов звуков.
   * Пулы позволяют проигрывать один и тот же тип звука параллельно без "перебивания".
   */
  const initAudioPools = () => {
    // Параметры: (ID пула, Тип звука, Макс. количество одновременных звуков)
    audio.createPool('ui-global', 'ui', 2)
    
    // [НАСТРОЙКА] Шаги людей. 3 пула по 3 экземпляра позволяют создавать "толпу" шагов.
    audio.createPool('steps-1', 'step', 3)
    audio.createPool('steps-2', 'step', 3)
    audio.createPool('steps-3', 'step', 3)
    
    audio.createPool('wicket-sound', 'wicket-creak', 2)
    audio.createPool('gate-active', 'gate-motor', 1)
    
    // [НАСТРОЙКА] Гудки авто. 3 пула для редких случаев одновременного сигнала.
    audio.createPool('horn-pool', 'horn', 3)
  }

  /**
   * Обновление аудио для конкретного агента.
   */
  const updateAgentAudio = (dt: number, agent: AiAgent) => {
    const cfg = getTrafficConfig()
    // "Слушатель" находится в центре сцены (для расчета стерео-панорамы в будущем)
    const listenerX = sceneSize.value.width / 2
    const listenerY = sceneSize.value.height / 2
    const agentX = agent.element.x + agent.element.width / 2
    const agentY = agent.element.y + agent.element.height / 2
    const distance = Math.hypot(agentX - listenerX, agentY - listenerY)
    
    // [НАСТРОЙКА] Дистанция слышимости берется из конфига трафика
    // cfg.stepAudibleDistance (по умолчанию 400px)
    // cfg.engineAudibleDistance (по умолчанию 800px)
    const maxDist = agent.type === 'person' ? cfg.stepAudibleDistance : cfg.engineAudibleDistance
    
    // Множитель затухания (0 - далеко, 1 - рядом)
    const fadeMultiplier = Math.max(0, 1 - distance / maxDist)

    // --- ПЕШЕХОДЫ ---
    if (agent.type === 'person') {
      const speed = Math.abs(agent.element.velocity || 0)
      
      // [НАСТРОЙКА] Порог скорости для начала проигрывания шагов (2)
      // [НАСТРОЙКА] Порог слышимости fadeMultiplier > 0.05
      if (speed > 2 && fadeMultiplier > 0.05) {
        let timer = stepTimers.get(agent.id) || 0
        timer += dt
        
        // [НАСТРОЙКА] Интервал между шагами:
        // Минимум: 0.3 сек (при беге)
        // Максимум: 1.2 сек (при медленной ходьбе)
        // Делитель скорости: 80 (чем больше число, тем чаще шаги при той же скорости)
        const interval = Math.max(0.3, 1.2 - speed / 80)
        
        if (timer >= interval) {
          const stepPool = `steps-${Math.floor(Math.random() * 3) + 1}`
          // [НАСТРОЙКА] Базовая громкость шагов: 0.6
          audio.playFromPool(stepPool, 'step', 0.6 * fadeMultiplier, Math.random())
          timer = 0
        }
        stepTimers.set(agent.id, timer)
      } else {
        stepTimers.delete(agent.id)
      }
    } 
    
    // --- АВТОМОБИЛИ ---
    else if (agent.type === 'car') {
      const poolId = `car-${agent.id}`
      const speed = Math.abs(agent.element.velocity || 0)
      const maxSpeed = agent.element.settings?.maxSpeed || 100
      const speedRatio = maxSpeed > 0 ? Math.min(1, speed / maxSpeed) : 0

      // Логика затухания при подъезде к точке (чтобы звук не "выстреливал" у цели)
      const targetX = agent.target.x + agent.target.width / 2
      const targetY = agent.target.y + agent.target.height / 2
      const distToTarget = Math.hypot(agentX - targetX, agentY - targetY)

      let approachFade = 1.0
      if (agent.direction === 'enter') {
        // [НАСТРОЙКА] Дистанция (200px), с которой начинается затухание при въезде
        const fadeStartDist = 200
        if (distToTarget < fadeStartDist) {
          approachFade = Math.max(0.1, distToTarget / fadeStartDist)
        }
      }

      // Расчет итогового множителя дистанции
      let fadeMultiplier = 1 - distance / maxDist
      fadeMultiplier = Math.max(0, Math.min(1, fadeMultiplier))
      fadeMultiplier = Math.pow(fadeMultiplier, 2) // Квадратичное затухание

      // [НАСТРОЙКА] Громкость мотора:
      // База (холостой ход): 0.2
      // Прирост от скорости: +0.7 (макс добавка)
      // Максимум: 0.9
      let targetVol = 0.2
      if (speedRatio > 0.05) {
        targetVol = 0.2 + speedRatio * 0.7
      }
      targetVol = Math.min(0.9, targetVol * fadeMultiplier * approachFade)

      // Логика остановки звука (очистка ресурсов)
      if (targetVol < 0.01 && !carPendingDispose.has(agent.id)) {
        // [НАСТРОЙКА] Задержка перед удалением пула (500мс), чтобы звук плавно ушел
        const timer = setTimeout(() => {
          audio.disposePool(poolId)
          carPendingDispose.delete(agent.id)
        }, 500)
        carPendingDispose.set(agent.id, timer)
      }
      if (targetVol > 0.01 && carPendingDispose.has(agent.id)) {
        clearTimeout(carPendingDispose.get(agent.id)!)
        carPendingDispose.delete(agent.id)
      }

      // Запуск и обновление звука
      audio.createPool(poolId, 'engine', 1)
      audio.playFromPool(poolId, 'engine', 0)
      audio.updateEngineVolume(poolId, targetVol, dt)

      // [НАСТРОЙКА] Тон двигателя (Pitch):
      // Минимальная частота (старт): 20 Гц
      // Максимальная частота (разгон): 60 Гц
      const minFreq = 20
      const maxFreq = 60
      const targetFreq = minFreq + speedRatio * (maxFreq - minFreq)
      audio.setEnginePitch(poolId, targetFreq, dt)

      // --- Скрип тормозов ---
      const prevSpeed = carPrevSpeeds.get(agent.id) || 0
      const deceleration = prevSpeed - speed
      
      // [НАСТРОЙКА] Порог замедления (20) для включения скрипа
      const isBraking = deceleration > 20 && speed < prevSpeed
      if (isBraking && !lastBrakeTime.has(agent.id)) {
        // [НАСТРОЙКА] Громкость скрипа тормозов: 0.5
        audio.playFromPool(poolId, 'brake', 0.5)
        lastBrakeTime.set(agent.id, Date.now())
        // [НАСТРОЙКА] Кулдаун скрипа (1000мс), чтобы не пищал часто в пробке
        setTimeout(() => lastBrakeTime.delete(agent.id), 1000)
      }

      // --- Гудок (Клаксон) ---
      // [НАСТРОЙКА] Минимальная скорость (10) для гудка
      // [НАСТРОЙКА] Минимальная громкость мотора (0.1), чтобы сигналить только близким машинам
      if (speed > 10 && !carHornPlayed.has(agent.id) && targetVol > 0.1) {
        // [НАСТРОЙКА] Вероятность гудка в секунду: 0.01 (1% шанс каждую секунду)
        const hornProb = 0.01 * dt
        if (Math.random() < hornProb) {
          // [НАСТРОЙКА] Громкость гудка: 0.6
          audio.playFromPool('horn-pool', 'horn', 0.6)
          carHornPlayed.add(agent.id)
          // [НАСТРОЙКА] Пауза между гудками одной машины (3000мс)
          setTimeout(() => carHornPlayed.delete(agent.id), 3000)
        }
      }

      carPrevSpeeds.set(agent.id, speed)
    }
  }

  /**
   * Главный цикл обновления аудио.
   */
  const updateAllAudio = (dt: number) => {
    // 1. Очистка памяти от удаленных агентов (Anti-Memory Leak)
    const currentAgentIds = new Set(aiAgents.value.map(a => a.id))
    for (const [id] of stepTimers) { if (!currentAgentIds.has(id)) stepTimers.delete(id) }
    for (const [id] of carPrevSpeeds) { if (!currentAgentIds.has(id)) carPrevSpeeds.delete(id) }

    // 2. Обновление всех активных агентов
    for (const agent of aiAgents.value) {
      updateAgentAudio(dt, agent)
    }
    
    // 3. Обновление меток (интерфейс)
    updateIntercomAndLabels()
  }

  /**
   * Принудительная очистка звуков при удалении агента.
   */
  const cleanupAgentSounds = (agentId: string) => {
    const timer = carPendingDispose.get(agentId)
    if (timer) clearTimeout(timer)
    carPendingDispose.delete(agentId)
    audio.disposePool(`car-${agentId}`)
    
    // Очищаем все локальные карты
    stepTimers.delete(agentId)
    carPrevSpeeds.delete(agentId)
    lastBrakeTime.delete(agentId)
    carHornPlayed.delete(agentId)
  }

  const resetAllAudioTimers = () => {
    stepTimers.clear()
    carPrevSpeeds.clear()
    lastBrakeTime.clear()
    carHornPlayed.clear()
    for (const timer of carPendingDispose.values()) clearTimeout(timer)
    carPendingDispose.clear()
    audio.resetPool('gate-active')
  }

  return {
    initAudioPools,
    updateAllAudio,
    cleanupAgentSounds,
    resetAllAudioTimers,
    visibleAgentLabels,
    updateIntercomAndLabels
  }
}