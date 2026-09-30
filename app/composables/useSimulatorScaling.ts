// app/composables/useSimulatorScaling.ts
// Назначение: управление масштабированием сцены через ResizeObserver.

// [ИСПРАВЛЕНО] verbatimModuleSyntax: Ref — тип, импортируется через import type
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'

export function useSimulatorScaling(
  containerRef: Ref<HTMLElement | null>,
  sceneSize: Ref<{ width: number; height: number }>
) {
  const scale = ref(1)

  const updateScale = () => {
    if (!containerRef.value) return
    const { clientWidth: w, clientHeight: h } = containerRef.value
    scale.value = Math.min(w / sceneSize.value.width, h / sceneSize.value.height, 1)
  }

  let resizeObserver: ResizeObserver | null = null

  const initScaling = () => {
    nextTick(() => {
      updateScale()
      if (containerRef.value) {
        resizeObserver = new ResizeObserver(() => updateScale())
        resizeObserver.observe(containerRef.value)
      }
    })
  }

  // Обязательно вызывать при размонтировании — иначе наблюдатель держит узел
  const cleanupScaling = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  onMounted(initScaling)
  onUnmounted(cleanupScaling)

  return {
    scale,
    updateScale,
    initScaling,
    cleanupScaling
  }
}