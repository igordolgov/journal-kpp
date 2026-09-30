// constants/library.ts
import type { GateParams } from './gateConfig'

// === НАСТРОЙКИ ПО УМОЛЧАНИЮ ===
export const DEFAULT_GATE_PARAMS = {
  frameColor: 'none',
  frameStroke: '#1f2937',
  frameStrokeWidth: 2,
  barColor: '#9ca3af',
  barWidth: 4,
  barSpacing: 12,
  barOpacity: 0.9,
  openDuration: 2,
  handleColor: '#d97706',
  handleWidth: 8,
  handleHeight: 16,
  wicketOpenDuration: 0.5,
}

// === ГЕНЕРАТОРЫ SVG ДЛЯ ВОРОТ/КАЛИТКИ ===
export const generateSlidingGateSVG = (width: number, height: number, gateParams: Partial<GateParams> = {}) => {
  const params = { ...DEFAULT_GATE_PARAMS, ...gateParams }
  const { frameColor, barColor, barWidth, barSpacing, barOpacity } = params
  
  const innerW = width
  const innerH = height
  
  const edgePadding = 2;
  const availableW = innerW - (edgePadding * 2);
  
  const barsCount = Math.max(1, Math.floor(availableW / barSpacing))
  const actualSpacing = barsCount > 1 ? availableW / (barsCount - 1) : 0;

  const bars = []
  for (let i = 0; i < barsCount; i++) {
    // Считаем координату с учетом отступа
    const x = edgePadding + (i * actualSpacing) - barWidth/2
    bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${innerH}" fill="${barColor}" opacity="${barOpacity}" rx="${barWidth/2}"/>`)
  }

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${frameColor}" rx="2"/>
    <g class="sliding-panel">
      ${bars.join('')}
    </g>
  </svg>`
}

export const generateWicketSVG = (width: number, height: number, gateParams: Partial<GateParams> = {}) => {
  const params = { ...DEFAULT_GATE_PARAMS, ...gateParams }
  const { frameColor, barColor, barWidth, barSpacing, barOpacity, handleColor, handleWidth, handleHeight } = params
  
  const innerW = width
  const innerH = height
  
  const edgePadding = 2;
  const availableW = innerW - (edgePadding * 2);
  
  const barsCount = Math.max(1, Math.floor(availableW / barSpacing))
  const actualSpacing = barsCount > 1 ? availableW / (barsCount - 1) : 0;

  const bars = []
  for (let i = 0; i < barsCount; i++) {
    const x = edgePadding + (i * actualSpacing) - barWidth/2
    bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${innerH}" fill="${barColor}" opacity="${barOpacity}" rx="${barWidth/2}"/>`)
  }

  // ИСПРАВЛЕНИЕ: Ручка также отодвинута от края
  const handleX = innerW - handleWidth - edgePadding - 4
  const handleY = (innerH - handleHeight) / 2

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${frameColor}" rx="2"/>
    <g class="wicket-door" style="transform-origin: 0px ${innerH/2}px;">
      ${bars.join('')}
      <rect x="${handleX}" y="${handleY}" width="${handleWidth}" height="${handleHeight}" fill="${handleColor}" rx="2"/>
    </g>
  </svg>`
}

// === ГЕНЕРАТОРЫ ГЕОМЕТРИЧЕСКИХ ФИГУР ===

type ShapeSettings = {
  fill?: string
  stroke?: string
  strokeWidth?: number
  rotation?: number
  opacity?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
}

// Вспомогательная функция для расчета размера холста под повернутую фигуру
const getRotatedBounds = (width: number, height: number, strokeWidth: number, rotation: number) => {
  if (!rotation) {
    return { width, height, x: 0, y: 0 }
  }
  
  const rad = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  
  const newW = width * cos + height * sin
  const newH = width * sin + height * cos
  
  const padW = strokeWidth * 2
  const padH = strokeWidth * 2
  
  return {
    width: Math.ceil(newW + padW),
    height: Math.ceil(newH + padH),
    x: (newW - width) / 2 + padW / 2,
    y: (newH - height) / 2 + padH / 2
  }
}

export const generateRectSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { fill = '#3b82f6', stroke = '#1f2937', strokeWidth = 2, rotation = 0, opacity = 1 } = settings
  
  const bounds = getRotatedBounds(width, height, strokeWidth, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  const x = cx - width / 2
  const y = cy - height / 2

  // Добавлен атрибут opacity="${opacity}"
  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>
  </svg>`
}

export const generateTriangleSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { fill = '#ef4444', stroke = '#1f2937', strokeWidth = 2, rotation = 0, opacity = 1 } = settings
  
  const bounds = getRotatedBounds(width, height, strokeWidth, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  
  const dx = cx - width / 2
  const dy = cy - height / 2
  
  const p1 = `${width/2 + dx},${dy}`
  const p2 = `${width + dx},${height + dy}`
  const p3 = `${dx},${height + dy}`

  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${p1} ${p2} ${p3}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>
  </svg>`
}

export const generateCircleSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { fill = '#22c55e', stroke = '#1f2937', strokeWidth = 2, rotation = 0, opacity = 1 } = settings
  
  const bounds = getRotatedBounds(width, height, strokeWidth, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  const r = Math.min(width, height) / 2

  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>
  </svg>`
}

export const generateSemicircleSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { fill = '#f59e0b', stroke = '#1f2937', strokeWidth = 2, rotation = 0, opacity = 1 } = settings
  
  const bounds = getRotatedBounds(width, height, strokeWidth, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  
  const dx = cx - width / 2
  const dy = cy - height / 2

  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <path d="M ${dx},${height + dy} A ${width/2},${height/2} 0 0,1 ${width + dx},${height + dy} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>
  </svg>`
}

export const generateLineSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { stroke = '#8b5cf6', strokeWidth = 2, rotation = 0, opacity = 1 } = settings
  
  const bounds = getRotatedBounds(width, height, strokeWidth, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2
  
  const dx = cx - width / 2
  const dy = cy - height / 2

  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${dx}" y1="${height/2 + dy}" x2="${width + dx}" y2="${height/2 + dy}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>
  </svg>`
}

export const generateTextSVG = (width: number, height: number, settings: ShapeSettings = {}) => {
  const { fill = '#ffffff', rotation = 0, opacity = 1, text = 'Текст', fontSize = 14, fontFamily = 'sans-serif', fontWeight = 'normal' } = settings
  
  const bounds = getRotatedBounds(width, height, 0, rotation)
  const cx = bounds.width / 2
  const cy = bounds.height / 2

  return `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cx}" y="${cy}" dominant-baseline="middle" text-anchor="middle" fill="${fill}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})">${text}</text>
  </svg>`
}

// === ТИПЫ И КОНФИГУРАЦИЯ СЛОЁВ ===
export type ElementCategory = 
  | 'background' | 'ground' | 'infrastructure' | 'gate' | 'vehicle' | 'human' | 'zone' | 'decoration'

export interface LayerConfig {
  zIndex: number
  isObstacle: boolean
  layer: 'background' | 'ground' | 'objects' | 'actors' | 'zones'
  collidable?: boolean
  selectable?: boolean
  repeatX?: boolean
}

export interface LibraryItem {
  id: string
  name: string
  type: 'svg' | 'rect' | 'traffic_road'
  category: ElementCategory
  width: number
  height: number
  svg?: string
  preview: string
  defaultSettings?: Record<string, any>
  layerConfig: LayerConfig
  tags?: string[]
  description?: string
  updateSVG?: (width: number, height: number, params?: any) => string
}

// [ИСПРАВЛЕНО] Карта с известными литеральными ключами: обращение
// LAYER_CONFIG.BACKGROUND теперь даёт LayerConfig (без undefined),
// а динамический доступ по строке (useSimulatorCore) — LayerConfig | undefined,
// что корректно: там уже стоят guard'ы (layerConfig && ...).
export interface LayerConfigMap {
  BACKGROUND: LayerConfig
  GROUND: LayerConfig
  DECORATION: LayerConfig
  GATE: LayerConfig
  ACTOR: LayerConfig
  ZONE: LayerConfig
  // Динамический доступ по строке остаётся валидным
  [key: string]: LayerConfig | undefined
}

export const LAYER_CONFIG: LayerConfigMap = {
  BACKGROUND: { zIndex: 0, isObstacle: false, layer: 'background', selectable: false },
  GROUND: { zIndex: 10, isObstacle: false, layer: 'ground', selectable: true },
  DECORATION: { zIndex: 15, isObstacle: true, layer: 'objects', selectable: true, collidable: true },
  GATE: { zIndex: 25, isObstacle: true, layer: 'objects', selectable: true, collidable: true },
  ACTOR: { zIndex: 30, isObstacle: true, layer: 'actors', selectable: true, collidable: true },
  ZONE: { zIndex: 5, isObstacle: false, layer: 'zones', selectable: true },
}

// === ПРОЧИЕ SVG (сокращённо) ===
const SVG = {
  sky: () => `<svg viewBox="0 0 1920 400" xmlns="http://www.w3.org/2000/svg"><rect width="1920" height="400" fill="#87CEEB"/></svg>`,
  building: () => `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="300" fill="#94a3b8"/></svg>`,
  fence: () => `<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="80" fill="#57534e"/></svg>`,
  tree: () => `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><rect x="40" y="80" width="20" height="60" fill="#78350f"/><ellipse cx="50" cy="50" rx="45" ry="55" fill="#166534"/></svg>`,
  bush: () => `<svg viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg"><ellipse cx="40" cy="45" rx="40" ry="10" fill="#14532d"/><circle cx="20" cy="30" r="18" fill="#15803d"/><circle cx="50" cy="28" r="20" fill="#166534"/></svg>`,
  asphalt: () => `<svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="200" fill="#374151"/></svg>`,
  zebra: () => `<svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="5" width="35" height="50" fill="#fff"/><rect x="45" y="5" width="35" height="50" fill="#fff"/><rect x="90" y="5" width="35" height="50" fill="#fff"/><rect x="135" y="5" width="35" height="50" fill="#fff"/></svg>`,
  car: () => `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="60" fill="#ef4444"/></svg>`, // Упрощено для примера
  human: () => `<svg viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="80" fill="#3b82f6"/></svg>`, // Упрощено для примера
  spawnZone: (type: 'car' | 'person') => `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="28" fill="${type === 'car' ? '#3b82f6' : '#22c55e'}" opacity="0.3"/></svg>`,
}

// === БИБЛИОТЕЧНЫЕ ГРУППЫ ===
export const LIBRARY_GROUPS: Array<{
  name: string
  description: string
  items: LibraryItem[]
}> = [
  {
    name: 'Окружение',
    description: 'Фоновые элементы и декорации',
    items: [
      { id: 'sky', name: 'Небо', type: 'svg', category: 'background', width: 1920, height: 400, svg: SVG.sky(), preview: SVG.sky(), layerConfig: LAYER_CONFIG.BACKGROUND },
      { id: 'building', name: 'Здание', type: 'svg', category: 'background', width: 200, height: 300, svg: SVG.building(), preview: SVG.building(), layerConfig: LAYER_CONFIG.BACKGROUND },
      { id: 'tree', name: 'Дерево', type: 'svg', category: 'decoration', width: 100, height: 140, svg: SVG.tree(), preview: SVG.tree(), layerConfig: LAYER_CONFIG.DECORATION },
      { id: 'bush', name: 'Куст', type: 'svg', category: 'decoration', width: 80, height: 50, svg: SVG.bush(), preview: SVG.bush(), layerConfig: LAYER_CONFIG.DECORATION },
      { id: 'fence', name: 'Забор', type: 'svg', category: 'decoration', width: 200, height: 80, svg: SVG.fence(), preview: SVG.fence(), layerConfig: { ...LAYER_CONFIG.DECORATION, repeatX: true } },
    ],
  },
  {
    name: 'Дороги',
    description: 'Покрытия и разметка',
    items: [
      { id: 'asphalt', name: 'Асфальт', type: 'svg', category: 'ground', width: 800, height: 200, svg: SVG.asphalt(), preview: SVG.asphalt(), layerConfig: LAYER_CONFIG.GROUND },
      { id: 'zebra', name: 'Пешеходный переход', type: 'svg', category: 'ground', width: 200, height: 60, svg: SVG.zebra(), preview: SVG.zebra(), layerConfig: { ...LAYER_CONFIG.GROUND, zIndex: 11 } },
      // 👇 НОВЫЙ ЭЛЕМЕНТ ДОРОГА С ТРАФИКОМ
      {
        id: 'traffic_road',
        name: 'Дорога с трафиком',
        type: 'traffic_road',
        category: 'infrastructure',
        width: 400,
        height: 120,
        preview: `<svg viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="30" fill="#4b5563"/>
                    <line x1="0" y1="15" x2="100" y2="15" stroke="#fbbf24" stroke-width="1" stroke-dasharray="8,6"/>
                  </svg>`,
        layerConfig: { ...LAYER_CONFIG.GROUND, zIndex: 12, isObstacle: false },
        defaultSettings: {
          spawnRate: 3,    // машин в секунду
          minSpeed: 40,
          maxSpeed: 80
        },
        tags: ['дорога', 'трафик']
      }
    ]
  },
  {
    name: 'Ворота и КПП',
    description: 'Ворота и калитка',
    items: [
      {
        id: 'sliding_gate',
        name: 'Ворота откатные',
        type: 'svg',
        category: 'gate',
        width: 320,
        height: 120,
        svg: generateSlidingGateSVG(320, 120),
        preview: generateSlidingGateSVG(100, 50),
        layerConfig: LAYER_CONFIG.GATE,
        defaultSettings: { isOpen: false, gateType: 'sliding', openDuration: 2, closeDuration: 2 },
        tags: ['ворота'],
        updateSVG: generateSlidingGateSVG,
      },
      {
        id: 'wicket',
        name: 'Калитка',
        type: 'svg',
        category: 'gate',
        width: 80,
        height: 120,
        svg: generateWicketSVG(80, 120),
        preview: generateWicketSVG(40, 60),
        layerConfig: LAYER_CONFIG.GATE,
        defaultSettings: { isOpen: false, gateType: 'wicket' },
        tags: ['калитка'],
        updateSVG: generateWicketSVG,
      },
    ],
  },
  {
    name: 'Транспорт',
    description: 'Статичные транспортные средства',
    items: [
      { id: 'car', name: 'Легковой автомобиль', type: 'svg', category: 'vehicle', width: 120, height: 60, svg: SVG.car(), preview: SVG.car(), layerConfig: LAYER_CONFIG.ACTOR },
    ],
  },
  {
    name: 'Люди',
    description: 'Персонажи',
    items: [
      { id: 'human', name: 'Пешеход', type: 'svg', category: 'human', width: 40, height: 80, svg: SVG.human(), preview: SVG.human(), layerConfig: LAYER_CONFIG.ACTOR },
    ],
  },
  {
    name: 'Зоны',
    description: 'Логические зоны',
    items: [
      { id: 'spawn_car', name: 'Спавн машин', type: 'rect', category: 'zone', width: 60, height: 60, preview: SVG.spawnZone('car'), layerConfig: LAYER_CONFIG.ZONE, defaultSettings: { spawnType: 'car', rate: 3000, maxCount: 10 } },
      { id: 'spawn_person', name: 'Спавн людей', type: 'rect', category: 'zone', width: 60, height: 60, preview: SVG.spawnZone('person'), layerConfig: LAYER_CONFIG.ZONE, defaultSettings: { spawnType: 'person', rate: 5000, maxCount: 20 } },
    ],
  },
  // === ГРУППА: ГЕОМЕТРИЧЕСКИЕ ФИГУРЫ ===
  {
    name: 'Фигуры',
    description: 'Простые геометрические примитивы',
    items: [
      {
        id: 'rect',
        name: 'Прямоугольник',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 100,
        svg: generateRectSVG(100, 100),
        preview: generateRectSVG(80, 80),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { fill: '#3b82f6', stroke: '#1f2937', strokeWidth: 2, rotation: 0 },
        tags: ['фигура', 'прямоугольник'],
        updateSVG: generateRectSVG,
      },
      {
        id: 'triangle',
        name: 'Треугольник',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 100,
        svg: generateTriangleSVG(100, 100),
        preview: generateTriangleSVG(80, 80),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { fill: '#ef4444', stroke: '#1f2937', strokeWidth: 2, rotation: 0 },
        tags: ['фигура', 'треугольник'],
        updateSVG: generateTriangleSVG,
      },
      {
        id: 'circle',
        name: 'Круг',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 100,
        svg: generateCircleSVG(100, 100),
        preview: generateCircleSVG(80, 80),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { fill: '#22c55e', stroke: '#1f2937', strokeWidth: 2, rotation: 0 },
        tags: ['фигура', 'круг'],
        updateSVG: generateCircleSVG,
      },
      {
        id: 'semicircle',
        name: 'Полукруг',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 100,
        svg: generateSemicircleSVG(100, 100),
        preview: generateSemicircleSVG(80, 80),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { fill: '#f59e0b', stroke: '#1f2937', strokeWidth: 2, rotation: 0 },
        tags: ['фигура', 'полукруг'],
        updateSVG: generateSemicircleSVG,
      },
      {
        id: 'line',
        name: 'Линия',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 100,
        svg: generateLineSVG(100, 100),
        preview: generateLineSVG(80, 80),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { stroke: '#8b5cf6', strokeWidth: 2, rotation: 0 },
        tags: ['фигура', 'линия'],
        updateSVG: generateLineSVG,
      },
      {
        id: 'text',
        name: 'Текст',
        type: 'svg',
        category: 'decoration',
        width: 100,
        height: 50,
        svg: generateTextSVG(100, 50, { text: 'Текст' }),
        preview: generateTextSVG(80, 40, { text: 'Текст' }),
        layerConfig: LAYER_CONFIG.DECORATION,
        defaultSettings: { fill: '#ffffff', text: 'Текст', fontSize: 14, fontFamily: 'sans-serif', fontWeight: 'normal', rotation: 0 },
        tags: ['фигура', 'текст'],
        updateSVG: generateTextSVG,
      },
    ],
  },
]

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
export const getLibraryItem = (id: string): LibraryItem | undefined => {
  for (const group of LIBRARY_GROUPS) {
    const item = group.items.find(i => i.id === id)
    if (item) return item
  }
  return undefined
}

export const getItemsByCategory = (category: ElementCategory): LibraryItem[] => {
  const items: LibraryItem[] = []
  for (const group of LIBRARY_GROUPS) {
    items.push(...group.items.filter(i => i.category === category))
  }
  return items
}

export const getDefaultSize = (id: string): { width: number; height: number } => {
  const item = getLibraryItem(id)
  return item ? { width: item.width, height: item.height } : { width: 100, height: 100 }
}

export const isObstacle = (itemId: string): boolean => {
  const item = getLibraryItem(itemId)
  return item?.layerConfig.isObstacle ?? false
}