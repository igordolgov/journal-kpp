// composables/simulator/useSimulatorRendering.ts
// Масштабирование холста под контейнер.
// [№31-БЕЗ-ПОВОРОТА] флаг enableVisualRotation и функции поворота спрайтов
// удалены вместе с кнопкой «Поворот спрайтов» в окне симулятора.
import { ref, type Ref } from 'vue'

export function useSimulatorRendering(containerRef: Ref<HTMLElement | null>, sceneSize: Ref<{ width: number; height: number }>) {
  const scale = ref(1)

  // Подгон масштаба холста под контейнер: вся сцена (её КОНФИГ-размер)
  // уменьшается, чтобы поместиться целиком — без обрезки краёв
  const updateScale = () => {
    if (!containerRef.value) return
    const cw = containerRef.value.clientWidth
    const ch = containerRef.value.clientHeight
    if (cw > 10 && ch > 10) {
      scale.value = Math.min(cw / sceneSize.value.width, ch / sceneSize.value.height, 1)
    }
  }

  // Инициализация масштабирования с подпиской на resize
  const initScaling = () => {
    window.addEventListener('resize', updateScale)
    updateScale()
    // Возвращаем функцию для очистки
    return () => window.removeEventListener('resize', updateScale)
  }

  const cleanupScaling = () => {
    // Удаляем обработчик, если он был добавлен (но обычно возвращаем из initScaling)
  }

  return {
    scale,
    updateScale,
    initScaling,
    cleanupScaling,
  }
}