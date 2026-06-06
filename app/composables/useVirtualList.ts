// app/composables/useVirtualList.ts
// Простой виртуальный скролл для таблиц с большим числом строк.
// Рендерит только видимые строки + небольшой буфер сверху и снизу.
// Использование:
//   const { containerProps, wrapperProps, list } = useVirtualList(items, { itemHeight: 48 })
//   <div v-bind="containerProps"><div v-bind="wrapperProps"><tr v-for="{ data } in list" /></div></div>

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

interface VirtualListOptions {
  itemHeight: number   // высота одной строки в px
  overscan?: number    // сколько строк рендерить вне видимой зоны (по умолчанию 5)
}

export function useVirtualList<T>(list: Ref<T[]>, options: VirtualListOptions) {
  const { itemHeight, overscan = 5 } = options
  const containerRef = ref<HTMLElement | null>(null)
  const scrollTop = ref(0)
  const containerHeight = ref(600)

  const handleScroll = (e: Event) => {
    scrollTop.value = (e.target as HTMLElement).scrollTop
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => {
        containerHeight.value = entries[0]?.contentRect.height ?? 600
      })
    : null

  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
      resizeObserver?.observe(containerRef.value)
      containerHeight.value = containerRef.value.clientHeight
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
      resizeObserver?.unobserve(containerRef.value)
    }
    resizeObserver?.disconnect()
  })

  const visibleItems = computed(() => {
    const total = list.value.length
    if (!total) return []

    const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan)
    const endIndex = Math.min(
      total - 1,
      Math.ceil((scrollTop.value + containerHeight.value) / itemHeight) + overscan
    )

    const items = []
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({
        data: list.value[i],
        index: i,
        offsetTop: i * itemHeight,
      })
    }
    return items
  })

  const totalHeight = computed(() => list.value.length * itemHeight)

  const containerProps = computed(() => ({
    ref: containerRef,
    style: { overflow: 'auto', height: '100%' } as const,
  }))

  const wrapperProps = computed(() => ({
    style: { height: `${totalHeight.value}px`, position: 'relative' as const },
  }))

  return {
    containerProps,
    wrapperProps,
    list: visibleItems,
    totalHeight,
    containerRef,
  }
}
