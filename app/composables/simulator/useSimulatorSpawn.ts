// app/composables/simulator/useSimulatorSpawn.ts
// Назначение: Логика спавна агентов с учётом базы данных и журнала.
// Интеграция с useSimulatorIntegration, фильтрация по активным агентам,
// контроль прав детей, отслеживание статуса автомобилей, динамические параметры групп.

import { type Ref, computed } from 'vue'
import { useAudioEngine } from '~/composables/useAudioEngine'
import { useSimulatorIntegration } from '~/composables/useSimulatorIntegration'
import {
  EXIT_HORIZONTAL_DISTANCE,
  EXIT_VERTICAL_DISTANCE,
  PERSON_STOP_OFFSET,
  CAR_STOP_OFFSET,
} from '~/utils/simulatorConstants'
import { getCarSvg, generateRealPersonSvg } from '~/utils/simulatorSvg'
import type { SceneElement, Direction, TravelMode, TrafficConfig, AiAgent, PersonInfo } from '~/types/simulator'

export function useSimulatorSpawn(
  simElements: Ref<SceneElement[]>,
  aiAgents: Ref<AiAgent[]>,
  sceneSize: Ref<{ width: number; height: number }>,
  fixedXPerson: Ref<number>,
  fixedYPerson: Ref<number>,
  fixedXCar: Ref<number>,
  fixedYCar: Ref<number>,
  integration: ReturnType<typeof useSimulatorIntegration>,
  simOpts: Ref<any>   // реактивный объект с полями maxGroupSize, maxNonFamily и др.
) {
  // Инициализация аудио движка внутри функции (безопасно для SSR)
  const audio = useAudioEngine()

  const {
    getAvailablePerson,
    getFamilyGroup,
    getRandomOccupants,
    getTravelMode,
    getAvailableVehicleForPerson,
    getVehicleColor,
    formatDisplayName,
    createPersonInfo,
    logAgentEvent,
    usedPeopleIds,
    allPeople
  } = integration

  // ----- Таймеры спавна -----
  // [НАСТРОЙКА] Начальные задержки перед первым спавном (в секундах)
  let spawnTimerPersonEnter = 0
  let nextSpawnTimePersonEnter = 3    // Задержка для входящих пешеходов
  let spawnTimerPersonExit = 0
  let nextSpawnPersonExit = 4         // Задержка для выходящих пешеходов
  let spawnTimerCarEnter = 0
  let nextSpawnTimeCarEnter = 5       // Задержка для въезжающих авто
  let spawnTimerCarExit = 0
  let nextSpawnCarExit = 6            // Задержка для выезжающих авто

  const resetSpawnTimers = () => {
    spawnTimerPersonEnter = 0; nextSpawnTimePersonEnter = 3
    spawnTimerPersonExit = 0; nextSpawnPersonExit = 4
    spawnTimerCarEnter = 0; nextSpawnTimeCarEnter = 5
    spawnTimerCarExit = 0; nextSpawnCarExit = 6
  }

  const updateSpawnTimers = (dt: number) => {
    spawnTimerPersonEnter += dt
    spawnTimerPersonExit += dt
    spawnTimerCarEnter += dt
    spawnTimerCarExit += dt
  }

  const shouldSpawn = (timer: number, nextTime: number): boolean => timer >= nextTime
  const getNextInterval = (min: number, max: number): number => min + Math.random() * (max - min)

  // --- Множество ID персонажей, уже находящихся на сцене (активные агенты) ---
  // Используется, чтобы не заспавнить одного и того же человека дважды.
  const activePersonIdsSet = computed(() => {
    const ids = new Set<number>()
    for (const agent of aiAgents.value) {
      if (agent.state !== 'done' && agent.element.personId) {
        ids.add(agent.element.personId)
      }
    }
    return ids
  })

  // ----- Создание одного человека (элемент + агент) -----
  const createPersonAgent = (
    person: any,
    x: number, y: number,
    entryPoint: { x: number; y: number },
    exitPoint: { x: number; y: number },
    afterTarget: { x: number; y: number },
    speed: number,
    direction: Direction,
    width: number, height: number,
    gateId?: string,
    groupId?: string, isLeader: boolean = false, groupIndex: number = 0,
    zIndex: number = 190
  ): { element: SceneElement; agent: AiAgent } => {
    const view = direction === 'exit' ? 'back' : 'front'
    const element: SceneElement = {
      id: `${direction}_person_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      x, y, width, height, rotation: 0, velocity: 0,
      category: 'human', type: 'actor', name: formatDisplayName(person.fio),
      personId: person.id, direction, zIndex,
      travelMode: 'walk',
      groupId, isLeader, groupIndex,
      asset: { type: 'person', content: person, svg: generateRealPersonSvg(person, view, true) }
    }
    const agent: AiAgent = {
      id: element.id,
      element,
      state: 'to_gate',
      target: { x: entryPoint.x, y: entryPoint.y, width: 0, height: 0 },
      afterTarget: { x: afterTarget.x, y: afterTarget.y, width: 0, height: 0 },
      exitPoint: { x: exitPoint.x, y: exitPoint.y, width: 0, height: 0 },
      speed,
      type: 'person',
      direction,
      travelMode: 'walk',
      groupId, isLeader, groupIndex,
      gateId
    }
    return { element, agent }
  }

  // ----- Создание группы пешеходов -----
  const createGroup = (
    direction: Direction,
    leaderPerson: any,
    members: any[],
    cfg: TrafficConfig,
    gate: SceneElement | undefined,
    gateId: string
  ): boolean => {
    console.log(`[SPAWN] createGroup: лидер ${leaderPerson.fio}, ${members.length} спутников`)
    const width = simOpts.value.personWidth
    const height = simOpts.value.personHeight
    const speed = cfg.personSpeed
    const stopOffset = PERSON_STOP_OFFSET
    const fixedX = fixedXPerson.value
    const fixedY = fixedYPerson.value
    const prefix = 'Person'

    // Хелпер для получения абсолютных координат точек (спавн, стоп, деспавн)
    // Приоритет: настройки ворот (оффсеты) -> дефолтные значения (fixedX/Y)
    const getAbs = (key: string, axis: 'X' | 'Y', size: number): number | undefined => {
      const off = gate?.settings?.[`${key}${axis}`]
      if (off !== undefined && off !== null && !isNaN(off)) {
        const center = axis === 'X' ? (gate!.x + gate!.width / 2) : (gate!.y + gate!.height / 2)
        return center - size / 2 + off
      }
      return undefined
    }

    let spawnX: number, spawnY: number
    let entryPointX: number, entryPointY: number
    let exitPointX: number, exitPointY: number
    let afterTargetX: number, afterTargetY: number

    if (direction === 'enter') {
      spawnX = getAbs(`spawnEnter${prefix}`, 'X', width) ?? (sceneSize.value.width + 50)
      spawnY = getAbs(`spawnEnter${prefix}`, 'Y', height) ?? fixedY
      entryPointX = getAbs(`stopEnter${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopEnter${prefix}`, 'Y', height) ?? fixedY
      exitPointX = getAbs(`crossEnter${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossEnter${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      afterTargetX = getAbs(`despawnEnter${prefix}`, 'X', width) ?? fixedX
      afterTargetY = getAbs(`despawnEnter${prefix}`, 'Y', height) ?? (sceneSize.value.height + EXIT_VERTICAL_DISTANCE)
    } else {
      spawnX = getAbs(`spawnExit${prefix}`, 'X', width) ?? fixedX
      spawnY = getAbs(`spawnExit${prefix}`, 'Y', height) ?? (sceneSize.value.height + 50)
      entryPointX = getAbs(`stopExit${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopExit${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      exitPointX = getAbs(`crossExit${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossExit${prefix}`, 'Y', height) ?? fixedY
      afterTargetX = getAbs(`despawnExit${prefix}`, 'X', width) ?? (sceneSize.value.width + EXIT_HORIZONTAL_DISTANCE)
      afterTargetY = getAbs(`despawnExit${prefix}`, 'Y', height) ?? fixedY
    }

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const allPersons = [leaderPerson, ...members]
    const groupAgents: AiAgent[] = []

    // [НАСТРОЙКА] Расстояние между участниками группы
    const HORIZONTAL_STEP = 35  // Шаг по горизонтали (вход)
    const VERTICAL_STEP = 45    // Шаг по вертикали (выход)

    for (let idx = 0; idx < allPersons.length; idx++) {
      const person = allPersons[idx]
      const isLeader = idx === 0
      let hOffset = 0
      let vOffset = 0

      // Расчет смещения для не-лидеров
      if (!isLeader) {
        if (direction === 'enter') {
          // Гуськом при входе
          hOffset = idx * HORIZONTAL_STEP
          vOffset = (idx % 2 === 0 ? -12 : 12) // Небольшой разброс по вертикали
        } else {
          // Гуськом при выходе
          vOffset = idx * VERTICAL_STEP
          hOffset = (idx % 2 === 0 ? -10 : 10) // Небольшой разброс по горизонтали
        }
      }

      // Z-Index: кто ближе к камере (ниже по Y), тот рисуется позже
      let zIndex = 190
      if (direction === 'enter') zIndex = 200 - idx
      else zIndex = 190 + idx

      const posX = spawnX + hOffset
      const posY = spawnY + vOffset
      const stopX = entryPointX + hOffset
      const stopY = entryPointY + vOffset
      const afterX = afterTargetX + hOffset
      const afterY = afterTargetY + vOffset

      const { element, agent } = createPersonAgent(
        person, posX, posY,
        { x: stopX, y: stopY },
        { x: exitPointX, y: exitPointY },
        { x: afterX, y: afterY },
        speed, direction, width, height,
        gateId,
        groupId, isLeader, idx, zIndex
      )
      simElements.value.push(element)
      aiAgents.value.push(agent)
      groupAgents.push(agent)
    }

    // Лидер хранит ссылку на всех участников для управления группой
    const leaderAgent = groupAgents.find(a => a.isLeader)
    if (leaderAgent) {
      leaderAgent.groupMembers = groupAgents
      if (members.length > 0) {
        // Строка имен для метки лидера
        const membersNames = members.map(p => formatDisplayName(p.fio)).join(', ')
        leaderAgent.element.groupLabel = membersNames
      } else {
        leaderAgent.element.groupLabel = ''
      }
    }

    usedPeopleIds.value.add(leaderPerson.id)
    for (const m of members) usedPeopleIds.value.add(m.id)

    return true
  }

  // ----- Одиночный пешеход -----
  const createSinglePerson = (
    direction: Direction,
    person: any,
    cfg: TrafficConfig,
    gate: SceneElement | undefined,
    gateId: string
  ): boolean => {
    const width = simOpts.value.personWidth
    const height = simOpts.value.personHeight
    const speed = cfg.personSpeed
    const stopOffset = PERSON_STOP_OFFSET
    const fixedX = fixedXPerson.value
    const fixedY = fixedYPerson.value
    const prefix = 'Person'

    const getAbs = (key: string, axis: 'X' | 'Y', size: number): number | undefined => {
      const off = gate?.settings?.[`${key}${axis}`]
      if (off !== undefined && off !== null && !isNaN(off)) {
        const center = axis === 'X' ? (gate!.x + gate!.width / 2) : (gate!.y + gate!.height / 2)
        return center - size / 2 + off
      }
      return undefined
    }

    let spawnX: number, spawnY: number
    let entryPointX: number, entryPointY: number
    let exitPointX: number, exitPointY: number
    let afterTargetX: number, afterTargetY: number

    if (direction === 'enter') {
      spawnX = getAbs(`spawnEnter${prefix}`, 'X', width) ?? (sceneSize.value.width + 50)
      spawnY = getAbs(`spawnEnter${prefix}`, 'Y', height) ?? fixedY
      entryPointX = getAbs(`stopEnter${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopEnter${prefix}`, 'Y', height) ?? fixedY
      exitPointX = getAbs(`crossEnter${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossEnter${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      afterTargetX = getAbs(`despawnEnter${prefix}`, 'X', width) ?? fixedX
      afterTargetY = getAbs(`despawnEnter${prefix}`, 'Y', height) ?? (sceneSize.value.height + EXIT_VERTICAL_DISTANCE)
    } else {
      spawnX = getAbs(`spawnExit${prefix}`, 'X', width) ?? fixedX
      spawnY = getAbs(`spawnExit${prefix}`, 'Y', height) ?? (sceneSize.value.height + 50)
      entryPointX = getAbs(`stopExit${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopExit${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      exitPointX = getAbs(`crossExit${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossExit${prefix}`, 'Y', height) ?? fixedY
      afterTargetX = getAbs(`despawnExit${prefix}`, 'X', width) ?? (sceneSize.value.width + EXIT_HORIZONTAL_DISTANCE)
      afterTargetY = getAbs(`despawnExit${prefix}`, 'Y', height) ?? fixedY
    }

    const { element, agent } = createPersonAgent(
      person, spawnX, spawnY,
      { x: entryPointX, y: entryPointY },
      { x: exitPointX, y: exitPointY },
      { x: afterTargetX, y: afterTargetY },
      speed, direction, width, height,
      gateId,
      undefined, false, 0, 190
    )
    simElements.value.push(element)
    aiAgents.value.push(agent)
    usedPeopleIds.value.add(person.id)
    return true
  }

  // ----- Автомобиль с пассажирами -----
  const createCarWithOccupants = (
    driverPerson: any,
    occupants: any[],
    direction: Direction,
    cfg: TrafficConfig,
    gate: SceneElement | undefined,
    gateId: string,
    extraExcludeIds: Set<number> = new Set()
  ): boolean => {
    const car = getAvailableVehicleForPerson(driverPerson.id, direction)
    if (!car) {
      // Если у человека нет машины, переключаемся на пешеходный режим
      return spawnEntity(direction, driverPerson, 'walk', cfg, extraExcludeIds)
    }
    const color = getVehicleColor(car)
    const plate = car.plate
    const width = simOpts.value.carWidth
    const height = simOpts.value.carHeight
    const speed = cfg.carSpeed
    const stopOffset = CAR_STOP_OFFSET
    const fixedX = fixedXCar.value
    const fixedY = fixedYCar.value
    const prefix = 'Car'

    const getAbs = (key: string, axis: 'X' | 'Y', size: number): number | undefined => {
      const off = gate?.settings?.[`${key}${axis}`]
      if (off !== undefined && off !== null && !isNaN(off)) {
        const center = axis === 'X' ? (gate!.x + gate!.width / 2) : (gate!.y + gate!.height / 2)
        return center - size / 2 + off
      }
      return undefined
    }

    let spawnX: number, spawnY: number
    let entryPointX: number, entryPointY: number
    let exitPointX: number, exitPointY: number
    let afterTargetX: number, afterTargetY: number

    if (direction === 'enter') {
      spawnX = getAbs(`spawnEnter${prefix}`, 'X', width) ?? -width - 50
      spawnY = getAbs(`spawnEnter${prefix}`, 'Y', height) ?? fixedY
      entryPointX = getAbs(`stopEnter${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopEnter${prefix}`, 'Y', height) ?? fixedY
      exitPointX = getAbs(`crossEnter${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossEnter${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      afterTargetX = getAbs(`despawnEnter${prefix}`, 'X', width) ?? fixedX
      afterTargetY = getAbs(`despawnEnter${prefix}`, 'Y', height) ?? (sceneSize.value.height + EXIT_VERTICAL_DISTANCE)
    } else {
      spawnX = getAbs(`spawnExit${prefix}`, 'X', width) ?? fixedX
      spawnY = getAbs(`spawnExit${prefix}`, 'Y', height) ?? (sceneSize.value.height + 50)
      entryPointX = getAbs(`stopExit${prefix}`, 'X', width) ?? fixedX
      entryPointY = getAbs(`stopExit${prefix}`, 'Y', height) ?? (fixedY + stopOffset)
      exitPointX = getAbs(`crossExit${prefix}`, 'X', width) ?? fixedX
      exitPointY = getAbs(`crossExit${prefix}`, 'Y', height) ?? fixedY
      afterTargetX = getAbs(`despawnExit${prefix}`, 'X', width) ?? -EXIT_HORIZONTAL_DISTANCE
      afterTargetY = getAbs(`despawnExit${prefix}`, 'Y', height) ?? fixedY
    }

    const carElement: SceneElement = {
      id: `${direction}_car_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      x: spawnX, y: spawnY, width, height, rotation: 0, velocity: 0,
      category: 'car', type: 'actor', name: plate,
      personId: driverPerson.id, direction, zIndex: direction === 'exit' ? 1 : 180,
      travelMode: 'car',
      asset: { type: 'car', plate, color, svg: getCarSvg(color) }
    }

    simElements.value.push(carElement)

    const occupantsInfo: PersonInfo[] = [createPersonInfo(driverPerson)]
    for (const occ of occupants) occupantsInfo.push(createPersonInfo(occ))

    const carAgent: AiAgent = {
      id: carElement.id,
      element: carElement,
      state: 'to_gate',
      target: { x: entryPointX, y: entryPointY, width: 0, height: 0 },
      afterTarget: { x: afterTargetX, y: afterTargetY, width: 0, height: 0 },
      exitPoint: { x: exitPointX, y: exitPointY, width: 0, height: 0 },
      speed,
      type: 'car',
      direction,
      travelMode: 'car',
      occupants: occupantsInfo,
      gateId
    }

    carElement.occupants = occupantsInfo
    aiAgents.value.push(carAgent)

    // Создаем звуковые пулы для новой машины
    audio.createPool(`car-${carAgent.id}`, 'engine', 1)
    audio.createPool(`car-${carAgent.id}`, 'brake', 1)
    audio.createPool(`car-${carAgent.id}`, 'horn', 1)

    usedPeopleIds.value.add(driverPerson.id)
    for (const occ of occupants) usedPeopleIds.value.add(occ.id)
    return true
  }

  // ----- Главная логика спавна конкретного агента -----
  const spawnEntity = (
    direction: Direction,
    person: any,
    travelMode: TravelMode,
    cfg: TrafficConfig,
    extraExcludeIds: Set<number> = new Set()
  ): boolean => {
    if (!person) return false
    const gateId = travelMode === 'walk' ? cfg.personGateId : cfg.carGateId
    const gate = simElements.value.find(g => String(g.id) === gateId)

    if (travelMode === 'walk') {
      // [НАСТРОЙКА] Вероятность появления группы: 30%
      const isGroup = Math.random() < 0.3
      if (!isGroup) return createSinglePerson(direction, person, cfg, gate, gateId)

      // [НАСТРОЙКА] Максимальный размер группы (по умолчанию 4)
      const MAX_GROUP_SIZE = simOpts.value.maxGroupSize ?? 4
      // [НАСТРОЙКА] Макс. кол-во "чужих" людей в группе (не родственников)
      const MAX_NON_FAMILY = simOpts.value.maxNonFamily ?? 1

      // [НАСТРОЙКА] Размер группы: от 2 до 4 человек (rand(3) + 2)
      let groupSize = Math.floor(Math.random() * 3) + 2
      if (groupSize > MAX_GROUP_SIZE) groupSize = MAX_GROUP_SIZE

      // [НАСТРОЙКА] Вероятность, что это семья: 70%
      const familyMembers = Math.random() < 0.7
        ? getFamilyGroup(person, direction, groupSize, activePersonIdsSet.value, extraExcludeIds)
        : []

      let members = [...familyMembers]
      let need = groupSize - 1 - members.length

      // Добираем случайных людей, если семья неполная
      if (need > 0) {
        const currentNonFamily = 0
        const allowedToAdd = Math.min(need, MAX_NON_FAMILY - currentNonFamily)
        if (allowedToAdd > 0) {
          const excludeIds = new Set(members.map(m => m.id))
          const additional = getRandomOccupants(person, direction, allowedToAdd, activePersonIdsSet.value, extraExcludeIds)
            .filter(occ => !excludeIds.has(occ.id) && integration.canBeWith(person, occ))
          members.push(...additional)
        }
      }

      // Убираем дубликаты и проверяем совместимость
      members = members.filter((m, i, arr) => arr.findIndex(t => t.id === m.id) === i)
      members = members.filter(m => integration.canBeWith(person, m))

      // Если никто не набрался, спавним одиночку
      if (members.length === 0) {
        return createSinglePerson(direction, person, cfg, gate, gateId)
      }

      return createGroup(direction, person, members, cfg, gate, gateId)
    } else {
      // --- Автомобиль ---
      // [НАСТРОЙКА] Вероятность наличия пассажиров: 50%
      const hasPassengers = Math.random() < 0.5
      let passengers: any[] = []
      if (hasPassengers) {
        // [НАСТРОЙКА] Количество пассажиров: от 1 до 4
        const count = Math.floor(Math.random() * 4) + 1
        passengers = getRandomOccupants(person, direction, count, activePersonIdsSet.value, extraExcludeIds)
          .filter(occ => integration.canBeWith(person, occ))
      }
      passengers = passengers.filter(occ => integration.canBeWith(person, occ))
      return createCarWithOccupants(person, passengers, direction, cfg, gate, gateId, extraExcludeIds)
    }
  }

  const trySpawn = (
    direction: Direction,
    mode: 'person' | 'car',
    cfg: TrafficConfig,
    extraExcludeIds: Set<number> = new Set()
  ): { success: boolean; personId?: number } => {
    const person = getAvailablePerson(direction, activePersonIdsSet.value, extraExcludeIds)
    if (!person) return { success: false }
    let travelMode: TravelMode = 'walk'
    if (mode === 'car') {
      travelMode = getTravelMode(person)
      if (travelMode !== 'car') return { success: false }
    }
    const result = spawnEntity(direction, person, travelMode, cfg, extraExcludeIds)
    return { success: result, personId: result ? person.id : undefined }
  }

  // ----- Основной цикл обновления спавна -----
  const updateSpawnLogic = (
    dt: number,
    cfg: TrafficConfig,
    hasPeople: boolean,
    currentAgentCount: number,
    maxAgents: number
  ) => {
    if (!hasPeople) return
    // [НАСТРОЙКА] Максимальное количество агентов на сцене (защита от переполнения)
    const safeMax = Math.floor(Number(maxAgents) || 20)
    if (safeMax <= 0) return
    updateSpawnTimers(dt)

    // Чтобы не спавнить одного и того же человека в разные потоки в одном кадре
    const spawnedThisTickIds = new Set<number>()
    let spawnedThisTickCount = aiAgents.value.length

    const canSpawn = () => spawnedThisTickCount < safeMax

    const attemptSpawn = (
      timer: number,
      nextTime: number,
      direction: Direction,
      type: 'person' | 'car',
      minInterval: number,
      maxInterval: number
    ): boolean => {
      if (!shouldSpawn(timer, nextTime)) return false
      if (!canSpawn()) return false

      const { success, personId } = trySpawn(direction, type, cfg, spawnedThisTickIds)
      if (success) {
        if (personId) spawnedThisTickIds.add(personId)
        spawnedThisTickCount++
      }
      return success
    }

    // Попытки спавна для каждого направления
    // Интервалы берутся из конфига (cfg) или настроек пользователя (simOpts)

    // Пешеходы на вход
    if (shouldSpawn(spawnTimerPersonEnter, nextSpawnTimePersonEnter)) {
      if (attemptSpawn(spawnTimerPersonEnter, nextSpawnTimePersonEnter, 'enter', 'person', cfg.intervalMin, cfg.intervalMax)) {
        spawnTimerPersonEnter = 0
        nextSpawnTimePersonEnter = getNextInterval(cfg.intervalMin, cfg.intervalMax)
      } else {
        // Если не удалось заспавнить (например, нет людей), сбрасываем таймер, чтобы не спамить попытки
        spawnTimerPersonEnter = 0
        nextSpawnTimePersonEnter = getNextInterval(cfg.intervalMin, cfg.intervalMax)
      }
    }
    // Пешеходы на выход
    if (shouldSpawn(spawnTimerPersonExit, nextSpawnPersonExit)) {
      if (attemptSpawn(spawnTimerPersonExit, nextSpawnPersonExit, 'exit', 'person', cfg.intervalMin, cfg.intervalMax)) {
        spawnTimerPersonExit = 0
        nextSpawnPersonExit = getNextInterval(cfg.intervalMin, cfg.intervalMax)
      } else {
        spawnTimerPersonExit = 0
        nextSpawnPersonExit = getNextInterval(cfg.intervalMin, cfg.intervalMax)
      }
    }
    // Авто на вход
    if (shouldSpawn(spawnTimerCarEnter, nextSpawnTimeCarEnter)) {
      if (attemptSpawn(spawnTimerCarEnter, nextSpawnTimeCarEnter, 'enter', 'car', simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)) {
        spawnTimerCarEnter = 0
        nextSpawnTimeCarEnter = getNextInterval(simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)
      } else {
        spawnTimerCarEnter = 0
        nextSpawnTimeCarEnter = getNextInterval(simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)
      }
    }
    // Авто на выход
    if (shouldSpawn(spawnTimerCarExit, nextSpawnCarExit)) {
      if (attemptSpawn(spawnTimerCarExit, nextSpawnCarExit, 'exit', 'car', simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)) {
        spawnTimerCarExit = 0
        nextSpawnCarExit = getNextInterval(simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)
      } else {
        spawnTimerCarExit = 0
        nextSpawnCarExit = getNextInterval(simOpts.value.carSpawnIntervalMin, simOpts.value.carSpawnIntervalMax)
      }
    }
  }

  // ----- Логирование при деспавне -----
  const handleAgentDone = async (agent: AiAgent) => {
    if (agent.type === 'person' || (agent.type === 'car' && agent.occupants?.length)) {
      const personId = agent.element.personId
      if (personId) {
        const vehiclePlate = agent.travelMode === 'car'
          ? (agent.element.asset?.plate || '')
          : undefined
        await logAgentEvent(personId, agent.direction, vehiclePlate)
        usedPeopleIds.value.delete(personId)
      }

      if (agent.type === 'car' && agent.occupants) {
        for (const occ of agent.occupants) {
          if (occ.id !== personId) {
            await logAgentEvent(occ.id, agent.direction, agent.element.asset?.plate)
            usedPeopleIds.value.delete(occ.id)
          }
        }
      }
    }
  }

  return {
    updateSpawnLogic,
    resetSpawnTimers,
    handleAgentDone,
  }
}