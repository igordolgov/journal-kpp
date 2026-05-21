// constants/gateConfig.ts

export interface GateParams {
  // Внешняя рамка (косяк)
  frameColor: string       // цвет заливки рамки
  frameStroke: string      // цвет обводки
  frameStrokeWidth: number // толщина обводки (px)
  
  // Параметры прутьев
  barColor: string         // цвет прутьев
  barWidth: number         // ширина прутьев (px)
  barSpacing: number       // расстояние между прутьями (px)
  barOpacity: number       // прозрачность прутьев (0-1)
  
  // Анимация
  openDuration: number     // длительность открытия ворот (сек)
  
  // Специфичные для калитки
  handleColor: string      // цвет ручки
  handleWidth: number      // ширина ручки (px)
  handleHeight: number     // высота ручки (px)
  wicketOpenDuration: number // длительность открытия калитки (сек)
}

export const DEFAULT_GATE_PARAMS: GateParams = {
  frameColor: 'none',
  frameStroke: '#1f2937',
  frameStrokeWidth: 2,
  barColor: '#9ca3af',
  barWidth: 4,
  barSpacing: 12,
  barOpacity: 0.9,
  openDuration: 8,
  handleColor: '#d97706',
  handleWidth: 8,
  handleHeight: 16,
  wicketOpenDuration: 0.5,
}