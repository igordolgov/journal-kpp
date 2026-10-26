// tests/stubs/useSimulatorIntegration.ts
// Заглушка интеграции с БД для юнит-тестов спавна: люди задаются списком,
// статусные карты не нужны. API совпадает с реальным useSimulatorIntegration
// в той части, которую использует useSimulatorSpawn.

import { ref, type Ref } from 'vue'

export interface IntegrationStubOptions {
  people?: any[]
  vehicles?: Record<number, any>
}

export function useSimulatorIntegration(opts: IntegrationStubOptions = {}) {
  const people: any[] = opts.people ?? []
  const vehicles: Record<number, any> = opts.vehicles ?? {}

  const usedPeopleIds = ref<Set<number>>(new Set())
  const allPeople: Ref<any[]> = ref(people)

  const freeOf = (activeIds: Set<number>, extraIds: Set<number>) =>
    people.filter(p => !activeIds.has(p.id) && !extraIds.has(p.id) && !usedPeopleIds.value.has(p.id))

  // Семантика реальной интеграции: enter — человек СНАРУЖИ (location !== 'inside'),
  // exit — человек ВНУТРИ (location === 'inside')
  const isOutside = (loc: unknown) => loc !== 'inside'

  const getAvailablePerson = (direction: 'enter' | 'exit', activeIds: Set<number> = new Set(), extraIds: Set<number> = new Set()) => {
    const eligible = freeOf(activeIds, extraIds).filter(p =>
      direction === 'enter' ? isOutside(p.location) : !isOutside(p.location)
    )
    if (!eligible.length) return null
    return eligible[0]
  }

  // Семья: следующие за лидером люди из списка с тем же направлением
  const getFamilyGroup = (leader: any, direction: 'enter' | 'exit', maxSize: number, activeIds: Set<number> = new Set(), extraIds: Set<number> = new Set()) => {
    const eligible = freeOf(activeIds, extraIds)
      .filter(p => p.id !== leader.id)
      .filter(p => direction === 'enter' ? isOutside(p.location) : !isOutside(p.location))
    return eligible.slice(0, Math.max(0, maxSize - 1))
  }

  const getRandomOccupants = (leader: any, direction: 'enter' | 'exit', count: number, activeIds: Set<number> = new Set(), extraIds: Set<number> = new Set()) => {
    return getFamilyGroup(leader, direction, count + 1, activeIds, extraIds).slice(0, count)
  }

  const getTravelMode = (person: any): 'walk' | 'car' => (person?.travelMode === 'car' ? 'car' : 'walk')

  const getAvailableVehicleForPerson = (personId: number) => vehicles[personId] ?? null

  const getVehicleColor = (vehicle: any) => vehicle?.color ?? '#888888'

  const formatDisplayName = (fio: string) => fio

  const createPersonInfo = (person: any) => ({ id: person.id, fio: person.fio })

  const logAgentEvent = async () => {}

  const updateAgentStatusOnly = () => {}

  const canBeWith = () => true

  // [№33-ДЕТИ] единая проверка «это ребёнок» — критерии совпадают с
  // реальной интеграцией (ageGroup/exit_category/allowed_guardians/category/is_child)
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

  return {
    getAvailablePerson,
    getFamilyGroup,
    getRandomOccupants,
    getTravelMode,
    getAvailableVehicleForPerson,
    getVehicleColor,
    formatDisplayName,
    createPersonInfo,
    logAgentEvent,
    updateAgentStatusOnly,
    canBeWith,
    isChildPerson,
    usedPeopleIds,
    allPeople,
  }
}
