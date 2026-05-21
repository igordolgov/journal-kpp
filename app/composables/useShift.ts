// composables/useShift.ts
import { ref, computed } from 'vue'
import { useDatabase } from './useDatabase'

// Глобальное состояние смены
const currentShift = ref<any>(null)
const shiftHistory = ref<any[]>([])
const isLoading = ref(false)

export const useShift = () => {
  const { getAllItems, addItem, updateItem } = useDatabase()

  const loadCurrentShift = async () => {
    if (import.meta.server) return // Защита SSR
    isLoading.value = true
    try {
      const shifts = await getAllItems('shifts')
      const active = shifts.find((s: any) => !s.end_time)
      currentShift.value = active || null
      shiftHistory.value = shifts
        .filter((s: any) => s.end_time)
        .sort((a: any, b: any) => b.start_time - a.start_time)
        .slice(0, 10)
    } catch (e) {
      console.error('Error loading shifts:', e)
    } finally {
      isLoading.value = false
    }
  }

  const startShift = async (guardName: string) => {
    if (!guardName.trim()) throw new Error('Введите имя охранника')
    
    const now = Date.now()
    const newShift = {
      guard_name: guardName,
      start_time: now,
      end_time: null
    }
    
    const id = await addItem('shifts', newShift)
    currentShift.value = { ...newShift, id }
    return id
  }

  const startBreak = async () => {
    if (!currentShift.value) return
    // Логика начала перерыва (если нужна)
  }

  const endBreak = async () => {
    if (!currentShift.value) return
    // Логика конца перерыва (если нужна)
  }

  const endShift = async () => {
    if (!currentShift.value) return
    
    const now = Date.now()
    const updatedShift = {
      ...currentShift.value,
      end_time: now
    }
    
    await updateItem('shifts', updatedShift)
    
    // Добавляем текущую смену в историю и сбрасываем
    shiftHistory.value.unshift(updatedShift)
    if (shiftHistory.value.length > 10) shiftHistory.value.pop()
    
    currentShift.value = null
  }

  // Вычисляет, кто реально сейчас на посту
  // Если перерыв, можно вернуть имя подмены или null
  const actingGuardName = computed(() => {
    if (!currentShift.value) return null
    return currentShift.value.guard_name
  })

  // Время текущей смены
  const getActiveDuration = computed(() => {
    if (!currentShift.value || !currentShift.value.start_time) return 0
    return Date.now() - currentShift.value.start_time
  })

  return {
    currentShift,
    shiftHistory,
    isLoading,
    loadCurrentShift,
    startShift,
    endShift,
    startBreak,
    endBreak,
    actingGuardName,
    getActiveDuration
  }
}