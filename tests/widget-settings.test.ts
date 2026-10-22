// tests/widget-settings.test.ts
// [ФИКС-НАСТРОЙКИ] Настройки поповера симулятора сохраняются и
// восстанавливаются; мусор и пустые строки превращаются в null.

// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  loadWidgetSettings,
  saveWidgetSettings,
  defaultWidgetSettings,
  WIDGET_SETTINGS_KEY,
} from '~/utils/widgetSettings'

describe('настройки поповера симулятора (localStorage)', () => {
  it(' roundtrip: сохранили — загрузили то же', () => {
    saveWidgetSettings(localStorage, {
      maxAgents: 7,
      personIntervalMin: 20,
      personIntervalMax: 60,
      carIntervalMin: null,
      carIntervalMax: null,
      maxGroupSize: 3,
      maxNonFamily: 1,
      volume: 0.8,
      muted: true,
    })
    const loaded = loadWidgetSettings(localStorage)
    expect(loaded.maxAgents).toBe(7)
    expect(loaded.personIntervalMin).toBe(20)
    expect(loaded.personIntervalMax).toBe(60)
    expect(loaded.carIntervalMin).toBeNull()
    expect(loaded.maxGroupSize).toBe(3)
    expect(loaded.maxNonFamily).toBe(1)
    // [№15-ЗВУК] громкость/тишина переживают roundtrip
    expect(loaded.volume).toBe(0.8)
    expect(loaded.muted).toBe(true)
  })

  it('[№15-ЗВУК] громкость зажимается в 0..1; 0 допустим (mute)', () => {
    localStorage.clear()
    saveWidgetSettings(localStorage, { ...defaultWidgetSettings(), volume: 5, muted: false })
    expect(loadWidgetSettings(localStorage).volume).toBe(1)
    saveWidgetSettings(localStorage, { ...defaultWidgetSettings(), volume: -2, muted: false })
    expect(loadWidgetSettings(localStorage).volume).toBe(0)
    saveWidgetSettings(localStorage, { ...defaultWidgetSettings(), volume: 0, muted: false })
    expect(loadWidgetSettings(localStorage).volume).toBe(0)
    localStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify({ volume: 'мусор', muted: 'yes' }))
    const loaded = loadWidgetSettings(localStorage)
    expect(loaded.volume).toBeNull()
    expect(loaded.muted).toBe(false) // строго boolean true
  })

  it('пустые строки и мусор -> null (значение «не задано»)', () => {
    localStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify({
      maxAgents: '', personIntervalMin: 'abc', personIntervalMax: -5,
      carIntervalMin: 0, carIntervalMax: undefined, maxGroupSize: null,
    }))
    const loaded = loadWidgetSettings(localStorage)
    expect(loaded.maxAgents).toBeNull()
    expect(loaded.personIntervalMin).toBeNull()
    expect(loaded.personIntervalMax).toBeNull()
    expect(loaded.carIntervalMin).toBeNull()
    expect(loaded.carIntervalMax).toBeNull()
    expect(loaded.maxGroupSize).toBeNull()
  })

  it('битый JSON -> дефолты (все null)', () => {
    localStorage.setItem(WIDGET_SETTINGS_KEY, '{битый json')
    const loaded = loadWidgetSettings(localStorage)
    expect(loaded).toEqual(defaultWidgetSettings())
  })

  it('нет ключа в хранилище -> дефолты', () => {
    localStorage.clear()
    const loaded = loadWidgetSettings(localStorage)
    expect(loaded).toEqual(defaultWidgetSettings())
  })

  it('storage недоступен -> дефолты без падения', () => {
    expect(loadWidgetSettings(null)).toEqual(defaultWidgetSettings())
    expect(() => saveWidgetSettings(null, defaultWidgetSettings())).not.toThrow()
  })
})
