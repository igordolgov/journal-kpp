// app/utils/panelBacking.ts
// [№17] Единый стиль подложки панелей кнопок — для симулятора и канваса
// редактора. Раньше фон был жёстко зашит (#2d3748, непрозрачный) и игнорировал
// настройки панели: панель полностью закрывала сцену под собой. Теперь
// подложка полупрозрачная и матовая (эффект frosted glass): цвет, прозрачность
// и радиус размытия настраиваются в редакторе (инспектор панели -> «Оформление»),
// а значения по умолчанию дают матовое стекло сразу во всех сценах.

export const PANEL_BG_COLOR = '#2d3748'
export const PANEL_BORDER_COLOR = '#4a5568'
export const PANEL_BG_OPACITY = 0.6 // полупрозрачно «из коробки»
export const PANEL_BLUR_PX = 6      // матирование «из коробки»

export interface PanelBackingInput {
  x?: number
  y?: number
  width?: number
  height?: number
  bgColor?: string
  borderColor?: string
  /** Прозрачность фона 0..1 (1 = непрозрачно, как раньше) */
  bgOpacity?: number
  /** Радиус матирования (backdrop-blur) в px, 0 = без размытия */
  blur?: number
}

// #rrggbb -> rgba(r, g, b, a); не-hex значения (rgba()/именованные) — как есть
export const colorWithAlpha = (color: string, alpha: number): string => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color || '')
  if (!m) return color
  const n = parseInt(m[1] ?? '', 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export const panelBackingStyle = (
  panel: PanelBackingInput,
): Record<string, string | number> => {
  const color = panel.bgColor || PANEL_BG_COLOR
  const rawOpacity = panel.bgOpacity == null ? PANEL_BG_OPACITY : Number(panel.bgOpacity)
  const opacity = Number.isFinite(rawOpacity)
    ? Math.max(0, Math.min(1, rawOpacity))
    : PANEL_BG_OPACITY
  const rawBlur = panel.blur == null ? PANEL_BLUR_PX : Number(panel.blur)
  const blur = Number.isFinite(rawBlur)
    ? Math.max(0, Math.min(30, rawBlur))
    : PANEL_BLUR_PX

  const style: Record<string, string | number> = {
    left: `${panel.x ?? 0}px`,
    top: `${panel.y ?? 0}px`,
    width: `${panel.width ?? 200}px`,
    height: `${panel.height ?? 150}px`,
    backgroundColor: colorWithAlpha(color, opacity),
    border: `1px solid ${panel.borderColor || PANEL_BORDER_COLOR}`,
    borderRadius: '6px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
  }
  if (blur > 0) {
    // Матовая подложка: размывает ВСЁ под панелью (сцену, агентов, ворота)
    style.backdropFilter = `blur(${blur}px)`
    // webkit-префикс для старых Chromium (портативный exe)
    style.webkitBackdropFilter = `blur(${blur}px)`
  }
  return style
}
