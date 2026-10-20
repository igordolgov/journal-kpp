// app/composables/useConfirm.ts
// Назначение: стилизованная замена нативного confirm().
// Promise-based API: вызывающий код просто await'ит ответ — структура
// if (await confirmDialog(...)) идентична прежней if (confirm(...)).
// Состояние в useState (SSR-safe), рендерит единственный UiConfirmDialog
// (смонтирован в app.vue).

export interface ConfirmOptions {
  /** Заголовок вопроса */
  title: string
  /** Пояснение (что произойдёт, последствия). Необязательно. */
  message?: string
  /** Надпись на кнопке подтверждения (по умолчанию «ОК») */
  confirmLabel?: string
  /** Надпись на кнопке отмены */
  cancelLabel?: string
  /** Опасное действие: красная кнопка подтверждения */
  danger?: boolean
}

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  /** resolve-функция активного промиса (не сериализуется в SSR — хранится вне) */
}

// resolve хранится на уровне модуля: функции нельзя класть в useState (SSR-сериализация)
let activeResolve: ((value: boolean) => void) | null = null

export const useConfirm = () => {
  const state = useState<ConfirmState>('app-confirm', () => ({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'ОК',
    cancelLabel: 'Отмена',
    danger: false
  }))

  /**
   * Показать диалог. Резолвится true (подтверждено) / false (отмена).
   */
  const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
    // Повторный вызов до закрытия предыдущего: предыдущий считаем отменённым
    if (activeResolve) {
      activeResolve(false)
      activeResolve = null
    }

    return new Promise<boolean>((resolve) => {
      activeResolve = resolve
      state.value = {
        isOpen: true,
        title: options.title,
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? 'ОК',
        cancelLabel: options.cancelLabel ?? 'Отмена',
        danger: options.danger ?? false
      }
    })
  }

  /** Внутреннее завершение (вызывается из UiConfirmDialog) */
  const settle = (result: boolean) => {
    state.value.isOpen = false
    if (activeResolve) {
      activeResolve(result)
      activeResolve = null
    }
  }

  return { state, confirmDialog, settle }
}