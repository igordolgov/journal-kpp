// composables/useHistory.ts
// Назначение: универсальная история состояний (undo/redo) для произвольного объекта.
// [ИСПРАВЛЕНО] удалён импорт debounce из lodash-es — функция нигде не
// использовалась (режим ручного push), а зависимость тянула целый пакет.
// computed импортирован явно, неиспользуемый watch убран.
import { ref, computed } from 'vue'

export const useHistory = <T extends object>(state: T, limit = 50) => {
  const history = ref<string[]>([])
  const currentIndex = ref(-1)
  const isRestoring = ref(false) // Флаг, чтобы не записывать изменения при отмене

  // Сохранение состояния
  const push = () => {
    if (isRestoring.value) return
    
    // Удаляем всё, что было после текущей позиции (ветвление истории)
    const newHistory = history.value.slice(0, currentIndex.value + 1)
    
    // Добавляем новый снимок
    newHistory.push(JSON.stringify(state))
    
    // Ограничиваем размер истории
    if (newHistory.length > limit) newHistory.shift()
    
    history.value = newHistory
    currentIndex.value = newHistory.length - 1
  }

  // Отмена (Ctrl+Z)
  const undo = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--
      restore()
    }
  }

  // Повтор (Ctrl+Shift+Z или Ctrl+Y)
  const redo = () => {
    if (currentIndex.value < history.value.length - 1) {
      currentIndex.value++
      restore()
    }
  }

  // Восстановление состояния из снимка
  const restore = () => {
    isRestoring.value = true
    try {
      const snapshot = history.value[currentIndex.value]
      if (snapshot) {
        Object.assign(state, JSON.parse(snapshot))
      }
    } catch (e) {
      console.error('History restore error', e)
    } finally {
      isRestoring.value = false
    }
  }

  // Автосохранение при изменении (с дебаунсом) сознательно не включено:
  // push() вызывается вручную при структурных изменениях (drag, add, delete),
  // для инпутов — на change/blur. Ручной режим оставлен для гибкости.

  return {
    history,
    push,
    undo,
    redo,
    canUndo: computed(() => currentIndex.value > 0),
    canRedo: computed(() => currentIndex.value < history.value.length - 1)
  }
}