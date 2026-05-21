// composables/simulator/useSimulatorUI.ts
import { type Ref } from 'vue'
import type { SceneElement } from '~/types/simulator'
import { useAudioEngine } from '~/composables/useAudioEngine'

/**
 * Интерфейс активного переговорника.
 * Хранит состояние "включенного" переговорника для отображения меток агентов.
 */
export interface ActiveIntercom {
  gateId: string                             // ID ворот, к которым привязан переговорник
  x: number                                  // X координата центра переговорника (или ворот)
  y: number                                  // Y координата центра
  range: number                              // Радиус действия (в пикселях)
  direction: 'enter' | 'exit'                // Направление потока (вход или выход с территории)
  travelMode: 'walk' | 'car'                 // Тип движения (пешеходы или автомобили)
  territoryPolygon?: { x: number; y: number }[] // Полигон зоны (для точного мэтчинга сложных территорий)
}

export function useSimulatorUI(
  simElements: Ref<SceneElement[]>,
  openGateWithSound: (gate: SceneElement) => boolean,
  closeGateWithSound: (gate: SceneElement) => boolean,
  stopGate: (gate: SceneElement) => void,
  activeIntercoms: Ref<Set<ActiveIntercom>>,
  activeCallButtonId: Ref<string | null>
) {
  // Инициализируем аудио движок внутри функции (безопасно для SSR)
  const audio = useAudioEngine()

  /**
   * Вспомогательная функция: Получить полигон территории для ворот.
   * Используется для ограничения зоны видимости меток "выходящих" пешеходов.
   * Приоритет поиска:
   * 1. Прямой полигон у ворот (zonePolygon).
   * 2. Прямоугольная зона у ворот (territoryRect).
   * 3. Поиск элемента типа 'zone' на сцене, привязанного к этим воротам.
   */
  const getTerritoryPolygonForGate = (gate: SceneElement): { x: number; y: number }[] | undefined => {
    if (gate.zonePolygon && gate.zonePolygon.length) return gate.zonePolygon
    if (gate.territoryRect) {
      const r = gate.territoryRect
      return [
        { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height },
      ]
    }
    const zoneElement = simElements.value.find(el => 
      el.type === 'zone' && String(el.belongsToGateId) === String(gate.id)
    )
    if (zoneElement && zoneElement.zonePolygon && zoneElement.zonePolygon.length) {
      return zoneElement.zonePolygon
    }
    return undefined
  }

  /**
   * Обработчик клика по элементам управления (кнопки, тумблеры).
   */
  const onControlClick = (ctrl: any, panel: any, panelPosition: { x: number, y: number }) => {
    const actionType = ctrl.settings?.actionType
    const targetGateId = ctrl.settings?.targetGateId

    // [НАСТРОЙКА] Громкость звука клика по UI
    audio.playUI(0.8)

    // --- ОБРАБОТКА ПЕРЕГОВОРНИКА (Кнопка 'Call') ---
    if (actionType === 'call') {
      if (!targetGateId) return

      // ВАЖНО: Vue Ref с Set не реагирует на .add() или .delete().
      // Чтобы интерфейс обновился, нужно присвоить НОВЫЙ Set в .value.
      
      // Логика Toggle: Если нажали ту же кнопку -> выключаем
      if (activeCallButtonId.value === ctrl.id) {
        activeIntercoms.value = new Set() // Реактивное обновление (очистка)
        activeCallButtonId.value = null
        return
      }

      // Иначе -> включаем новый
      const gate = simElements.value.find(g => String(g.id) === targetGateId)
      if (!gate) return

      const centerX = gate.x + gate.width / 2
      const centerY = gate.y + gate.height / 2
      
      // [НАСТРОЙКА] Радиус действия переговорника.
      // Берется из настроек контрола (range), по умолчанию 150 пикселей.
      const range = ctrl.settings?.range ?? 150
      
      // Определение направления (вход/выход). По умолчанию 'enter'.
      const direction = ctrl.settings?.intercomSide === 'exit' ? 'exit' : 'enter'
      
      // Автоопределение типа (калитка = пеший, ворота = авто)
      // [НАСТРОЙКА] Порог ширины для автоматического определения типа: 60px.
      // Если ширина <= 60, считается калиткой (walk).
      const isWicket = gate.settings?.gateType === 'wicket' || (gate.width && gate.width <= 60)
      const travelMode = isWicket ? 'walk' : 'car'

      // Полигон нужен только для внутренних переговорников калиток (для точного мэтчинга зоны выхода)
      let territoryPolygon: { x: number; y: number }[] | undefined
      if (direction === 'exit' && travelMode === 'walk') {
        territoryPolygon = getTerritoryPolygonForGate(gate)
      }

      // Создаем объект данных переговорника
      const newIntercom: ActiveIntercom = {
        gateId: targetGateId, x: centerX, y: centerY, range, 
        direction, travelMode, territoryPolygon
      }

      // Реактивное обновление: создаем новый Set
      const newSet = new Set<ActiveIntercom>()
      newSet.add(newIntercom)
      activeIntercoms.value = newSet 
      
      activeCallButtonId.value = ctrl.id
      return
    }

    // --- ОБРАБОТКА ВОРОТ (Открыть/Закрыть/Стоп) ---
    if (!actionType) return
    let targetGate: SceneElement | undefined
    
    // Поиск целевых ворот
    if (targetGateId) {
      // Если явно указан ID ворот
      targetGate = simElements.value.find(g => String(g.id) === targetGateId)
    } else {
      // Иначе ищем по типу (gate/wicket) среди всех ворот сцены
      const gates = simElements.value.filter(g => g.category === 'gate' || g.category === 'barrier')
      if (actionType.includes('gate')) targetGate = gates.find(g => g.settings?.gateType !== 'wicket')
      else if (actionType.includes('wicket')) targetGate = gates.find(g => g.settings?.gateType === 'wicket')
      else targetGate = gates[0] // Если тип не указан, берем первые попавшиеся
    }
    
    if (!targetGate) return
    
    // Выполнение действия
    switch (actionType) {
      case 'gate-open': 
      case 'wicket-open': 
        openGateWithSound(targetGate); 
        break
      case 'gate-close': 
      case 'wicket-close': 
        closeGateWithSound(targetGate); 
        break
      case 'gate-stop': 
        stopGate(targetGate); 
        break
    }
  }

  // --- Функции стилизации (преобразование настроек контрола в CSS-стили) ---

  const getPanelStyle = (panel: any) => ({
    left: `${panel.x ?? 0}px`, top: `${panel.y ?? 0}px`,
    width: `${panel.width ?? 200}px`, height: `${panel.height ?? 150}px`,
    backgroundColor: '#2d3748', border: '1px solid #4a5568', borderRadius: '6px',
    zIndex: 9999, display: 'flex', flexDirection: 'column',
  })

  const getControlStyle = (ctrl: any) => {
    const s = ctrl.settings || {}
    // [НАСТРОЙКА] Высота кнопки по умолчанию: 40px
    const b = s.height || 40
    const lb = s.labelPosition === 'bottom' && s.label
    return {
      width: `${s.width || 60}px`, minHeight: lb ? `${b}px` : undefined,
      height: lb ? undefined : `${b}px`, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', cursor: 'pointer', margin: '4px',
    }
  }

  const getControlContentStyle = (ctrl: any) => {
    const s = ctrl.settings || {}
    const isGate = s.actionType?.includes('gate') || s.actionType?.includes('wicket')
    // Для ворот стили применяются особые (фон, тени)
    if (isGate) {
      return { width: '100%', height: `${s.height || 40}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: `${s.borderRadius || 4}px`, boxShadow: 'none', border: 'none' }
    }
    // Обычная кнопка с эффектом вдавленности
    const cs = 'inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -2px 5px rgba(0,0,0,0.4)'
    const gs = s.glow ? `0 0 8px ${s.color}, ${cs}` : cs
    return {
      width: '100%', height: `${s.height || 40}px`, display: 'flex', alignItems: 'center', justifyContent: s.labelAlign || 'center',
      backgroundColor: s.color || '#4b5563', borderRadius: `${s.borderRadius || 4}px`,
      boxShadow: gs, border: '1px solid rgba(255, 255, 255, 0.15)',
    }
  }

  const getGateInnerStyle = (ctrl: any) => ({ backgroundColor: ctrl.settings?.color || '#4b5563' })
  
  const getControlLabelStyle = (ctrl: any) => {
    const s = ctrl.settings || {}
    return {
      marginTop: `${s.labelMarginTop || 4}px`, fontSize: `${s.fontSize || 10}px`, color: s.textColor || '#ffffff',
      textAlign: s.labelAlign || 'center', backgroundColor: s.labelBg || 'transparent', padding: s.labelPadding || '2px 4px',
      borderRadius: s.labelBorderRadius || '2px', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%',
    }
  }

  return {
    onControlClick, getPanelStyle, getControlStyle, getControlContentStyle, getGateInnerStyle, getControlLabelStyle,
  }
}