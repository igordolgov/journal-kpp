// app/composables/useToast.ts
// Назначение: глобальные тосты — замена нативных alert() по всему приложению.
// Состояние в useState (SSR-safe, общий для всех вызовов useToast()).
//
// API:
//   const toast = useToast()
//   toast.success('Сцена сохранена')          // зелёный, 3.5с
//   toast.error('Ошибка импорта')             // красный, 5с (дольше — чтобы прочитать)
//   toast.warning('Выберите владельца')       // жёлтый
//   toast.info('Данные обновлены')            // синий
//   toast.dismiss(id)                         // закрыть вручную

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

// Счётчик id на уровне модуля (монотонный, коллизий нет)
let toastIdCounter = 0

export const useToast = () => {
  // Общий стейт: любой вызов useToast() видит одни и те же тосты
  const toasts = useState<ToastItem[]>('app-toasts', () => [])

  // Закрыть тост по id
  const dismiss = (id: number) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  // Базовый показ: таймаут 0 = без автозакрытия (только по кнопке)
  const show = (message: string, type: ToastType, timeout: number): number => {
    const id = ++toastIdCounter
    toasts.value = [...toasts.value, { id, type, message }]
    if (import.meta.client && timeout > 0) {
      setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  return {
    toasts,
    dismiss,
    // [НАСТРОЙКА] таймауты: успех/инфо — короткие, ошибка — дольше
    success: (message: string, timeout = 3500) => show(message, 'success', timeout),
    info: (message: string, timeout = 3500) => show(message, 'info', timeout),
    warning: (message: string, timeout = 4500) => show(message, 'warning', timeout),
    error: (message: string, timeout = 5000) => show(message, 'error', timeout),
  }
}