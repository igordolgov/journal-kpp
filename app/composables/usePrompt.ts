// app/composables/usePrompt.ts
// Назначение: стилизованная замена нативного prompt().
// [№15-UX] prompt() уцелел в editor.vue (сохранить сцену как копию) —
// при том, что confirm()/alert() уже давно заменены. API зеркалит useConfirm:
// Promise-based, состояние в useState, рендерит единственный UiPromptDialog.
// resolve хранится на уровне модуля (функции нельзя сериализовать в useState).

export interface PromptOptions {
  title: string
  message?: string
  /** Начальное значение поля */
  value?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface PromptState {
  isOpen: boolean
  title: string
  message: string
  value: string
  placeholder: string
  confirmLabel: string
  cancelLabel: string
}

let activeResolve: ((value: string | null) => void) | null = null

export const usePrompt = () => {
  const state = useState<PromptState>('app-prompt', () => ({
    isOpen: false,
    title: '',
    message: '',
    value: '',
    placeholder: '',
    confirmLabel: 'ОК',
    cancelLabel: 'Отмена',
  }))

  /** Показать диалог. Резолвится строкой (ОК) или null (отмена/Esc). */
  const promptDialog = (options: PromptOptions): Promise<string | null> => {
    if (activeResolve) {
      activeResolve(null)
      activeResolve = null
    }
    return new Promise<string | null>((resolve) => {
      activeResolve = resolve
      state.value = {
        isOpen: true,
        title: options.title,
        message: options.message ?? '',
        value: options.value ?? '',
        placeholder: options.placeholder ?? '',
        confirmLabel: options.confirmLabel ?? 'ОК',
        cancelLabel: options.cancelLabel ?? 'Отмена',
      }
    })
  }

  /** Внутреннее завершение (вызывается из UiPromptDialog) */
  const settle = (result: string | null) => {
    state.value.isOpen = false
    if (activeResolve) {
      activeResolve(result)
      activeResolve = null
    }
  }

  return { state, promptDialog, settle }
}
