// composables/useSimulatorData.ts
// Загрузка и управление данными людей и машин из БД

import { ref, Ref } from 'vue'
import { useDatabase } from './useDatabase'

export function useSimulatorData() {
  const { getAllItems } = useDatabase()
  
  const dbPeople = ref<any[]>([])
  const dbVehicles = ref<any[]>([])
  const vehiclesByOwner = ref<Map<number, any[]>>(new Map())
  const usedPeopleIds = ref<Set<number>>(new Set())
  const allPeople = ref<any[]>([])

  const loadData = async () => {
    try {
      dbPeople.value = (await getAllItems('people')) || []
      dbVehicles.value = (await getAllItems('vehicles')) || []
      vehiclesByOwner.value.clear()
      dbVehicles.value.forEach(v => {
        if (!vehiclesByOwner.value.has(v.owner_id)) 
          vehiclesByOwner.value.set(v.owner_id, [])
        vehiclesByOwner.value.get(v.owner_id)!.push(v)
      })
      usedPeopleIds.value.clear()
      allPeople.value = dbPeople.value.filter(p => p.ageGroup !== 'child')
      console.log(`[AI] Загружено людей: ${dbPeople.value.length}, доступно: ${allPeople.value.length}, машин: ${dbVehicles.value.length}`)
    } catch (e) {
      console.error('[AI] Ошибка загрузки БД:', e)
    }
  }

  const getRandomPerson = () => {
    if (!allPeople.value.length) return null
    const available = allPeople.value.filter(p => !usedPeopleIds.value.has(p.id))
    if (!available.length) {
      usedPeopleIds.value.clear()
      return allPeople.value[Math.floor(Math.random() * allPeople.value.length)]
    }
    const person = available[Math.floor(Math.random() * available.length)]
    usedPeopleIds.value.add(person.id)
    return person
  }

  const getTravelMode = (person: any): 'walk' | 'car' => {
    const hasCar = (vehiclesByOwner.value.get(person.id) || []).length > 0
    return hasCar && Math.random() > 0.5 ? 'car' : 'walk'
  }

  const getVehicleForPerson = (personId: number) => {
    return (vehiclesByOwner.value.get(personId) || [])[0]
  }

  return {
    loadData,
    dbPeople,
    dbVehicles,
    vehiclesByOwner: vehiclesByOwner as Ref<Map<number, any[]>>,
    usedPeopleIds,
    allPeople,
    getRandomPerson,
    getTravelMode,
    getVehicleForPerson
  }
}