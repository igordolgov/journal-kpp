// composables/simulator/useSimulatorRendering.ts
// Масштабирование, поворот спрайтов, стилизация.
import { ref, type Ref } from 'vue'
import type { SceneElement } from '~/types/simulator'

export function useSimulatorRendering(containerRef: Ref<HTMLElement | null>, sceneSize: Ref<{ width: number; height: number }>) {
  const scale = ref(1)
  const enableVisualRotation = ref(false)

  // Инициализация масштабирования с подпиской на resize
  const initScaling = () => {
    const updateScale = () => {
      if (!containerRef.value) return
      const cw = containerRef.value.clientWidth
      const ch = containerRef.value.clientHeight
      if (cw > 10 && ch > 10) {
        scale.value = Math.min(cw / sceneSize.value.width, ch / sceneSize.value.height, 1)
      }
    }
    window.addEventListener('resize', updateScale)
    updateScale()
    // Возвращаем функцию для очистки
    return () => window.removeEventListener('resize', updateScale)
  }

  const cleanupScaling = () => {
    // Удаляем обработчик, если он был добавлен (но обычно возвращаем из initScaling)
  }

  // Получение стиля элемента (позиция, размер, поворот)
  const getElementStyle = (el: SceneElement) => ({
    position: 'absolute',
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: `${el.width}px`,
    height: `${el.height}px`,
    transform: enableVisualRotation.value && el.rotation ? `rotate(${el.rotation}deg)` : 'none',
    zIndex: el.zIndex || 10,
  })

  const getLabelStyle = (el: SceneElement) => {
    // Стиль для текстовой метки над агентом
    return {
      position: 'absolute',
      left: `${el.x + el.width / 2}px`,
      top: `${el.y - 20}px`,
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      fontSize: '12px',
      padding: '2px 6px',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 200,
    }
  }

  return {
    scale,
    enableVisualRotation,
    initScaling,
    cleanupScaling,
    getElementStyle,
    getLabelStyle,
  }
}