// app/composables/useSimulatorIntegration.ts
// Назначение: Интеграционный слой между БД, журналом событий и симулятором.
// Все состояния вынесены из функции для обеспечения единственного экземпляра (singleton).
// Строит карты статусов людей и автомобилей (внутри/снаружи) по последним записям журнала,
// предоставляет методы для получения доступных агентов с учётом прав, семейных связей,
// активных агентов на сцене и ожидающих обновления статуса.

import { ref, computed } from 'vue'
import { useDatabase } from './useDatabase'
import { useFamily } from './useFamily'
import type { Direction, TravelMode, PersonInfo } from '~/types/simulator'

// Временные статусы, при которых человек не может участвовать в симуляции
const EXCLUDED_STATUSES = ['Командировка', 'Отпуск', 'Болен']

// --- Определение "снаружи/внутри" по полю location ---
// РЕАЛЬНЫЕ значения, которые приходят из базы (см. PersonFormModal.vue, GeneratorModal.vue):
// 'На территории' -> внутри, 'В городе' / 'Город' -> снаружи.
// Раньше тут сравнивалось со строками 'вне территории' / 'outside', которых НИГДЕ в проекте
// нет, поэтому статус всегда считался "внутри" — отсюда спавн людей не с той стороны.
const isOutsideLocation = (location?: string | null): boolean => {
  const loc = (location || '').trim().toLowerCase()
  if (!loc) return false // нет данных о локации — по умолчанию считаем, что человек "на территории"
  return (
    loc.includes('город') ||      // 'В городе', 'Город'
    loc === 'outside' ||
    loc === 'вне территории'
  )
}

// --- Единая проверка "это ребёнок" ---
// Раньше дублировалась в нескольких местах вразнобой — вынесена в одну функцию,
// чтобы критерии "ребёнок" не расходились между фильтрами.
const isChildPerson = (person: any): boolean => {
  if (!person) return false
  return (
    person.ageGroup === 'child' ||
    person.exit_category === 'small' ||
    (Array.isArray(person.allowed_guardians) && person.allowed_guardians.length > 0) ||
    (typeof person.category === 'string' && person.category.toLowerCase().includes('ребен')) ||
    person.is_child === true
  )
}

// --- Корень семьи (id главы) ---
// У главы семьи main_family_id отсутствует (null/undefined), поэтому его "корнем" является он сам.
const getFamilyRootId = (person: any): string => {
  return String(person?.main_family_id ?? person?.id)
}

interface PersonStatus {
  isInside: boolean
  lastEventTime: number
  vehicleOut: string | null
}

// ========== ГЛОБАЛЬНЫЕ СОСТОЯНИЯ (синглтон) ==========
const dbPeople = ref<any[]>([])
const dbVehicles = ref<any[]>([])
const vehiclesByOwner = ref<Map<number, any[]>>(new Map())
const allJournalEntries = ref<any[]>([])
const personStatusMap = ref<Map<number, PersonStatus>>(new Map())
const vehicleStatusMap = ref<Map<string, boolean>>(new Map())
const usedPeopleIds = ref<Set<number>>(new Set())
const pendingStatusUpdateIds = ref<Set<number>>(new Set())
const isLoaded = ref(false)
let lastJournalLength = 0
// ======================================================

export function useSimulatorIntegration() {
  const { getAllItems, addItem, updateItem } = useDatabase()
  const { getFullFamily } = useFamily()

  // --- Загрузка данных ---
  const loadAllData = async () => {
    try {
      const [people, vehicles, journal] = await Promise.all([
        getAllItems('people'),
        getAllItems('vehicles'),
        getAllItems('journal')
      ])
      dbPeople.value = people || []
      dbVehicles.value = vehicles || []
      allJournalEntries.value = journal || []
      vehiclesByOwner.value.clear()
      dbVehicles.value.forEach(v => {
        if (!vehiclesByOwner.value.has(v.owner_id))
          vehiclesByOwner.value.set(v.owner_id, [])
        vehiclesByOwner.value.get(v.owner_id)!.push(v)
      })
      buildStatusMap()
      usedPeopleIds.value.clear()
      isLoaded.value = true
      console.log(`[Integration] Загружено: людей=${dbPeople.value.length}, машин=${dbVehicles.value.length}, записей журнала=${allJournalEntries.value.length}`)
    } catch (e) {
      console.error('[Integration] Ошибка загрузки данных:', e)
    }
  }

  // Перестроить карты статусов
  const buildStatusMap = () => {
    const map = new Map<number, PersonStatus>()
    const entriesByPerson = new Map<number, any[]>()
    for (const entry of allJournalEntries.value) {
      if (!entry.person_id) continue
      if (!entriesByPerson.has(entry.person_id))
        entriesByPerson.set(entry.person_id, [])
      entriesByPerson.get(entry.person_id)!.push(entry)
    }
    for (const [personId, entries] of entriesByPerson) {
      const sorted = entries.sort((a: any, b: any) => {
        const timeA = Math.max(
          a.timestamp_out ? new Date(a.timestamp_out).getTime() : 0,
          a.timestamp_in ? new Date(a.timestamp_in).getTime() : 0,
          a.created_at ? new Date(a.created_at).getTime() : 0
        )
        const timeB = Math.max(
          b.timestamp_out ? new Date(b.timestamp_out).getTime() : 0,
          b.timestamp_in ? new Date(b.timestamp_in).getTime() : 0,
          b.created_at ? new Date(b.created_at).getTime() : 0
        )
        return timeB - timeA
      })
      const lastEntry = sorted[0]
      let inside = true
      let lastEventTime = 0
      let vehicleOut: string | null = null
      if (lastEntry) {
        const outTime = lastEntry.timestamp_out ? new Date(lastEntry.timestamp_out).getTime() : 0
        const inTime = lastEntry.timestamp_in ? new Date(lastEntry.timestamp_in).getTime() : 0
        if (outTime > inTime) {
          inside = false
          lastEventTime = outTime
          vehicleOut = lastEntry.vehicle_out || null
        } else if (inTime > outTime) {
          inside = true
          lastEventTime = inTime
          vehicleOut = null
        } else if (lastEntry.timestamp_out && !lastEntry.timestamp_in) {
          inside = false
          lastEventTime = outTime
          vehicleOut = lastEntry.vehicle_out || null
        } else {
          lastEventTime = Math.max(outTime, inTime)
        }
      }
      map.set(personId, { isInside: inside, lastEventTime, vehicleOut })
    }
    for (const person of dbPeople.value) {
      if (!map.has(person.id)) {
        const inside = !isOutsideLocation(person.location)
        map.set(person.id, { isInside: inside, lastEventTime: 0, vehicleOut: null })
      }
    }
    personStatusMap.value = map

    const vMap = new Map<string, boolean>()
    for (const entry of allJournalEntries.value) {
      const plateOut = entry.vehicle_out?.trim()
      const plateIn = entry.vehicle_in?.trim()
      if (plateOut && plateOut !== '🚶 Пеш.' && plateOut !== '') {
        if (entry.timestamp_out && !entry.timestamp_in) vMap.set(plateOut, false)
        else if (entry.timestamp_in) vMap.set(plateOut, true)
      }
      if (plateIn && plateIn !== '🚶 Пеш.' && plateIn !== '') {
        if (entry.timestamp_in) vMap.set(plateIn, true)
      }
    }
    vehicleStatusMap.value = vMap

    pendingStatusUpdateIds.value.clear()
    lastJournalLength = allJournalEntries.value.length
    console.log(`[Integration] Карта статусов построена: ${map.size} персонажей, ${vMap.size} автомобилей`)
  }

  // Проверка необходимости перестройки статусов (если журнал изменился)
  const refreshStatusMapsIfNeeded = () => {
    if (allJournalEntries.value.length !== lastJournalLength) {
      buildStatusMap()
    }
  }

  // Все люди, подходящие для одиночного спавна (без учёта направления)
  const availablePeople = computed(() => {
    return dbPeople.value.filter((p: any) => {
      if (isChildPerson(p)) return false
      if (p.status && EXCLUDED_STATUSES.includes(p.status)) return false
      return true
    })
  })

  // Получить случайного человека для указанного направления
  const getAvailablePerson = (
    direction: Direction,
    activePersonIds: Set<number> = new Set(),
    extraExcludeIds: Set<number> = new Set()   // <-- новый параметр
  ): any | null => {
    refreshStatusMapsIfNeeded()
    const eligible = availablePeople.value.filter((p: any) => {
      if (activePersonIds.has(p.id)) return false
      if (pendingStatusUpdateIds.value.has(p.id)) return false
      if (extraExcludeIds.has(p.id)) return false  
      const status = personStatusMap.value.get(p.id)
      if (!status) {
        const outside = isOutsideLocation(p.location)
        return direction === 'enter' ? outside : !outside
      }
      return direction === 'enter' ? !status.isInside : status.isInside
    })
    if (!eligible.length) {
      console.warn(`[Integration] Нет доступных людей для направления: ${direction}`)
      return null
    }
    const available = eligible.filter((p: any) => !usedPeopleIds.value.has(p.id))
    let person: any
    if (available.length > 0) {
      person = available[Math.floor(Math.random() * available.length)]
    } else {
      usedPeopleIds.value.clear()
      person = eligible[Math.floor(Math.random() * eligible.length)]
    }
    usedPeopleIds.value.add(person.id)
    return person
  }

  // Получить членов семьи для группы
  const getFamilyGroup = (
  leaderPerson: any,
  direction: Direction,
  maxSize: number,
  activePersonIds: Set<number> = new Set(),
  extraExcludeIds: Set<number> = new Set()
): any[] => {
  refreshStatusMapsIfNeeded()
  const leaderStatus = personStatusMap.value.get(leaderPerson.id)
  const leaderIsInside = leaderStatus ? leaderStatus.isInside : true

  const family = getFullFamily(leaderPerson, dbPeople.value)

  const candidates = family.filter((p: any) => {
    if (activePersonIds.has(p.id)) return false
    if (pendingStatusUpdateIds.value.has(p.id)) return false
    if (extraExcludeIds.has(p.id)) return false
    if (p.id === leaderPerson.id) return false
    if (usedPeopleIds.value.has(p.id)) return false
    if (p.status && EXCLUDED_STATUSES.includes(p.status)) return false

    const status = personStatusMap.value.get(p.id)
    const memberIsInside = status ? status.isInside : true
    if (memberIsInside !== leaderIsInside) return false

    if (!canBeWith(leaderPerson, p)) return false

    return true
  })

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  return candidates.slice(0, maxSize - 1)
}

  // Получить случайных попутчиков
  const getRandomOccupants = (
    leaderPerson: any,
    direction: Direction,
    count: number,
    activePersonIds: Set<number> = new Set(),
    extraExcludeIds: Set<number> = new Set()
  ): any[] => {
    refreshStatusMapsIfNeeded()
    const leaderStatus = personStatusMap.value.get(leaderPerson.id)
    const leaderIsInside = leaderStatus ? leaderStatus.isInside : true
    const eligible = dbPeople.value.filter((p: any) => {
      if (activePersonIds.has(p.id)) return false
      if (pendingStatusUpdateIds.value.has(p.id)) return false
      if (extraExcludeIds.has(p.id)) return false
      if (p.id === leaderPerson.id) return false
      if (usedPeopleIds.value.has(p.id)) return false
      if (p.status && EXCLUDED_STATUSES.includes(p.status)) return false
      const status = personStatusMap.value.get(p.id)
      const memberIsInside = status ? status.isInside : true
      if (memberIsInside !== leaderIsInside) return false
      const isDependent = isChildPerson(p)
      if (isDependent) return false
      return true
    })
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]]
    }
    return eligible.slice(0, count)
  }

  // Транспорт
  const canDrive = (person: any): boolean => {
    if (person.ageGroup === 'child') return false
    if (person.exit_category === 'small') return false
    return true
  }

  const getTravelMode = (person: any): TravelMode => {
    if (!canDrive(person)) return 'walk'
    const hasCar = (vehiclesByOwner.value.get(person.id) || []).length > 0
    return hasCar && Math.random() < 0.7 ? 'car' : 'walk'
  }

  const getAvailableVehicleForPerson = (personId: number, direction: Direction): any | null => {
    const owned = vehiclesByOwner.value.get(personId) || []
    if (owned.length === 0) return null
    for (const car of owned) {
      const plate = car.plate?.trim()
      if (!plate) continue
      const currentStatus = vehicleStatusMap.value.get(plate)
      const inside = currentStatus === undefined ? true : currentStatus
      if (direction === 'enter' && !inside) return car
      if (direction === 'exit' && inside) return car
    }
    return null
  }

  const getVehicleColor = (vehicle: any): string => {
    if (vehicle?.color) return vehicle.color
    const CAR_COLORS = ['forestgreen', 'brown', 'blueviolet', 'darkkhaki', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#f8fafc', '#1e293b']
    // [ИСПРАВЛЕНО] обращение по индексу массива даёт string | undefined —
    // fallback (та же правка, что в TrafficRoad и simulatorSvg)
    return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] ?? '#808080'
  }

  // Логирование события (оптимистичное обновление статуса)
  const logAgentEvent = async (
    personId: number,
    direction: Direction,
    vehiclePlate?: string,
    destination?: string
  ) => {
    const timestamp = Date.now()
    const plate = (vehiclePlate || '').trim()
    const isWalk = !plate || plate === '🚶 Пеш.'

    // Оптимистично обновляем карту статуса
    const currentStatus = personStatusMap.value.get(personId) || { isInside: true, lastEventTime: 0, vehicleOut: null }
    personStatusMap.value.set(personId, {
      isInside: direction === 'enter',
      lastEventTime: timestamp,
      vehicleOut: direction === 'exit' ? (plate || null) : null
    })
    if (!isWalk) {
      vehicleStatusMap.value.set(plate, direction === 'enter')
    }

    pendingStatusUpdateIds.value.add(personId)
    try {
      if (direction === 'exit') {
        // Проверяем, нет ли уже активного выхода для этого человека
        const existingExit = allJournalEntries.value.find((e: any) =>
          String(e.person_id) === String(personId) &&
          e.timestamp_out && !e.timestamp_in
        )
        if (existingExit) {
          // Уже есть активный выход – не создаём дубликат, только обновляем транспорт/назначение, если нужно
          if (vehiclePlate || destination) {
            await updateItem('journal', {
              id: existingExit.id,
              vehicle_out: plate || existingExit.vehicle_out,
              destination: destination || existingExit.destination
            })
          }
        } else {
          // Создаём новую запись выхода
          const entry: any = {
            person_id: personId,
            timestamp_out: timestamp,
            vehicle_out: plate || '🚶 Пеш.',
            destination: destination || '',
            created_at: timestamp
          }
          await addItem('journal', entry)
          allJournalEntries.value.push(entry)
        }
      } else { // direction === 'enter'
        // Ищем активный выход и закрываем его
        const activeEntry = allJournalEntries.value.find((e: any) =>
          String(e.person_id) === String(personId) &&
          e.timestamp_out && !e.timestamp_in
        )
        if (activeEntry) {
          await updateItem('journal', {
            id: activeEntry.id,
            timestamp_in: timestamp,
            vehicle_in: plate || '🚶 Пеш.'
          })
          // Обновляем локально
          const idx = allJournalEntries.value.findIndex((e: any) => e.id === activeEntry.id)
          if (idx !== -1) {
            allJournalEntries.value[idx] = {
              ...allJournalEntries.value[idx],
              timestamp_in: timestamp,
              vehicle_in: plate || '🚶 Пеш.'
            }
          }
        }
        // Если активного выхода нет – человек уже внутри, ничего не делаем
      }
    } catch (e) {
      console.error('[Integration] Ошибка записи в журнал:', e)
    } finally {
      pendingStatusUpdateIds.value.delete(personId)
    }
  }

  // Форматирование
  const formatDisplayName = (fio: string): string => {
    if (!fio) return 'Аноним'
    const parts = fio.trim().split(/\s+/)
    const surname = parts[0] || ''
    const nameInitial = parts[1] ? parts[1].charAt(0).toUpperCase() + '.' : ''
    const patroInitial = parts[2] ? parts[2].charAt(0).toUpperCase() + '.' : ''
    if (nameInitial && patroInitial) return `${surname} ${nameInitial}${patroInitial}`
    if (nameInitial) return `${surname} ${nameInitial}`
    return surname
  }

  const createPersonInfo = (person: any): PersonInfo => ({
    id: person.id,
    fio: formatDisplayName(person.fio),
    isChild: isChildPerson(person),
    canGoAlone: !isChildPerson(person)
  })

  // Может ли "person" находиться в одной группе/машине с "leader" (актуально для детей).
  // БАГ БЫЛ: проверка опиралась ИСКЛЮЧИТЕЛЬНО на person.allowed_guardians, а это поле
  // нигде не заполняется ни сидером (useSeeder.ts), ни формой добавления человека —
  // оно всегда undefined. Поэтому для любого ребёнка canBeWith всегда возвращал false,
  // и дети физически не могли попасть в группу/машину даже с собственными родителями.
  // Теперь: если allowed_guardians явно заданы — используем их (ручная настройка опекунов).
  // Если их нет — считаем опекуном любого взрослого члена той же семьи (общий main_family_id).
  const canBeWith = (leader: any, person: any): boolean => {
    if (!isChildPerson(person)) return true

    const guardians = person.allowed_guardians
    if (Array.isArray(guardians) && guardians.length > 0) {
      return guardians.some((g: any) => String(g) === String(leader.id))
    }

    // Резерв: ребёнок и "лидер" принадлежат одной семье, и лидер сам не ребёнок
    if (isChildPerson(leader)) return false
    return getFamilyRootId(person) === getFamilyRootId(leader)
  }

  // Позволяет внешнему коду обновить журнал (вызывать из useJournal при изменении)
  const reloadJournal = async () => {
    allJournalEntries.value = (await getAllItems('journal')) || []
    buildStatusMap()
  }

  return {
    isLoaded,
    dbPeople,
    dbVehicles,
    allPeople: dbPeople,
    vehiclesByOwner,
    vehicleStatusMap,
    usedPeopleIds,
    pendingStatusUpdateIds,
    personStatusMap,
    loadAllData,
    buildStatusMap,
    reloadJournal,
    canBeWith,
    getAvailablePerson,
    getFamilyGroup,
    getRandomOccupants,
    canDrive,
    getTravelMode,
    getAvailableVehicleForPerson,
    getVehicleColor,
    logAgentEvent,
    formatDisplayName,
    createPersonInfo,
  }
}