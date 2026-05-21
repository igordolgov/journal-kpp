// app/composables/useSimulatorDatabase.ts
// УСТАРЕЛО: Используйте useSimulatorIntegration вместо этого файла.
// Оставлено для обратной совместимости.

import { useSimulatorIntegration } from './useSimulatorIntegration'

export function useSimulatorDatabase() {
  const integration = useSimulatorIntegration()
  
  return {
    loadData: integration.loadAllData,
    dbPeople: integration.dbPeople,
    dbVehicles: integration.dbVehicles,
    vehiclesByOwner: integration.vehiclesByOwner,
    usedPeopleIds: integration.usedPeopleIds,
    allPeople: integration.allPeople,
    getRandomPerson: () => integration.getAvailablePerson('exit'), // по умолчанию для выхода
    getTravelMode: integration.getTravelMode,
    getRandomVehicleForPerson: integration.getRandomVehicleForPerson,
    getVehicleColor: integration.getVehicleColor
  }
}