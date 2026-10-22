// app/composables/useModalA11y.ts
// [№15-UX/A11y] Единое поведение модальных окон:
//   - Esc закрывает только ВЕРХНЮЮ модалку (стек на уровне модуля);
//   - Tab не уходит под фон (ловушка фокуса в пределах корня модалки);
//   - при открытии фокус в первый интерактивный элемент,
//     при закрытии — возврат туда, откуда модалку открыли.
// UiConfirmDialog/UiPromptDialog используют тот же стек: Esc поверх формы
// закрывает только диалог подтверждения, второе нажатие — форму.

import { watch, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'

// --- Стек открытых модалок (уровень модуля) ---
const modalStack: string[] = []
let modalIdCounter = 0

export const isTopModal = (id: string): boolean =>
  modalStack[modalStack.length - 1] === id

export interface ModalA11yOptions {
  /** Реактивная видимость модалки */
  isOpen: Ref<boolean> | (() => boolean)
  /** Закрыть модалку (Esc) */
  onClose: () => void
  /** Корневой элемент модалки (ref из шаблона) */
  root: Ref<HTMLElement | null> | (() => HTMLElement | null)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const useModalA11y = (options: ModalA11yOptions) => {
  const modalId = `modal-${++modalIdCounter}`
  let lastFocused: HTMLElement | null = null
  let keyHandler: ((e: KeyboardEvent) => void) | null = null

  const getRoot = (): HTMLElement | null =>
    typeof options.root === 'function' ? options.root() : options.root.value

  const open = () => {
    if (typeof document === 'undefined') return
    modalStack.push(modalId)
    lastFocused = document.activeElement as HTMLElement | null
    keyHandler = (e: KeyboardEvent) => {
      if (!isTopModal(modalId)) return // сверху открыта другая модалка — не наша очередь
      if (e.key === 'Escape') {
        e.preventDefault()
        options.onClose()
        return
      }
      if (e.key === 'Tab') {
        const root = getRoot()
        if (!root) return
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
          .filter(n => n.offsetParent !== null || n === document.activeElement)
        if (nodes.length === 0) {
          e.preventDefault()
          return
        }
        const first = nodes[0] as HTMLElement
        const last = nodes[nodes.length - 1] as HTMLElement
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    // capture: раньше собственных Vue-обработчиков, чтобы Esc не «протекал» в форму
    document.addEventListener('keydown', keyHandler, true)
    // фокус в первый элемент после монтирования (v-if модалка появляется в этом тике)
    nextTick(() => {
      const target = getRoot()?.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    })
  }

  const close = () => {
    if (typeof document === 'undefined') return
    const i = modalStack.lastIndexOf(modalId)
    if (i !== -1) modalStack.splice(i, 1)
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler, true)
      keyHandler = null
    }
    // возврат фокуса туда, откуда модалку открыли
    lastFocused?.focus?.()
    lastFocused = null
  }

  watch(
    () => (typeof options.isOpen === 'function' ? options.isOpen() : options.isOpen.value),
    (openNow) => {
      if (openNow) open()
      else close()
    },
  )

  // модалка размонтирована открытой (v-if снаружи) — снять регистрацию
  onUnmounted(() => close())

  return { modalId }
}
