// app/composables/simulator/useSimulatorAudio.ts
// Назначение: звуковой слой симулятора — шаги, двигатели, тормоза, гудки, зоны переговорников.
//
// РЕФАКТОРИНГ (анти-утечка памяти):
//  1. [ИСПРАВЛЕНО] Введён реестр созданных пулов (createdPools) и обёртки
//     ensurePool / releasePool. Раньше audio.createPool() вызывался для каждой
//     машины КАЖДЫЙ кадр — при неидемпотентном движке это порождало узлы
//     Web Audio со скоростью ~60/сек на машину.
//  2. [ИСПРАВЛЕНО] Свип удалённых агентов чистит ВСЕ карты:
//     carPendingDispose, lastBrakeTime, carHornPlayed (раньше оставался мусор).
//  3. [ИСПРАВЛЕНО] visibleAgentLabels присваивается только при изменении состава —
//     раньше замена Set каждый кадр триггерила перерисовку подписчиков 60 раз/сек.
//
// ИСПРАВЛЕНИЯ ТИПОВ (TS):
//  4. isPointInPolygon: защита индексов polygon[i]/polygon[j]
//     (noUncheckedIndexedAccess требует проверки).
//  5. Свип: итерация Map через .keys() — раньше итератор давал кортеж
//     [string, number], и .has(кортеж) был невалиден.
//  6. maxDist: fallback 400/800 — поля TrafficConfig опциональны.
//  7. visibleAgentLabels: Set<string | number>, т.к. SceneElement.id может быть числом.
//     Поля AiAgent.groupId/isLeader добавляются в app/types/simulator.ts (см. шаг 2).
//  8. [ФИКС-звук] Пулы машин освобождаются при ЛЮБОМ удалении агента
//     (свип по createdPools); добавлен stopAllCarEngines() — глушит двигатели
//     при паузе/выключении симулятора; убран таймер 500мс, пересоздавший
//     пул каждый кадр (гонки старт/стоп = «залипший» гул двигателя).

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
  // Аудио-движок инициализируется внутри функции (безопасно для SSR)
  const audio = useAudioEngine()

  // --- Реестр созданных пулов (анти-утечка) ---
  // createPool вызывается ровно один раз на пул; disposePool всегда
  // сопровождается удалением из реестра. Если createPool в движке уже
  // идемпотентен — обёртка безвредна (ремень + подтяжка).
  const createdPools = new Set<string>()

  // Создаёт пул, только если он ещё не создан
  const ensurePool = (poolId: string, soundType: string, size: number) => {
    if (createdPools.has(poolId)) return
    audio.createPool(poolId, soundType, size)
    createdPools.add(poolId)
  }

  // Освобождает пул: dispose в движке + удаление из реестра. Повторный вызов безопасен.
  const releasePool = (poolId: string) => {
    if (!createdPools.has(poolId)) return
    audio.disposePool(poolId)
    createdPools.delete(poolId)
  }

  // --- Локальное состояние звуков (кэши для избежания утечек) ---
  const stepTimers = new Map<string, number>()      // Таймеры шагов для каждого агента
  const carPrevSpeeds = new Map<string, number>()   // Предыдущая скорость машины (для торможения)
  const lastBrakeTime = new Map<string, number>()   // Время последнего скрипа тормозов
  const carHornPlayed = new Set<string>()           // Флаг: уже сигналил ли автомобиль
  // [БАГ-РЕПОРТ-8-ГУДОК] сколько секунд машина стоит у ЗАКРЫТЫХ ворот:
  // гудок только после долгого ожидания (см. updateAgentAudio)
  const carHornWait = new Map<string, number>()

  // Реактивный набор id агентов с меткой переговорника.
  // [ИСПРАВЛЕНО] string | number — id элемента сцены может быть числом (легаси-сцены)
  const visibleAgentLabels = ref(new Set<string | number>())

  /**
   * Проверка попадания точки в полигон (Ray Casting Algorithm).
   * Используется для проверки нахождения агента в зоне переговорника сложной формы.
   */
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
    if (!polygon || polygon.length < 3) return false
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      // [ИСПРАВЛЕНО] noUncheckedIndexedAccess: индексы валидны по условию цикла,
      // но TS требует явной проверки перед доступом к .x/.y
      const pi = polygon[i]
      const pj = polygon[j]
      if (!pi || !pj) continue
      const xi = pi.x, yi = pi.y
      const xj = pj.x, yj = pj.y
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  /**
   * Обновление видимости меток на основе активных переговорников.
   * Присвоение ref — только при реальном изменении состава (экономия перерисовок).
   */
  const updateIntercomAndLabels = () => {
    // Быстрый выход: нет переговорников и нет меток — 0 аллокаций, 0 триггеров
    if (!activeIntercoms.value.size && visibleAgentLabels.value.size === 0) return

    const nextIds = new Set<string | number>()

    if (activeIntercoms.value.size) {
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
            // [ИСПРАВЛЕНО] groupId/isLeader теперь объявлены в типе AiAgent
            if (agent.groupId && !agent.isLeader) continue
            nextIds.add(el.id)
          }
        }
      })
    }

    // Сравниваем с предыдущим составом; присваиваем только при изменении
    const prev = visibleAgentLabels.value
    let changed = prev.size !== nextIds.size
    if (!changed) {
      for (const id of nextIds) {
        if (!prev.has(id)) { changed = true; break }
      }
    }
    if (changed) visibleAgentLabels.value = nextIds
  }

  /**
   * Инициализация пулов звуков (идемпотентно — повторный вызов не создаёт дубликаты).
   * Пулы позволяют проигрывать один тип звука параллельно без "перебивания".
   */
  const initAudioPools = () => {
    // Параметры: (ID пула, тип звука, макс. одновременных звуков)
    ensurePool('ui-global', 'ui', 2)

    // [НАСТРОЙКА] Шаги людей: 3 пула по 3 экземпляра создают эффект "толпы"
    ensurePool('steps-1', 'step', 3)
    ensurePool('steps-2', 'step', 3)
    ensurePool('steps-3', 'step', 3)

    ensurePool('wicket-sound', 'wicket-creak', 2)
    ensurePool('gate-active', 'gate-motor', 1)

    // [НАСТРОЙКА] Гудки авто: 3 пула для редких одновременных сигналов
    ensurePool('horn-pool', 'horn', 3)
  }

  /**
   * Обновление аудио для конкретного агента.
   */
  const updateAgentAudio = (dt: number, agent: AiAgent) => {
    // [ФИКС-звук] завершённый агент уже не слышен: не обновляем и не
    // пересоздаём его пулы в кадре перед деспавном
    if (agent.state === 'done') return
    const cfg = getTrafficConfig()
    // "Слушатель" в центре сцены (для расчёта стерео-панорамы в будущем)
    const listenerX = sceneSize.value.width / 2
    const listenerY = sceneSize.value.height / 2
    const agentX = agent.element.x + agent.element.width / 2
    const agentY = agent.element.y + agent.element.height / 2
    const distance = Math.hypot(agentX - listenerX, agentY - listenerY)

    // [НАСТРОЙКА] Дистанция слышимости из конфига трафика.
    // [ИСПРАВЛЕНО] fallback 400/800 — поля TrafficConfig опциональны.
    const maxDist = agent.type === 'person'
      ? (cfg.stepAudibleDistance ?? 400)
      : (cfg.engineAudibleDistance ?? 800)

    // Множитель затухания (0 — далеко, 1 — рядом)
    const fadeMultiplier = Math.max(0, 1 - distance / maxDist)

    // --- ПЕШЕХОДЫ ---
    if (agent.type === 'person') {
      const speed = Math.abs(agent.element.velocity || 0)

      // [НАСТРОЙКА] Порог скорости для шагов (2), порог слышимости (0.05)
      if (speed > 2 && fadeMultiplier > 0.05) {
        let timer = stepTimers.get(agent.id) || 0
        timer += dt

        // [НАСТРОЙКА] Интервал между шагами:
        // минимум 0.3 сек (бег), максимум 1.2 сек (медленная ходьба),
        // делитель скорости 80 (больше — реже шаги)
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

      // Затухание при подъезде к точке (чтобы звук не "выстреливал" у цели)
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

      // Итоговый множитель дистанции (квадратичное затухание)
      let fadeMultiplier = 1 - distance / maxDist
      fadeMultiplier = Math.max(0, Math.min(1, fadeMultiplier))
      fadeMultiplier = Math.pow(fadeMultiplier, 2)

      // [НАСТРОЙКА] Громкость мотора:
      // база (холостой) 0.2, прирост от скорости 0.7, максимум 0.9
      let targetVol = 0.2
      if (speedRatio > 0.05) {
        targetVol = 0.2 + speedRatio * 0.7
      }
      targetVol = Math.min(0.9, targetVol * fadeMultiplier * approachFade)

      // [ФИКС-звук] Пул двигателя живёт, пока жив агент: громкость ведётся
      // через updateEngineVolume (плавное затухание), высвобождение — строго
      // при удалении агента (свип updateAllAudio / cleanupAgentSounds /
      // stopAllCarEngines). Раньше пул удалялся таймером 500мс при затухании
      // и пересоздавался в следующем кадре — гонки старт/стоп оставляли
      // «залипший» гул двигателя после убытия машины.

      // [ИСПРАВЛЕНО] Пул создаётся один раз на машину (ensurePool), а не каждый кадр.
      ensurePool(poolId, 'engine', 1)
      audio.playFromPool(poolId, 'engine', 0)
      audio.updateEngineVolume(poolId, targetVol, dt)

      // [НАСТРОЙКА] Тон двигателя (Pitch): 20 Гц (старт) → 60 Гц (разгон)
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
        // [НАСТРОЙКА] Громкость скрипа: 0.5
        audio.playFromPool(poolId, 'brake', 0.5)
        lastBrakeTime.set(agent.id, Date.now())
        // [НАСТРОЙКА] Кулдаун скрипа (1000мс)
        setTimeout(() => lastBrakeTime.delete(agent.id), 1000)
      }

      // --- Гудок (Клаксон) ---
      // [БАГ-РЕПОРТ-8-ГУДОК] сигнал ТОЛЬКО при долгом ожидании у ЗАКРЫТЫХ
      // ворот. Раньше гудок был случайным у ЛЮБОЙ движущейся машины
      // (speed > 10, вероятность 0.01/с) — сигнал без причины на ходу.
      // Теперь: машина стоит в waiting_before рядом с ближайшими
      // автомобильными воротами, ворота ЗАКРЫТЫ и не анимируются, ожидание
      // длится дольше HORN_MIN_WAIT (+ персональная фаза 0..3с, чтобы
      // колонна не гудела хором) — короткий гудок; повтор не чаще
      // HORN_REPEAT, пока прострой продолжается. Открылись/тронулись —
      // счётчик ожидания сбрасывается.
      const HORN_MIN_WAIT = 15   // сек ожидания до первого гудка ([№10] 12 -> 15, правка заказчика)
      const HORN_REPEAT = 15     // сек между повторами, пока всё ждёт ([№10] 12 -> 15)
      let hornGate: SceneElement | undefined
      let hornGateD = Infinity
      for (const g of simElements.value) {
        const gs = g.settings as Record<string, unknown> | undefined
        if (g.category !== 'gate' || gs?.gateType === 'wicket') continue
        const d = Math.hypot(g.x + g.width / 2 - agentX, g.y + g.height / 2 - agentY)
        if (d < hornGateD) { hornGateD = d; hornGate = g }
      }
      const hornGateShut = hornGate &&
        !hornGate.settings?.isOpen && !hornGate.settings?.isAnimating &&
        !hornGate.settings?.isStopping
      if (agent.state === 'waiting_before' && hornGate && hornGateShut && hornGateD < 260) {
        const waited = (carHornWait.get(agent.id) ?? 0) + dt
        carHornWait.set(agent.id, waited)
        const phase = (String(agent.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 30) / 10
        if (waited >= HORN_MIN_WAIT + phase && !carHornPlayed.has(agent.id)) {
          // [НАСТРОЙКА] Громкость гудка: 0.6 (с дистанционным затуханием, пол 0.3)
          audio.playFromPool('horn-pool', 'horn', 0.6 * Math.max(0.3, fadeMultiplier))
          carHornPlayed.add(agent.id)
          carHornWait.delete(agent.id)
          setTimeout(() => carHornPlayed.delete(agent.id), HORN_REPEAT * 1000)
        }
      } else {
        carHornWait.delete(agent.id)
      }

      carPrevSpeeds.set(agent.id, speed)
    }
  }

  /**
   * Главный цикл обновления аудио.
   */
  const updateAllAudio = (dt: number) => {
    // 1. Очистка памяти от удалённых агентов (Anti-Memory Leak)
    const currentAgentIds = new Set(aiAgents.value.map(a => a.id))

    // [ФИКС-звук] Машина покинула сцену — её пул двигателя освобождается
    // немедленно. Раньше здесь только отменялся отложенный таймер, а играющий
    // пул оставался звучать вечно при любом пути удаления агента в обход
    // cleanupAgentSounds (перезагрузка сцены, лимит агентов и т.п.).
    for (const poolId of [...createdPools]) {
      if (poolId.startsWith('car-') && !currentAgentIds.has(poolId.slice(4))) {
        releasePool(poolId)
      }
    }
    for (const id of lastBrakeTime.keys()) {
      if (!currentAgentIds.has(id)) lastBrakeTime.delete(id)
    }
    for (const id of carHornPlayed) {
      if (!currentAgentIds.has(id)) carHornPlayed.delete(id)
    }
    for (const id of carHornWait.keys()) {
      if (!currentAgentIds.has(id)) carHornWait.delete(id)
    }
    for (const id of stepTimers.keys()) {
      if (!currentAgentIds.has(id)) stepTimers.delete(id)
    }
    for (const id of carPrevSpeeds.keys()) {
      if (!currentAgentIds.has(id)) carPrevSpeeds.delete(id)
    }

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
    // releasePool синхронизирует движок и реестр пулов
    releasePool(`car-${agentId}`)

    // Очищаем все локальные карты
    stepTimers.delete(agentId)
    carPrevSpeeds.delete(agentId)
    lastBrakeTime.delete(agentId)
    carHornPlayed.delete(agentId)
    carHornWait.delete(agentId)
  }

  const resetAllAudioTimers = () => {
    stepTimers.clear()
    carPrevSpeeds.clear()
    lastBrakeTime.clear()
    carHornPlayed.clear()
    carHornWait.clear()
    audio.resetPool('gate-active')
  }

  // [ФИКС-звук] Полное глушение двигателей всех машин: пауза/выключение
  // симулятора, закрытие виджета. Раньше при остановке игрового цикла пулы
  // продолжали звучать с последней громкостью — гул слышен «после
  // выключения симулятора», пока страницу не перезагрузят.
  const stopAllCarEngines = () => {
    for (const poolId of [...createdPools]) {
      if (poolId.startsWith('car-')) releasePool(poolId)
    }
    carPrevSpeeds.clear()
    lastBrakeTime.clear()
    carHornPlayed.clear()
    carHornWait.clear()
  }

  return {
    initAudioPools,
    updateAllAudio,
    cleanupAgentSounds,
    resetAllAudioTimers,
    stopAllCarEngines,
    visibleAgentLabels,
    updateIntercomAndLabels
  }
}