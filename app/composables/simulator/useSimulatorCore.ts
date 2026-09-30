// app/composables/simulator/useSimulatorCore.ts
// Назначение: ядро симулятора — загрузка сцены, фиксированные координаты,
// нормализация элементов, анимация ворот (GSAP) и их звук.
//
// [РЕФАКТОРИНГ — финальный пункт анти-утечечного плана]:
//  1. [ИСПРАВЛЕНО] loadScene() убивает все твины ворот старой сцены и глушит
//     мотор. Раньше твины переживали замену сцены: мутировали settings
//     осиротевших элементов и в onComplete дёргали звуки несуществующих ворот.
//  2. [ИСПРАВЛЕНО] onComplete: wicket-slam — только если калитка ещё на сцене;
//     stopPool('gate-active') — ВСЕГДА (мотор зациклен, обязан глушиться).
//  3. [ИСПРАВЛЕНО] onScopeDispose: добавлен resetPool('gate-active') — kill
//     твина НЕ вызывает onComplete, поэтому при unmount симулятора зацикленный
//     мотор продолжал играть вечно.
//  4. [ДОБАВЛЕНО] killAllGateTweens() экспортируется — для явного сброса
//     из вызывающего кода (перезапуск симуляции).

import { ref, type Ref, onScopeDispose } from 'vue'
import gsap from 'gsap'
import { useAudioEngine } from '~/composables/useAudioEngine'
import {
  USE_MANUAL_COORDS, MANUAL_X_PERSON, MANUAL_Y_PERSON, MANUAL_X_CAR, MANUAL_Y_CAR,
  PERSON_VERTICAL_OFFSET, PERSON_HEIGHT, CAR_HEIGHT, PERSON_WIDTH, CAR_WIDTH,
  GATES_LIST
} from '~/utils/simulatorConstants'
import { LAYER_CONFIG } from '~/constants/library'
import { generateSlidingGateSVG, generateWicketSVG } from '~/constants/library'
import type { SceneElement } from '~/types/simulator'

export function useSimulatorCore(simElements: Ref<SceneElement[]>) {
  // Аудио-движок внутри setup-контекста (безопасно для SSR)
  const audio = useAudioEngine()

  const fixedXPerson = ref(0)
  const fixedYPerson = ref(0)
  const fixedXCar = ref(0)
  const fixedYCar = ref(0)

  // Реестр активных твинов ворот: id ворот -> tween.
  // Гарантирует: один твин на ворота, kill при перезапуске анимации,
  // полная зачистка при смене сцены и unmount.
  const gateTweens = new Map<string, gsap.core.Tween>()

  // Убить все твины ворот (без вызова onComplete у каждого — так работает GSAP).
  // Вызывается при смене сцены, unmount и ручном сбросе.
  const killAllGateTweens = () => {
    gateTweens.forEach(tween => tween.kill())
    gateTweens.clear()
  }

  // Автоматическая зачистка при размонтировании.
  // [ИСПРАВЛЕНО] добавлен resetPool('gate-active'): kill твина не триггерит
  // onComplete, а мотор ворот — Зацикленный звук; без сброса он играл вечно
  // после unmount симулятора.
  onScopeDispose(() => {
    killAllGateTweens()
    audio.resetPool('gate-active')
  })

  const initManualCoords = () => {
    if (USE_MANUAL_COORDS) {
      fixedYPerson.value = MANUAL_Y_PERSON + PERSON_VERTICAL_OFFSET
      fixedXPerson.value = MANUAL_X_PERSON
      fixedYCar.value = MANUAL_Y_CAR
      fixedXCar.value = MANUAL_X_CAR
      console.log(`[MANUAL] Координаты инициализированы: люди (${fixedXPerson.value}, ${fixedYPerson.value}), машины (${fixedXCar.value}, ${fixedYCar.value})`)
    }
  }
  initManualCoords()

  const updateFixedCoordinates = (cfg: any) => {
    if (USE_MANUAL_COORDS) {
      initManualCoords()
      return
    }
    const personGate = simElements.value.find(el => String(el.id) === cfg.personGateId)
    if (personGate && personGate.settings?.gateType === 'wicket') {
      const gateGroundY = personGate.y + personGate.height
      fixedYPerson.value = gateGroundY - PERSON_HEIGHT + PERSON_VERTICAL_OFFSET
      fixedXPerson.value = personGate.x + personGate.width / 2 - PERSON_WIDTH / 2
    }
    const carGate = simElements.value.find(el => String(el.id) === cfg.carGateId)
    if (carGate) {
      const gateGroundY = carGate.y + carGate.height
      fixedYCar.value = gateGroundY - CAR_HEIGHT
      fixedXCar.value = carGate.x + carGate.width / 2 - CAR_WIDTH / 2
    }
  }

  const normalizeElement = (el: any): SceneElement => {
    const category = el.category || 'decoration'
    let correctType = el.type || el._type
    let calculatedZIndex = el.zIndex
    const layerMap: Record<string, string> = {
      'background': 'BACKGROUND', 'ground': 'GROUND', 'decoration': 'DECORATION',
      'building': 'DECORATION', 'infrastructure': 'DECORATION', 'gate': 'GATE',
      'barrier': 'GATE', 'vehicle': 'ACTOR', 'human': 'ACTOR', 'zone': 'ZONE'
    }
    const layerKey = layerMap[category] || 'DECORATION'
    const layerConfig = LAYER_CONFIG[layerKey]
    const settings = el.settings ? { ...el.settings } : {}

    if (category === 'gate' || category === 'barrier') {
      calculatedZIndex = 300
      correctType = 'gate'
      const isWicket = settings.gateType === 'wicket' || (el.width && el.width <= 60)
      if (settings.openDuration === undefined) settings.openDuration = isWicket ? 0.5 : 2
      if (settings.closeDuration === undefined) settings.closeDuration = isWicket ? 0.5 : 2
      if (settings.isOpen === undefined) settings.isOpen = false
      if (isWicket) {
        settings._animScaleX = settings.isOpen ? 0.1 : 1
      } else {
        settings._animX = settings.isOpen ? -el.width : 0
      }
      settings.isAnimating = false
      settings.isStopped = false
    } else if (category === 'zone') {
      correctType = 'zone'
      if (layerConfig && (!el.zIndex || el.type === 'zone')) calculatedZIndex = layerConfig.zIndex
    } else if (category === 'human' || category === 'vehicle') {
      correctType = 'actor'
      if (!el.zIndex) calculatedZIndex = layerConfig?.zIndex || 1
    } else {
      correctType = 'element'
      if (layerConfig && !el.zIndex) calculatedZIndex = layerConfig.zIndex
    }

    let newEl: SceneElement = {
      ...el,
      type: correctType,
      zIndex: calculatedZIndex,
      velocity: 0,
      rotation: el.rotation || 0,
      settings: settings
    }

    if ((category === 'gate' || category === 'barrier') && el.asset?.type === 'svg') {
      const gateType = newEl.settings?.gateType || 'sliding'
      const gateParams = newEl.settings?.gateParams || {}
      const width = el.width
      const height = el.height
      let newSVG = ''
      if (gateType === 'sliding') newSVG = generateSlidingGateSVG(width, height, gateParams)
      else if (gateType === 'wicket') newSVG = generateWicketSVG(width, height, gateParams)
      if (newSVG) newEl.asset = { ...el.asset, svg: newSVG, content: newSVG }
    }
    return newEl
  }

  const loadScene = (config: any) => {
    // [ИСПРАВЛЕНО] смена сцены: сначала зачистка старой.
    // 1) kill всех твинов — иначе они мутируют settings осиротевших элементов
    //    и дёргают звуки несуществующих ворот;
    // 2) resetPool('gate-active') — kill не вызывает onComplete, а мотор
    //    зациклен: без сброса звук играл бы до конца таймлайна и дольше.
    killAllGateTweens()
    audio.resetPool('gate-active')

    if (config && config.elements) {
      simElements.value = config.elements.map((el: any) => normalizeElement(el))
      console.log(`[loadScene] Загружено элементов: ${simElements.value.length}, из них ворот: ${simElements.value.filter(el => el.category === 'gate' || el.category === 'barrier').length}`)
    } else {
      simElements.value = []
      console.warn('[loadScene] Нет elements в конфиге')
    }
  }

  const getElementStyle = (el: SceneElement, enableRotation: boolean) => ({
    position: 'absolute',
    left: `${el.x}px`,
    top: `${el.y}px`,
    width: `${el.width}px`,
    height: `${el.height}px`,
    zIndex: el.zIndex || 1,
    transform: enableRotation ? `rotate(${(el.rotation || 0) * 180 / Math.PI}deg)` : 'none'
  })

  const getLabelStyle = (el: SceneElement) => {
    const x = el.x + el.width / 2
    const y = el.y - 47
    return {
      left: `${x}px`, top: `${y}px`, transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.7)', color: 'white', fontSize: '11px',
      fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px',
      whiteSpace: 'nowrap', fontFamily: 'monospace', zIndex: 1000, pointerEvents: 'none'
    }
  }

  const getGateStyle = (el: SceneElement) => {
    const s = el.settings || {}
    return {
      transform: `translateX(${s._animX || 0}px) scaleX(${s._animScaleX ?? 1})`,
      transformOrigin: 'left center'
    }
  }

  const startGateAnimation = (el: SceneElement, targetOpen: boolean) => {
    const gateId = String(el.id)
    if (!el.settings) el.settings = {}
    gateTweens.get(gateId)?.kill()
    el.settings.isAnimating = true
    el.settings.isStopped = false

    const isWicket = el.settings?.gateType === 'wicket' || (el.width && el.width <= 60)

    if (isWicket) {
      if (targetOpen) {
        audio.playFromPool('wicket-sound', 'wicket-lock', 0.6)
      }
    } else {
      audio.resetPool('gate-active')
      audio.playFromPool('gate-active', 'gate-motor', 0.6)
    }

    let duration = (targetOpen ? (el.settings.openDuration ?? 2) : (el.settings.closeDuration ?? 2))

    const vars: gsap.TweenVars = {
      ease: "none",
      onComplete: () => {
        el.settings.isOpen = targetOpen
        el.settings.isAnimating = false
        gateTweens.delete(gateId)

        if (isWicket) {
          // [ИСПРАВЛЕНО] звук удара — только если калитка ещё на сцене
          // (её могли удалить/заменить сцену во время анимации)
          const stillExists = simElements.value.some(g => String(g.id) === gateId)
          if (!targetOpen && stillExists) {
            audio.playFromPool('wicket-sound', 'wicket-slam', 0.8)
          }
        } else {
          // Мотор глушим ВСЕГДА — звук зацикленный
          audio.stopPool('gate-active')
        }
      }
    }

    if (isWicket) {
      const currScale = el.settings._animScaleX ?? 1
      const targetScale = targetOpen ? 0.1 : 1
      const totalDistance = 0.9
      const remainingDistance = Math.abs(targetScale - currScale)
      if (remainingDistance < totalDistance && remainingDistance > 0) {
        duration = duration * (remainingDistance / totalDistance)
      }
      vars._animScaleX = targetScale
    } else {
      const currX = el.settings._animX || 0
      const targetX = targetOpen ? -el.width : 0
      const totalDistance = el.width
      const remainingDistance = Math.abs(targetX - currX)
      if (remainingDistance < totalDistance && remainingDistance > 0) {
        duration = duration * (remainingDistance / totalDistance)
      }
      vars._animX = targetX
    }
    vars.duration = duration

    const tween = gsap.to(el.settings, vars)
    gateTweens.set(gateId, tween)
  }

  const handleGateClick = (el: SceneElement) => {
    if (!GATES_LIST.includes(el.category || '')) return false
    if (!el.settings) el.settings = {}
    const name = (el.name || '').toLowerCase()
    if (!el.settings.gateType) {
      if (name.includes('ворота') || name.includes('шлагбаум')) el.settings.gateType = 'sliding'
      else if (name.includes('калитка') || name.includes('wicket')) el.settings.gateType = 'wicket'
      else el.settings.gateType = (el.width && el.width > 60) ? 'sliding' : 'wicket'
    }

    if (el.settings.isStopped) {
      startGateAnimation(el, !el.settings.isOpen)
      return true
    }
    if (el.settings.isAnimating) return true
    startGateAnimation(el, !el.settings.isOpen)
    return true
  }

  const openGate = (el: SceneElement): boolean => {
    if (!GATES_LIST.includes(el.category || '')) return false
    if (!el.settings) el.settings = {}
    if (el.settings.isAnimating) return false
    startGateAnimation(el, true)
    return true
  }

  const closeGate = (el: SceneElement): boolean => {
    if (!GATES_LIST.includes(el.category || '')) return false
    if (!el.settings) el.settings = {}
    if (el.settings.isAnimating) return false
    startGateAnimation(el, false)
    return true
  }

  const stopGate = (el: SceneElement): boolean => {
    if (!GATES_LIST.includes(el.category || '')) return false
    const isWicket = el.settings?.gateType === 'wicket' || (el.width && el.width <= 60)
    const gateId = String(el.id)
    const tween = gateTweens.get(gateId)
    if (tween && tween.isActive()) {
      tween.pause()
      el.settings.isAnimating = false
      el.settings.isStopped = true
      if (!isWicket) {
        audio.stopPool('gate-active')
      }
    }
    return true
  }

  const openGateWithSound = (gate: SceneElement): boolean => {
    if (!gate.settings) gate.settings = {}
    const isWicket = gate.settings.gateType === 'wicket' || (gate.width && gate.width <= 60)
    if (isWicket) {
      audio.playFromPool('wicket-sound', 'wicket-creak', 0.6)
    }
    return openGate(gate)
  }

  const closeGateWithSound = (gate: SceneElement): boolean => {
    if (!gate.settings) gate.settings = {}
    const isWicket = gate.settings.gateType === 'wicket' || (gate.width && gate.width <= 60)
    if (isWicket) {
      audio.playFromPool('wicket-sound', 'wicket-creak', 0.6)
    }
    return closeGate(gate)
  }

  return {
    fixedXPerson,
    fixedYPerson,
    fixedXCar,
    fixedYCar,
    updateFixedCoordinates,
    loadScene,
    getElementStyle,
    getLabelStyle,
    getGateStyle,
    handleGateClick,
    openGate,
    closeGate,
    stopGate,
    openGateWithSound,
    closeGateWithSound,
    initManualCoords,
    killAllGateTweens,
    gateTweens,
  }
}