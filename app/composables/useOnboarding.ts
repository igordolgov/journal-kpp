// app/composables/useOnboarding.ts
// Назначение: управление туром первого запуска.
// Флаг 'kpp-onboarding-done' в localStorage. Событийная модель: OnboardingTour
// подписывается через onShow, вызывающие (layout, settings) зовут show().
// [FIX v2] onDispose не существует в EffectScope — автоочистка подписки
// делается через onScopeDispose() (со guard'ом getCurrentScope).

import { getCurrentScope, onScopeDispose } from 'vue'

const STORAGE_KEY = 'kpp-onboarding-done'

type ShowCallback = () => void
const listeners: ShowCallback[] = []

export const useOnboarding = () => {

  /** Тур уже показывался? (клиент-only: на сервере всегда true) */
  const isDone = (): boolean => {
    if (import.meta.server) return true
    return localStorage.getItem(STORAGE_KEY) === '1'
  }

  /** Пометить тур пройденным */
  const markDone = () => {
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, '1')
  }

  /** Сброс — чтобы тур показался при следующем открытии */
  const reset = () => {
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  /** Запросить показ тура (из настроек или первого запуска) */
  const show = () => {
    listeners.forEach(fn => fn())
  }

  /** Подписка компонента тура на показ.
   *  Подписка живёт, пока жив компонент-подписчик (onScopeDispose
   *  снимает её при размонтировании — без утечек). */
  const onShow = (fn: ShowCallback) => {
    // [FIX v2] guard от дублей + правильный API очистки
    if (!listeners.includes(fn)) listeners.push(fn)
    if (getCurrentScope()) {
      onScopeDispose(() => {
        const i = listeners.indexOf(fn)
        if (i !== -1) listeners.splice(i, 1)
      })
    }
  }

  return { isDone, markDone, reset, show, onShow }
}