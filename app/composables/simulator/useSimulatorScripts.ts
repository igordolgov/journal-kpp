// app/composables/simulator/useSimulatorScripts.ts
// Назначение: выполнение скриптовых команд сценария (move, wait_until) для актёров.
//
// РЕФАКТОРИНГ (анти-утечка памяти):
//  1. [ИСПРАВЛЕНО] Дедупликация ошибочных move-команд. Раньше команда-ошибка
//     пушалась с id `err-<blockId>`, а искалась как `cmd-<blockId>` — проверка
//     никогда не срабатывала, и activeCommands рос каждый кадр.
//     Теперь id единый.
//  2. [ИСПРАВЛЕНО] activeCommands больше не растёт без предела: выполненные
//     (done:true) команды вычищаются в начале каждого кадра, а факт "выполнено"
//     хранится в легковесном Set строк finishedCommandIds
//     (рост ограничен числом блоков сценария).
//  3. [ДОБАВЛЕНО] При остановке симуляции (isRunning → false) команды и latch'и
//     сбрасываются — повторный запуск начинается с чистого состояния.
//  4. [УДАЛЕНО] Мёртвый импорт audioService (дубль аудио-системы).

import { watch, type Ref } from 'vue'
import { TRAFFIC_CONFIG, SPRITE_ORIENTATION_OFFSET, ARRIVE_THRESHOLD } from '~/utils/simulatorConstants'
import { dot, cross, normalizeAngle } from '~/utils/simulatorMath'
import type { SceneElement, ScriptCommand } from '~/types/simulator'

export function useSimulatorScripts(
  simElements: Ref<SceneElement[]>,
  activeCommands: Ref<ScriptCommand[]>,
  isRunning: Ref<boolean>,
  scripts?: any[]
) {
  // --- Реестр выполненных команд (анти-утечка) ---
  // Хранит только id (строки), а не объекты команд.
  // Наполняется в purgeFinishedCommands, очищается при остановке симуляции.
  const finishedCommandIds = new Set<string>()

  // --- Сброс при остановке симуляции ---
  watch(isRunning, (running) => {
    if (!running) {
      activeCommands.value = []
      finishedCommandIds.clear()
    }
  })

  // Вычищает выполненные команды из activeCommands, переводя их id в реестр.
  // Вызывается в начале каждого кадра — массив держит только команды "в полёте".
  const purgeFinishedCommands = () => {
    if (activeCommands.value.length === 0) return

    const inFlight = activeCommands.value.filter((cmd) => {
      if (cmd.done) {
        finishedCommandIds.add(cmd.id)
        return false
      }
      return true
    })

    // Присваиваем только при изменениях — лишний триггер реактивности не нужен
    if (inFlight.length !== activeCommands.value.length) {
      activeCommands.value = inFlight
    }
  }

  // Поиск актёра для блока: идём назад по треку до ближайшего блока actor
  const findActorForBlock = (blocks: any[], fromIndex: number): SceneElement | null => {
    for (let j = fromIndex; j >= 0; j--) {
      if (blocks[j].kind === 'actor') {
        return simElements.value.find(el => String(el.id) === blocks[j].type) || null
      }
    }
    return null
  }

  // --- Обработка скриптовой логики: какие команды запустить в этом кадре ---
  const processScriptLogic = (dt: number) => {
    // 1) Чистим выполненные команды ВСЕГДА — даже если сценарии не заданы
    purgeFinishedCommands()

    if (!isRunning.value || !scripts) return

    // Актёры, занятые активными командами — новые move на них не вешаем
    const busyActorIds = new Set(
      activeCommands.value.filter(c => !c.done && c.actor).map(c => String(c.actor!.id))
    )

    scripts.forEach(script => {
      ;(script.tracks || []).forEach((track: any) => {
        const blocks = track.sequence || []

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]

          // =====================================================
          // КОМАНДА MOVE
          // =====================================================
          if (block.kind === 'action' && block.type === 'move') {
            // ИСПРАВЛЕНО: единый id для команды И для варианта "ошибка"
            const cmdId = `cmd-${block.id}`

            // Уже выполнена (latch) или прямо сейчас выполняется — пропускаем
            if (finishedCommandIds.has(cmdId)) continue
            if (activeCommands.value.some(c => c.id === cmdId)) continue

            // Поиск актёра (предыдущий блок actor)
            const actor = findActorForBlock(blocks, i - 1)
            if (!actor || busyActorIds.has(String(actor.id))) continue

            // Поиск цели: target | point_coords | direction+distance
            let targetObject: any = null
            let dirBlock: any = null
            let distBlock: any = null
            for (let j = i + 1; j < blocks.length; j++) {
              const b = blocks[j]
              if (b.kind === 'actor') continue
              if (b.type === 'direction') { dirBlock = b; continue }
              if (b.type === 'distance') { distBlock = b; continue }
              if (b.kind === 'target' || (b.kind === 'param' && b.type === 'point_coords')) {
                if (b.type === 'point_coords') {
                  // Виртуальная точка по координатам "x,y"
                  const p = String(b.valueConfig?.exact || '0,0').split(',')
                  targetObject = { id: 'virt', x: Number(p[0]), y: Number(p[1]), width: 0, height: 0 }
                } else {
                  targetObject = simElements.value.find(el => String(el.id) === b.type)
                }
                break
              }
            }

            // Нет явной цели — строим виртуальную из direction + distance
            if (!targetObject && dirBlock && distBlock) {
              const dist = Number(distBlock.valueConfig?.exact) || 100 // [НАСТРОЙКА] дефолт дистанции
              const dir = dirBlock.valueConfig?.exact
              let tx = actor.x + actor.width / 2
              let ty = actor.y + actor.height / 2
              if (dir === 'up') ty -= dist
              else if (dir === 'down') ty += dist
              else if (dir === 'left') tx -= dist
              else if (dir === 'right') tx += dist
              targetObject = {
                id: 'virt_dir',
                x: tx - (actor.width / 2),
                y: ty - (actor.height / 2),
                width: 0,
                height: 0
              }
            }

            // Цели нет вовсе — фиксируем ошибку ОДИН раз тем же id.
            // На следующем кадре purge уберёт её, а finishedCommandIds не даст создать заново.
            if (!targetObject) {
              activeCommands.value.push({ id: cmdId, actor, target: null, speed: 0, done: true })
              continue
            }

            activeCommands.value.push({
              id: cmdId,
              actor,
              target: targetObject,
              speed: Number(block.valueConfig?.speed) || 100, // [НАСТРОЙКА] скорость по умолчанию
              done: false,
              type: 'move'
            })
            // Один move на трек за кадр (как в исходной логике)
            break
          }

          // =====================================================
          // ЛОГИКА WAIT_UNTIL
          // =====================================================
          if (block.kind === 'logic' && block.type === 'wait_until') {
            const cmdId = `wait-${block.id}`

            // Уже выполнено — больше не обрабатываем
            if (finishedCommandIds.has(cmdId)) continue

            const existingWait = activeCommands.value.find(c => c.id === cmdId)

            // Защита (после purge в начале кадра недостижимо)
            if (existingWait && existingWait.done) continue

            if (existingWait) {
              // wait активен — ищем цель и проверяем условие
              let target: SceneElement | null = null
              for (let j = i + 1; j < blocks.length; j++) {
                if (blocks[j].kind === 'target' || blocks[j].kind === 'actor') {
                  target = simElements.value.find(el => String(el.id) === blocks[j].type) || null
                  break
                }
              }
              if (!target) {
                // Цели нет — помечаем выполненным, purge уберёт в следующем кадре
                existingWait.done = true
                continue
              }
              // Условие: ворота/шлагбаум открыты
              if ((target.category === 'gate' || target.category === 'barrier') && target.settings?.isOpen) {
                existingWait.done = true
                continue
              }
              // Условие не выполнено — ждём следующего кадра
              break
            }

            // Команды ещё нет — создаём
            const waitActor = findActorForBlock(blocks, i - 1)
            activeCommands.value.push({ id: cmdId, actor: waitActor, type: 'wait', target: null, done: false })
            break
          }
        }
      })
    })
  }

  // --- Движение актёров по активным командам ---
  const updateActiveCommands = (dt: number) => {
    // Статические препятствия: закрытые ворота + здания/деревья/стены
    const obstacles = simElements.value.filter(ob => {
      if (['gate', 'barrier'].includes(ob.category || '')) return !ob.settings?.isOpen
      if (['building', 'tree', 'wall'].includes(ob.category || '')) return true
      return false
    })

    activeCommands.value.forEach(cmd => {
      // wait и невалидные команды не двигаются
      if (cmd.done || cmd.type === 'wait' || !cmd.actor || !cmd.target) return

      const actor = cmd.actor
      const target = cmd.target as SceneElement
      const cx = actor.x + actor.width / 2
      const cy = actor.y + actor.height / 2
      const tx = target.x + target.width / 2
      const ty = target.y + target.height / 2
      const dx = tx - cx
      const dy = ty - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Пришли — фиксируем выполнение (purge уберёт команду в следующем кадре)
      if (dist < ARRIVE_THRESHOLD) {
        cmd.done = true
        actor.velocity = 0
        return
      }

      const dirX = dx / dist
      const dirY = dy / dist
      // Плавный доворот на цель
      actor.rotation = (actor.rotation || 0) + normalizeAngle(
        (Math.atan2(dirY, dirX) + SPRITE_ORIENTATION_OFFSET) - (actor.rotation || 0)
      ) * 0.15

      // --- Реверс при deadlock ---
      if (cmd.isReversing) {
        cmd.reverseTimer = (cmd.reverseTimer || TRAFFIC_CONFIG.REVERSE_TIME) - dt
        if (cmd.reverseTimer <= 0) {
          cmd.isReversing = false
          cmd.stuckTime = 0
        } else {
          actor.x -= dirX * TRAFFIC_CONFIG.REVERSE_SPEED * dt
          actor.y -= dirY * TRAFFIC_CONFIG.REVERSE_SPEED * dt
          actor.velocity = TRAFFIC_CONFIG.REVERSE_SPEED
          return
        }
      }

      // --- Проверка препятствий ---
      const myLen = Math.max(actor.width, actor.height)
      const myWid = Math.min(actor.width, actor.height)
      let isBlocked = false

      // Статические препятствия
      for (const obs of obstacles) {
        const toObsX = (obs.x + obs.width / 2) - cx
        const toObsY = (obs.y + obs.height / 2) - cy
        const forwardDist = dot({ x: toObsX, y: toObsY }, { x: dirX, y: dirY })
        if (forwardDist < 0 || forwardDist > TRAFFIC_CONFIG.MAX_LOOKAHEAD) continue
        const lateralDist = Math.abs(cross({ x: toObsX, y: toObsY }, { x: dirX, y: dirY }))
        const obsR = Math.min(obs.width, obs.height) / 2
        if (lateralDist < (myWid / 2 + obsR)) {
          const gap = forwardDist - (myLen / 2 + obsR)
          const buffer = ((actor.velocity || 0) * TRAFFIC_CONFIG.REACTION_TIME + TRAFFIC_CONFIG.MIN_BUFFER)
          if (gap < buffer) {
            isBlocked = true
            break
          }
        }
      }

      // Динамические препятствия (другие актёры)
      if (!isBlocked) {
        for (const obs of simElements.value) {
          if (obs.id === actor.id || obs.id === target.id) continue
          const isDynamicObstacle = ['car', 'truck', 'bus', 'human', 'vehicle'].includes(obs.category || '') || obs.asset?.type === 'person'
          if (!isDynamicObstacle) continue
          const toObsX = (obs.x + obs.width / 2) - cx
          const toObsY = (obs.y + obs.height / 2) - cy
          const forwardDist = dot({ x: toObsX, y: toObsY }, { x: dirX, y: dirY })
          if (forwardDist < 0 || forwardDist > TRAFFIC_CONFIG.MAX_LOOKAHEAD) continue
          const lateralDist = Math.abs(cross({ x: toObsX, y: toObsY }, { x: dirX, y: dirY }))
          const obsR = Math.min(obs.width, obs.height) / 2
          if (lateralDist < (myWid / 2 + obsR)) {
            const gap = forwardDist - (myLen / 2 + obsR)
            const buffer = ((actor.velocity || 0) * TRAFFIC_CONFIG.REACTION_TIME + TRAFFIC_CONFIG.MIN_BUFFER)
            if (gap < buffer) {
              isBlocked = true
              break
            }
          }
        }
      }

      // --- Deadlock: стоим слишком долго — сдаём назад ---
      if (isBlocked) {
        cmd.stuckTime = (cmd.stuckTime || 0) + dt
        if (cmd.stuckTime > TRAFFIC_CONFIG.DEADLOCK_TIME) {
          cmd.isReversing = true
          cmd.reverseTimer = TRAFFIC_CONFIG.REVERSE_TIME
          return
        }
      } else {
        cmd.stuckTime = 0
      }

      // --- Скорость: разгон/торможение, остановка перед целью ---
      let targetSpeed = cmd.speed || 100
      if (dist < ((actor.velocity || 0) * (actor.velocity || 0) / (2 * TRAFFIC_CONFIG.DECEL) + ARRIVE_THRESHOLD)) {
        targetSpeed = 0
      }
      if (isBlocked) targetSpeed = 0

      if ((actor.velocity || 0) < targetSpeed) {
        actor.velocity = Math.min(targetSpeed, (actor.velocity || 0) + TRAFFIC_CONFIG.ACCEL * dt)
      } else {
        actor.velocity = Math.max(targetSpeed, (actor.velocity || 0) - TRAFFIC_CONFIG.DECEL * dt)
      }

      if ((actor.velocity || 0) > 0.1) {
        actor.x += dirX * (actor.velocity || 0) * dt
        actor.y += dirY * (actor.velocity || 0) * dt
      }
    })
  }

  return {
    processScriptLogic,
    updateActiveCommands
  }
}