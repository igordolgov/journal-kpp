// app\composables\useTheme.ts
// Назначение: Управление глобальной темой оформления (DaisyUI) и размером шрифта (Accessibility).

import { useState, watch } from '#imports'

// Интерфейс для объекта темы
interface ThemeOption {
  id: string
  name: string
}

export const useTheme = () => {
  // --- Настройки по умолчанию ---
  // Список доступных тем. 
  // Настройка: Добавьте сюда новые темы, если добавили их в DaisyUI config.
  const availableThemes: ThemeOption[] = [
    { id: 'light', name: 'Светлая' },
    { id: 'cupcake', name: 'Кекс' },
    { id: 'dark', name: 'Тёмная' },
    { id: 'business', name: 'Бизнес' }
  ]

  // --- Состояние (State) ---
  // Используем useState для сохранения состояния между компонентами и при SSR.
  const theme = useState<string>('kpp-theme', () => 'light')
  const fontSize = useState<number>('kpp-fontsize', () => 16)

  // --- Вспомогательные функции ---

  // Безопасная работа с LocalStorage (обработка ошибок Private Mode в Safari и т.д.)
  const getStorageItem = (key: string, fallback: string): string => {
    if (!process.client) return fallback
    try {
      return localStorage.getItem(key) || fallback
    } catch (e) {
      console.warn('LocalStorage access denied', e)
      return fallback
    }
  }

  const setStorageItem = (key: string, value: string) => {
    if (!process.client) return
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.warn('LocalStorage access denied', e)
    }
  }

  // --- Логика применения (DOM Manipulation) ---

  // Применяет текущие значения состояния к DOM
  const applyToDom = () => {
    if (!process.client) return
    
    const html = document.documentElement
    const body = document.body
    
    // 1. Тема: вешаем атрибут data-theme на <html> (требование DaisyUI)
    html.setAttribute('data-theme', theme.value)
    
    // 2. Размер шрифта: устанавливаем на html и body для надежного наследования.
    // Используем 'important', чтобы перекрыть стили фреймворков.
    const size = `${fontSize.value}px`
    html.style.setProperty('font-size', size, 'important')
    body.style.setProperty('font-size', size, 'important')
  }

  // Загрузка сохраненных настроек при старте
  const loadTheme = () => {
    if (!process.client) return

    const savedTheme = getStorageItem('kpp-theme', 'light')
    const savedSize = getStorageItem('kpp-fontsize', '16')

    // Обновляем состояние, что вызовет watcher
    if (savedTheme) theme.value = savedTheme
    if (savedSize) fontSize.value = parseInt(savedSize, 10) || 16
    
    // Применяем сразу, чтобы избежать "мигания" стилей после загрузки JS
    applyToDom()
  }

  // --- Реактивность (Watchers) ---

  // Следим за изменениями и сохраняем в Storage + обновляем DOM
  watch([theme, fontSize], () => {
    applyToDom()
    setStorageItem('kpp-theme', theme.value)
    setStorageItem('kpp-fontsize', String(fontSize.value))
  })

  // --- Публичные методы ---

  const setTheme = (val: string) => { theme.value = val }
  const setFontSize = (val: number) => { fontSize.value = val }

  return { 
    theme, 
    fontSize, 
    loadTheme, 
    setTheme, 
    setFontSize, 
    availableThemes 
  }
}