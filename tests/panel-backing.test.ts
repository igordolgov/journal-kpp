// tests/panel-backing.test.ts
// [№17] Подложка панелей кнопок: полупрозрачная и матовая по умолчанию,
// настройки из редактора (bgColor/bgOpacity/blur) применяются, прежнее
// непрозрачное поведение достижимо (bgOpacity=1, blur=0).

import { describe, it, expect } from 'vitest'
import {
  panelBackingStyle, colorWithAlpha,
  PANEL_BG_COLOR, PANEL_BG_OPACITY, PANEL_BLUR_PX,
} from '~/utils/panelBacking'

describe('colorWithAlpha', () => {
  it('hex -> rgba с альфой', () => {
    expect(colorWithAlpha('#2d3748', 0.6)).toBe('rgba(45, 55, 72, 0.6)')
  })
  it('hex без решётки тоже понимается', () => {
    expect(colorWithAlpha('ff0000', 1)).toBe('rgba(255, 0, 0, 1)')
  })
  it('не-hex значение возвращается как есть', () => {
    expect(colorWithAlpha('rgba(1,2,3,0.5)', 0.9)).toBe('rgba(1,2,3,0.5)')
    expect(colorWithAlpha('red', 0.9)).toBe('red')
  })
})

describe('panelBackingStyle — дефолт «матовое стекло»', () => {
  const st = panelBackingStyle({ x: 10, y: 20, width: 300, height: 140 })

  it('фон — цвет панели с полупрозрачной альфой', () => {
    expect(st.backgroundColor).toBe(colorWithAlpha(PANEL_BG_COLOR, PANEL_BG_OPACITY))
    expect(PANEL_BG_OPACITY).toBeLessThan(1)
  })
  it('матирование включено по умолчанию', () => {
    expect(st.backdropFilter).toBe(`blur(${PANEL_BLUR_PX}px)`)
    expect(st.webkitBackdropFilter).toBe(`blur(${PANEL_BLUR_PX}px)`)
  })
  it('геометрия и рамка сохранены', () => {
    expect(st.left).toBe('10px')
    expect(st.top).toBe('20px')
    expect(st.width).toBe('300px')
    expect(st.height).toBe('140px')
    expect(st.border).toBe('1px solid #4a5568')
    expect(st.zIndex).toBe(9999)
  })
})

describe('panelBackingStyle — настройки из редактора', () => {
  it('bgOpacity=1 и blur=0 дают прежнее непрозрачное поведение без blur', () => {
    const st = panelBackingStyle({ bgOpacity: 1, blur: 0 })
    expect(st.backgroundColor).toBe('rgba(45, 55, 72, 1)')
    expect('backdropFilter' in st).toBe(false)
    expect('webkitBackdropFilter' in st).toBe(false)
  })
  it('свой цвет и рамка применяются', () => {
    const st = panelBackingStyle({ bgColor: '#112233', borderColor: '#abcdef', bgOpacity: 0.25, blur: 3 })
    expect(st.backgroundColor).toBe('rgba(17, 34, 51, 0.25)')
    expect(st.border).toBe('1px solid #abcdef')
    expect(st.backdropFilter).toBe('blur(3px)')
  })
  it('выход за диапазоны обрезается (0..1 и 0..30)', () => {
    const st = panelBackingStyle({ bgOpacity: 5, blur: -10 })
    expect(st.backgroundColor).toBe(colorWithAlpha(PANEL_BG_COLOR, 1))
    expect('backdropFilter' in st).toBe(false) // blur 0 после клампа
    const st2 = panelBackingStyle({ bgOpacity: -1, blur: 99 })
    expect(st2.backgroundColor).toBe(colorWithAlpha(PANEL_BG_COLOR, 0))
    expect(st2.backdropFilter).toBe('blur(30px)')
  })
  it('пустая панель получает дефолтную геометрию 200x150', () => {
    const st = panelBackingStyle({})
    expect(st.width).toBe('200px')
    expect(st.height).toBe('150px')
  })
})
