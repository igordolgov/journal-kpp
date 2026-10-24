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
// [№17-ПРЫЖОК] интерполяция рендера теперь и в ШАБЛОННЫХ стилях: при любом
// структурном ререндере (спавн/деспавн/метки/команды) Vue переписывал
// transform агентов ТЕКУЩЕЙ физпозицией, а paint-мост пишет интерполированную
// (№15) — патч выставлял агента вперёд на (1-альфа)*шаг (до 2-3мм на неровных
// кадрах) и paint возвращал обратно. paintCoord делает обе записи одинаковыми:
// патч пишет ту же строку, что уже стоит в DOM, и позиция не меняется вовсе.
import { paintCoord } from '~/utils/simulatorPaint'
// [№21-КАЛИТКА-В-ЖИЗНИ] таймаут захлопывания. [№24-РУЧКА] WICKET_AJAR_SCALE
// (приоткрытие полотна) больше не используется: разблокировка показывает
// только ручку (CSS), полотно открывают люди.
import { WICKET_AJAR_TIMEOUT_S } from '~/utils/gateFlow'
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

  // [№22-КНОПКИ] цель активного твина ворот: open=true — открывается
  // (полно или приоткрывается), open=false — закрывается. Нужен, чтобы
  // кнопки калитки работали В ЛЮБОЙ фазе анимации: закрывающуюся можно
  // перехватить (приоткрыть), открывающуюся — захлопнуть.
  const gateTweenTarget = new Map<string, { open: boolean; ajar: boolean }>()

  // Убить все твины ворот (без вызова onComplete у каждого — так работает GSAP).
  // Вызывается при смене сцены, unmount и ручном сбросе.
  const killAllGateTweens = () => {
    gateTweens.forEach(tween => tween.kill())
    gateTweens.clear()
    gateTweenTarget.clear()
  }

  // Автоматическая зачистка при размонтировании.
  // [ИСПРАВЛЕНО] добавлен resetPool('gate-active'): kill твина не триггерит
  // onComplete, а мотор ворот — Зацикленный звук; без сброса он играл вечно
  // после unmount симулятора.
  // [№21-КАЛИТКА-В-ЖИЗНИ] таймеры приоткрытия: калитка, разблокированная
  // охранником и никем не открытая, захлопывается сама через 15 с
  const wicketAjarTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const clearAjarTimer = (gateId: string) => {
    const t = wicketAjarTimers.get(gateId)
    if (t) clearTimeout(t)
    wicketAjarTimers.delete(gateId)
  }
  const clearAllAjarTimers = () => {
    for (const t of wicketAjarTimers.values()) clearTimeout(t)
    wicketAjarTimers.clear()
  }

  onScopeDispose(() => {
    killAllGateTweens()
    clearAllAjarTimers()
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
      // [ФИКС-висяки] gateType обязан быть у каждой калитки/ворот ДО того,
      // как его прочитают физика, маршрутизация потоков и оплата: калитка
      // шире 60px без метки не считалась пешеходной — люди замирали у прохода.
      // Имя надёжнее ширины (стебель «калитк» ловит все падежи).
      if (!settings.gateType) {
        const nm = String(el.name || '').toLowerCase()
        settings.gateType = (nm.includes('калитк') || nm.includes('wicket') || (el.width && el.width <= 60)) ? 'wicket' : 'sliding'
      }
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
    clearAllAjarTimers()
    audio.resetPool('gate-active')

    if (config && config.elements) {
      simElements.value = config.elements.map((el: any) => normalizeElement(el))
      console.log(`[loadScene] Загружено элементов: ${simElements.value.length}, из них ворот: ${simElements.value.filter(el => el.category === 'gate' || el.category === 'barrier').length}`)
    } else {
      simElements.value = []
      console.warn('[loadScene] Нет elements в конфиге')
    }
  }

  // [СХЕМА-ТРАЕКТОРИЙ][ФИКС-КАПОТ] машина рисуется в ПРОФИЛЬ (нос вправо) и
  // НЕ вращается по вертикальному курсу — при вертикальном проходе через
  // ворота она стояла «на капоте». Ориентация — по горизонтальной составляющей
  // курса (флаг _facingLeft ставит физика): едет влево — зеркало scaleX(-1),
  // вправо/стоят — нос вправо. Вертикальные участки (проход, убыль) сохраняют
  // последнюю горизонтальную ориентацию, как в прежней схеме.
  // Люди никогда не вращаются — только по флагу enableRotation.
  // [ФИКС-РЫВОК-ДОТЯГИВАНИЯ] позиционирование ПЕРЕВЕДЕНО с left/top на
  // translate3d. left/top обновляются каждый кадр физики и заставляют браузер
  // пересчитывать layout всей сцены; хуже того — SVG-растр внутри
  // масштабированной сцены (transform: scale) привязывается к ЦЕЛЫМ
  // физическим пикселям, и на медленном ходу (дотягивание 8-24 px/с =
  // 0.1-0.4 px за кадр) агент двигался прыжками по 1 px — видимое
  // «дёргание перед точкой останова». translate3d выносит элемент на
  // композитный слой: смещение применяется на GPU с субпиксельной точностью,
  // layout не пересчитывается вовсе. Для машин и людей добавлен will-change.
  // [№17-ПРЫЖОК] alpha — доля подшага для интерполяции (см. paintCoord):
  // по умолчанию 1 = прежнее поведение (текущая позиция); виджет передаёт
  // lastPaintAlpha, чтобы шаблонный патч совпадал с покадровой записью paint.
  const getElementStyle = (el: SceneElement, enableRotation: boolean, alpha = 1) => {
    const moving = el.category === 'car' || el.category === 'human'
    const base: Record<string, string | number> = {
      position: 'absolute' as const,
      left: '0px',
      top: '0px',
      width: `${el.width}px`,
      height: `${el.height}px`,
      zIndex: el.zIndex || 1,
      transform: `translate3d(${paintCoord(el as any, 'x', alpha)}px, ${paintCoord(el as any, 'y', alpha)}px, 0)`,
    }
    if (moving) base.willChange = 'transform'
    if (el.category === 'car') {
      const facingLeft = (el.settings as any)?._facingLeft ?? el.direction === 'enter'
      base.transform = `${base.transform} scaleX(${facingLeft ? -1 : 1})`
      return base
    }
    if (enableRotation) {
      base.transform = `${base.transform} rotate(${((el.rotation || 0) * 180) / Math.PI}deg)`
    }
    return base
  }

  const getLabelStyle = (el: SceneElement) => {
    const x = el.x + el.width / 2
    const y = el.y - 47
    return {
      // [ФИКС-РЫВОК-ДОТЯГИВАНИЯ] та же схема translate3d, что у агентов:
      // лейбл движется субпиксельно вместе с машиной/человеком, без шагов
      left: '0px', top: '0px',
      transform: `translate3d(${x}px, ${y}px, 0) translateX(-50%)`,
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

  const startGateAnimation = (el: SceneElement, targetOpen: boolean, ajarScale?: number) => {
    const gateId = String(el.id)
    if (!el.settings) el.settings = {}
    gateTweens.get(gateId)?.kill()
    el.settings.isAnimating = true
    el.settings.isStopped = false
    gateTweenTarget.set(gateId, { open: targetOpen, ajar: ajarScale != null })

    const isWicket = el.settings?.gateType === 'wicket' || (el.width && el.width <= 60)

    if (isWicket) {
      // [№21-КАЛИТКА-В-ЖИЗНИ] звук ПОЛНОГО открытия — скрип (дверь
      // толкнули люди). Щелчок замка играет unlockWicket при
      // разблокировке; само приоткрытие сверх щелчка беззвучно.
      if (targetOpen && !ajarScale) {
        audio.playFromPool('wicket-sound', 'wicket-creak', 0.6)
      }
    } else {
      audio.resetPool('gate-active')
      audio.playFromPool('gate-active', 'gate-motor', 0.6)
    }

    let duration = (targetOpen ? (el.settings.openDuration ?? 2) : (el.settings.closeDuration ?? 2))

    const vars: gsap.TweenVars = {
      ease: "none",
      onComplete: () => {
        // [№21-КАЛИТКА-В-ЖИЗНИ] приоткрытие (ajarScale) НЕ делает калитку
        // открытой: пройти можно только после полного открытия людьми.
        // Полное закрытие сбрасывает разблокировку.
        el.settings.isOpen = targetOpen && !ajarScale
        if (isWicket && !targetOpen) {
          el.settings.isAjar = false
          el.settings.wicketAjar = false // [№24-РУЧКА] дубль-ключ локальной физики
          delete el.settings._handleAt // [№26-РУЧКА] заперто — анимации ручки нет
        }
        el.settings.isAnimating = false
        gateTweens.delete(gateId)
        gateTweenTarget.delete(gateId)

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
      const targetScale = targetOpen ? (ajarScale ?? 0.1) : 1
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

  // [ФИКС-ЗАСТРЯНИЕ] сторож ворот. Две аномалии, из-за которых люди стояли
  // у открытой калитки:
  //  1) settings.isAnimating=true при убитом (tween.kill()) или паузированном
  //     твине — onComplete не вызывается, флаг зависает, waiting_before
  //     блокируется навсегда. Лечим: твин не активен — флаг сбрасываем.
  //  2) калитка ВИЗУАЛЬНО открыта (_animScaleX ~ 0 после убитой анимации
  //     открытия), но флаг isOpen=false — люди ждут «закрытую» калитку,
  //     которую пользователь видит открытой. Синхронизируем флаг с визуалом.
  const updateGateWatchdog = (_dt: number) => {
    if (gateTweens.size) {
      for (const [gateId, tween] of Array.from(gateTweens.entries())) {
        if (tween && tween.isActive()) continue
        gateTweens.delete(gateId)
        gateTweenTarget.delete(gateId)
        const gate = simElements.value.find(g => String(g.id) === gateId)
        if (gate?.settings?.isAnimating) {
          gate.settings.isAnimating = false
          console.warn('[gate-watchdog] isAnimating сброшен (твин убит/завершён):', gateId)
        }
      }
    }
    for (const gate of simElements.value) {
      if ((gate.category !== 'gate' && gate.category !== 'barrier') || !gate.settings?.isAnimating) continue
      if (gateTweens.has(String(gate.id))) continue
      gate.settings.isAnimating = false
      console.warn('[gate-watchdog] isAnimating сброшен (твина нет в реестре):', String(gate.id))
    }
    for (const gate of simElements.value) {
      if ((gate.category !== 'gate' && gate.category !== 'barrier') || !gate.settings) continue
      const s = gate.settings
      const isWicket = s.gateType === 'wicket' || (gate.width && gate.width <= 60)
      if (!isWicket || s.isAnimating || s.isOpen) continue
      if (Number.isFinite(s._animScaleX) && (s._animScaleX as number) <= 0.2) {
        s.isOpen = true
        console.warn('[gate-watchdog] калитка визуально открыта — синхронизирован isOpen:', String(gate.id))
      }
    }
  }

  // [№21-КАЛИТКА-В-ЖИЗНИ] разблокировка калитки охранником (кнопка «КАЛИТКА
  // ОТКРЫТЬ» или клик по калитке): звук щелчка замка + приоткрытие — видно,
  // что она не заблокирована. Полностью открывают подошедшие люди (физика
  // вызывает openGateFn). Если за WICKET_AJAR_TIMEOUT_S её никто не открыл —
  // захлопывается сама (сламп в onComplete закрытия).
  const unlockWicket = (el: SceneElement): boolean => {
    if (!GATES_LIST.includes(el.category || '')) return false
    if (!el.settings) el.settings = {}
    const isWicket = el.settings.gateType === 'wicket' || (el.width && el.width <= 60)
    if (!isWicket) return false
    // [№22-КНОПКИ] кнопка обязана отвечать в любой фазе:
    //  • открывается (приоткрытие или люди толкают) — просьба уже исполняется;
    //  • ЗАКРЫВАЕТСЯ — перехват: закрывающуюся дверь можно остановить и
    //    приоткрыть в любой момент; твин пересчитывается по остатку пути;
    //  • открыта — делать нечего;
    //  • закрыта — щелчок замка + приоткрытие (№21).
    const tgt = gateTweenTarget.get(String(el.id))
    if (el.settings.isAnimating && tgt?.open) return true
    // isOpen остается true до конца закрывающего
    // твина (GSAP ставит его в onComplete), поэтому
    // «уже открыта» = открыта и НЕ анимируется.
    if (el.settings.isOpen && !el.settings.isAnimating) return true
    // [№24-РУЧКА] разблокировка НЕ приоткрывает полотно (правка заказчика:
    // «не приоткрывалась немного, а ручка поворачивалась»): флаг замка +
    // щелчок; поворот ручки на 90° против часовой и красный -> зелёный
    // делает CSS (.gate-unlocked на обёртке ворот). Полностью полотно
    // открывают подошедшие люди (физика вызывает openGateFn).
    // Ключ wicketAjar дублирует isAjar: локальная сборка физики читает его
    // (tests/gate-life-21: settings.wicketAjar).
    el.settings.isAjar = true
    el.settings.wicketAjar = true
    // [№26-РУЧКА] отметка старта анимации поворота: физика держит пуш полотна,
    // пока ручка доигрывает (WICKET_HANDLE_S) — «сначала ручка, потом калитка»
    el.settings._handleAt = Date.now()
    audio.playFromPool('wicket-sound', 'wicket-lock', 0.7)
    // [№22→№24] перехват ЗАКРЫВАЮЩЕЙСЯ: дверь «схватили и распахнули» —
    // полотно возвращаем в открытое (полный твин с текущего положения).
    // На закрытой полотно НЕ трогаем: замок показывает только ручка [№24],
    // полное открытие делают подошедшие люди.
    if (el.settings.isAnimating) startGateAnimation(el, true)
    const gid = String(el.id)
    clearAjarTimer(gid)
    wicketAjarTimers.set(gid, setTimeout(() => {
      wicketAjarTimers.delete(gid)
      const g = simElements.value.find(x => String(x.id) === gid)
      const ajarNow = !!g && !!(g.settings?.isAjar || g.settings?.wicketAjar)
      if (g && ajarNow && !g.settings?.isOpen && !g.settings?.isAnimating) {
        console.warn('[wicket-ajar] калитку никто не открыл — захлопывается:', gid)
        closeGate(g)
      }
    }, WICKET_AJAR_TIMEOUT_S * 1000))
    return true
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

    // [№21-КАЛИТКА-В-ЖИЗНИ] клик по калитке = разблокировка: щелчок замка +
    // приоткрытие; полностью открывают подошедшие люди. Открытую — закрыть.
    const isWicketClick = el.settings.gateType === 'wicket' || (el.width && el.width <= 60)
    if (isWicketClick) {
      // [№22-КНОПКИ] мёртвых фаз больше нет. isOpen=true действует
      // до конца закрывающего твина, поэтому фазу берём из
      // gateTweenTarget: закрывающуюся — перехватить (unlock),
      // открывающуюся — не мешать; стоящую открытую — закрыть;
      // закрытую — разблокировать.
      if (el.settings.isAnimating) {
        const tgt = gateTweenTarget.get(String(el.id))
        if (tgt && !tgt.open) return unlockWicket(el)
        return true
      }
      if (el.settings.isOpen) return closeGate(el)
      // [№24-РУЧКА] разблокирована и не открыта (ручка зелёная) —
      // повторный клик запирает: ручка обратно вертикально, красная
      if (el.settings.isAjar || el.settings.wicketAjar) return closeGate(el)
      return unlockWicket(el)
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
    // [№21-КАЛИТКА-В-ЖИЗНИ] полное открытие = дверь толкнули: снимаем
    // разблокировку и её таймер захлопывания
    if (el.settings.gateType === 'wicket' || (el.width && el.width <= 60)) {
      el.settings.isAjar = false
      el.settings.wicketAjar = false // [№24-РУЧКА] дубль-ключ локальной физики
      delete el.settings._handleAt // [№26-РУЧКА] полотно пошло — метка не нужна
      clearAjarTimer(String(el.id))
    }
    startGateAnimation(el, true)
    return true
  }

  const closeGate = (el: SceneElement): boolean => {
    if (!GATES_LIST.includes(el.category || '')) return false
    if (!el.settings) el.settings = {}
    // [№22-КНОПКИ] «КАЛИТКА ЗАКРЫЛЬ» обязана работать в любой фазе:
    //  • уже закрыта — холостой твин и сламп не нужны;
    //  • уже закрывается — просьба исполняется;
    //  • открывается людьми — охранник вправе захлопнуть: твин
    //    перехватывается и закрывает с текущего положения.
    // Откатные ворота — прежняя семантика (инварианты [G2]/свип закрытия).
    const isWicket = el.settings.gateType === 'wicket' || (el.width && el.width <= 60)
    if (isWicket) {
      const tgt = gateTweenTarget.get(String(el.id))
      if (el.settings.isAnimating && tgt && !tgt.open) return true
      // [№24-РУЧКА] «ЗАКРЫТЬ» на разблокированной (ручка зелёная, полотно
      // на месте): просто запираем — ручка возвращается вертикально и
      // краснеет. Без холостого твина и удара (сламп звучал бы из пустоты).
      if (!el.settings.isOpen && !el.settings.isAnimating &&
          (el.settings.isAjar || el.settings.wicketAjar)) {
        el.settings.isAjar = false
        el.settings.wicketAjar = false
        delete el.settings._handleAt // [№26-РУЧКА] заперто — анимации ручки нет
        clearAjarTimer(String(el.id))
        audio.playFromPool('wicket-sound', 'wicket-lock', 0.7)
        return true
      }
      if (!el.settings.isOpen && !el.settings.isAnimating && !el.settings.isAjar) return true
    } else {
      if (el.settings.isAnimating) return false
    }
    clearAjarTimer(String(el.id))
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

  // [№21-КАЛИТКА-В-ЖИЗНИ] звуки переехали: скрип — в startGateAnimation
  // (полное открытие), щелчок замка — в unlockWicket, сламп — в onComplete
  // закрытия. Обёртки больше не дублируют звук калитки.
  const openGateWithSound = (gate: SceneElement): boolean => openGate(gate)

  const closeGateWithSound = (gate: SceneElement): boolean => closeGate(gate)

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
    unlockWicket,
    openGate,
    closeGate,
    stopGate,
    openGateWithSound,
    closeGateWithSound,
    initManualCoords,
    killAllGateTweens,
    updateGateWatchdog,
    gateTweens,
    gateTweenTarget,
  }
}