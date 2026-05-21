// composables/useSimulatorScripts.ts
// Выполнение скриптов (move, wait_until) для активных команд

import { Ref } from 'vue'
import { TRAFFIC_CONFIG, SPRITE_ORIENTATION_OFFSET, ARRIVE_THRESHOLD } from '~/utils/simulatorConstants'
import { normalizeAngle } from '~/utils/simulatorMath'
import type { SceneElement, ScriptCommand } from '~/types/simulator'
import { audioService } from '~/services/audioService'

export function useSimulatorScripts(
  simElements: Ref<SceneElement[]>,
  activeCommands: Ref<ScriptCommand[]>,
  isRunning: Ref<boolean>,
  scripts?: any[]
) {
  const processScriptLogic = (dt: number) => {
    if (!isRunning.value || !scripts) return

    const busyActorIds = new Set(
      activeCommands.value.filter(c => !c.done && c.actor).map(c => String(c.actor!.id))
    )

    scripts.forEach(script => {
      ;(script.tracks || []).forEach((track: any) => {
        const blocks = track.sequence || []
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]

          // Обработка команды move
          if (block.kind === 'action' && block.type === 'move') {
            const cmdId = `cmd-${block.id}`
            const existingCommand = activeCommands.value.find(c => c.id === cmdId)
            if (existingCommand && existingCommand.done) continue

            // Поиск актёра (предыдущий блок actor)
            let actor: SceneElement | null = null
            for (let j = i - 1; j >= 0; j--) {
              if (blocks[j].kind === 'actor') {
                actor = simElements.value.find(el => String(el.id) === blocks[j].type) || null
                break
              }
            }
            if (!actor || busyActorIds.has(String(actor.id))) continue

            // Поиск цели (target, point_coords, direction+distance)
            let targetObject: any = null
            let dirBlock = null
            let distBlock = null
            for (let j = i + 1; j < blocks.length; j++) {
              const b = blocks[j]
              if (b.kind === 'actor') continue
              if (b.type === 'direction') { dirBlock = b; continue }
              if (b.type === 'distance') { distBlock = b; continue }
              if (b.kind === 'target' || (b.kind === 'param' && b.type === 'point_coords')) {
                if (b.type === 'point_coords') {
                  const p = String(b.valueConfig?.exact || '0,0').split(',')
                  targetObject = { id: 'virt', x: Number(p[0]), y: Number(p[1]), width: 0, height: 0 }
                } else {
                  targetObject = simElements.value.find(el => String(el.id) === b.type)
                }
                break
              }
            }

            // Если нет явной цели, используем направление и расстояние
            if (!targetObject && dirBlock && distBlock) {
              const dist = Number(distBlock.valueConfig?.exact) || 100
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

            if (!targetObject) {
              activeCommands.value.push({ id: `err-${block.id}`, actor, target: null, speed: 0, done: true })
              continue
            }

            activeCommands.value.push({
              id: cmdId,
              actor,
              target: targetObject,
              speed: Number(block.valueConfig?.speed) || 100,
              done: false,
              type: 'move'
            })
            break
          }

          // Обработка wait_until
          if (block.kind === 'logic' && block.type === 'wait_until') {
            const cmdId = `wait-${block.id}`
            const existingWait = activeCommands.value.find(c => c.id === cmdId)
            if (existingWait && !existingWait.done) {
              let target: SceneElement | null = null
              for (let j = i + 1; j < blocks.length; j++) {
                if (blocks[j].kind === 'target' || blocks[j].kind === 'actor') {
                  target = simElements.value.find(el => String(el.id) === blocks[j].type) || null
                  break
                }
              }
              if (!target) {
                existingWait.done = true
                continue
              }
              // Проверка условия: ворота открыты
              if ((target.category === 'gate' || target.category === 'barrier') && target.settings?.isOpen) {
                existingWait.done = true
                continue
              } else break
            }
            if (existingWait && existingWait.done) continue

            let waitActor: SceneElement | null = null
            for (let j = i - 1; j >= 0; j--) {
              if (blocks[j].kind === 'actor') {
                waitActor = simElements.value.find(el => String(el.id) === blocks[j].type) || null
                break
              }
            }
            activeCommands.value.push({ id: cmdId, actor: waitActor, type: 'wait', target: null, done: false })
            break
          }
        }
      })
    })
  }

  const updateActiveCommands = (dt: number) => {
    const obstacles = simElements.value.filter(ob => {
      if (['gate', 'barrier'].includes(ob.category || '')) return !ob.settings?.isOpen
      if (['building', 'tree', 'wall'].includes(ob.category || '')) return true
      return false
    })

    activeCommands.value.forEach(cmd => {
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

      if (dist < ARRIVE_THRESHOLD) {
        cmd.done = true
        actor.velocity = 0
        return
      }

      const dirX = dx / dist
      const dirY = dy / dist
      actor.rotation = (actor.rotation || 0) + normalizeAngle(
        (Math.atan2(dirY, dirX) + SPRITE_ORIENTATION_OFFSET) - (actor.rotation || 0)
      ) * 0.15

      // Обработка реверсирования при deadlock
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

      // Проверка препятствий (статических и динамических)
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