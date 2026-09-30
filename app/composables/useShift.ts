// composables/useShift.ts
// Назначение: состояние смены охранника (начало/конец, перерыв, история).
// [ИСПРАВЛЕНО]: добавлен isOnBreak (ShiftManager деструктурировал его,
// но композабл не возвращал) + состояние перерыва; сигнатуры типизированы явно.
import { ref, computed } from 'vue'
import { useDatabase } from './useDatabase'

// Глобальное состояние смены (модульный уровень — синглтон на сессию)
const currentShift = ref<any>(null)
const shiftHistory = ref<any[]>([])
const isLoading = ref(false)

// Состояние перерыва.
// ⚠️ Хранится в памяти: перезагрузка страницы сбросит перерыв
// (смена при этом восстановится из БД). Персист — кандидат в бэклог.
const isOnBreak = ref(false)
const breakCover = ref<string | null>(null)

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

    // Новая смена — сбрасываем перерыв
    isOnBreak.value = false
    breakCover.value = null
    return id
  }

  // Уход на перерыв (coverName — кто заменяет, опционально)
  const startBreak = async (coverName: string | null) => {
    if (!currentShift.value) return
    isOnBreak.value = true
    breakCover.value = coverName
    // [НАСТРОЙКА] при необходимости — персист перерыва в БД
  }

  // Возвращение с перерыва
  const endBreak = async () => {
    if (!currentShift.value) return
    isOnBreak.value = false
    breakCover.value = null
  }

  const endShift = async (notes: string) => {
    if (!currentShift.value) return

    const now = Date.now()
    const updatedShift = {
      ...currentShift.value,
      end_time: now,
      notes: notes || null // [ДОБАВЛЕНО] примечание из модалки сдачи — теперь сохраняется
    }

    await updateItem('shifts', updatedShift)

    // Добавляем текущую смену в историю и сбрасываем
    shiftHistory.value.unshift(updatedShift)
    if (shiftHistory.value.length > 10) shiftHistory.value.pop()

    currentShift.value = null
    isOnBreak.value = false
    breakCover.value = null
  }

  // Кто реально сейчас на посту: во время перерыва — подменяющий (если указан)
  const actingGuardName = computed<string | null>(() => {
    if (!currentShift.value) return null
    if (isOnBreak.value && breakCover.value) return breakCover.value
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
    isOnBreak,
    actingGuardName,
    getActiveDuration
  }
}