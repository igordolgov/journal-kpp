//- composables/useScenarioRunner.ts
//- Выполнение сценариев: спавн, движение, команды.
import { reactive } from 'vue'
import type { SceneElement, LogicBlock } from '../types/scene'
import { useSimulatorPhysics } from './useSimulatorPhysics'

// 🔥 ИСПРАВЛЕНО: Константы определены здесь, так как используются в логике движения
const SAFETY_GAP = 40
const DECELERATION = 400

export const useScenarioRunner = () => {
  const { getDistanceToObstacle, getRadius } = useSimulatorPhysics()
  const instanceMap = reactive<Record<string, string>>({})

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

  const processSequence = async (
    sequence: LogicBlock[],
    elements: SceneElement[],
    gateStates: Record<string, 'open' | 'closed'>
  ) => {
    const state: any = {
      actorId: null,
      templateId: null,
      speed: 200,
      direction: null,
      distance: null,
      spawnMode: false,
      spawnAppearance: 'instant',
      target: null,
      targetId: null
    }

    for (const block of sequence) {
      if (block.kind === 'action') {
        if (block.type === 'spawn') {
          state.spawnMode = true
          state.spawnAppearance = block.valueConfig?.appearance || 'instant'
          state.target = null
          state.targetId = null
        } else {
          state.spawnMode = false
        }

        if (block.type === 'move') {
          state.speed = block.valueConfig?.speed || 200
          state.target = null
          state.targetId = null
        }

        if (block.type === 'despawn') {
          if (state.actorId) {
            const el = elements.find(e => e.id === state.actorId)
            if (el) {
              if (block.valueConfig?.effect === 'fade') el.opacity = 0
              await sleep(300)
              const idx = elements.findIndex(e => e.id === el.id)
              if (idx !== -1) elements.splice(idx, 1)
            }
          }
        }
      }

      if (block.kind === 'actor') {
        const templateId = block.valueConfig?.elementId || block.type
        state.actorId = instanceMap[templateId] || templateId
        state.templateId = templateId
      }

      if (block.kind === 'param') {
        const val = block.valueConfig?.exact
        if (block.type === 'speed') state.speed = Number(val) || 200
        if (block.type === 'direction') {
          state.direction = resolveDirection(val)
          const el = elements.find(e => e.id === state.actorId)
          if (el) el.rotation = state.direction
        }
        if (block.type === 'distance') state.distance = Number(val) || 0
      }

      if (block.kind === 'target') {
        const result = getTargetCoordsAndId(block, elements)
        state.target = result.coords
        state.targetId = result.id

        if (state.spawnMode && state.target && state.templateId) {
          const t = elements.find(e => e.id === state.templateId)
          if (t) {
            const nId = `s_${Date.now()}`
            elements.push({
              ...t,
              id: nId,
              x: state.target.x,
              y: state.target.y,
              opacity: state.spawnAppearance === 'fade' ? 0 : 100
            })
            instanceMap[state.templateId] = nId
            if (state.spawnAppearance === 'fade') {
              await sleep(50)
              const a = elements.find(e => e.id === nId)
              if (a) a.opacity = 100
            }
          }
          state.spawnMode = false
        }
      }

      if (state.actorId && !state.spawnMode) {
        const hasAbsoluteTarget = !!state.target
        const hasRelativeTarget = (state.direction !== null && state.distance !== null)

        if (hasAbsoluteTarget || hasRelativeTarget) {
          const actor = elements.find(e => e.id === state.actorId)
          if (actor) {
            let tx, ty
            if (hasAbsoluteTarget) {
              tx = state.target.x
              ty = state.target.y
            } else {
              tx = actor.x
              ty = actor.y
              const dist = state.distance
              const rad = (state.direction - 90) * Math.PI / 180
              tx += Math.cos(rad) * dist
              ty += Math.sin(rad) * dist
            }
            await executeMovement(actor, tx, ty, state.speed, state.direction, elements, gateStates, state.targetId)
            state.direction = null
            state.distance = null
            state.target = null
            state.targetId = null
          }
        }
      }
      if (block.type === 'wait' || block.type === 'delay') await sleep((block.valueConfig?.exact || 1) * 1000)
    }
  }

  const executeMovement = (
    el: any,
    tx: number, ty: number,
    speed: number,
    dir: any,
    elements: SceneElement[],
    gateStates: Record<string, 'open' | 'closed'>,
    ignoreId?: string
  ) => {
    return new Promise(resolve => {
      if (!el) return resolve(false)
      if (dir !== null) el.rotation = dir
      else {
        const a = Math.atan2(ty - el.y, tx - el.x) * 180 / Math.PI
        el.rotation = a + 90
      }
      let lastT = performance.now()
      const anim = () => {
        const n = performance.now()
        const dt = (n - lastT) / 1000
        lastT = n
        const dx = tx - el.x
        const dy = ty - el.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) {
          el.x = tx
          el.y = ty
          return resolve(true)
        }
        const myRadius = getRadius(el)
        const distToObs = getDistanceToObstacle(el.x, el.y, tx, ty, el.id, elements, gateStates, ignoreId)
        const actualGap = distToObs - (myRadius * 2)
        let currentSpeed = speed
        const brakingDist = (currentSpeed * currentSpeed) / (2 * DECELERATION)
        const availableDist = actualGap - SAFETY_GAP

        if (availableDist < brakingDist) {
          currentSpeed = Math.sqrt(2 * DECELERATION * Math.max(0, availableDist))
          if (actualGap <= SAFETY_GAP) currentSpeed = 0
        }
        const stp = (currentSpeed * currentSpeed) / (2 * DECELERATION)
        if (dist < stp) currentSpeed = Math.sqrt(2 * DECELERATION * dist)

        const step = currentSpeed * dt
        el.x += (dx / dist) * step
        el.y += (dy / dist) * step
        requestAnimationFrame(anim)
      }
      anim()
    })
  }

  const resolveDirection = (dir: any) => {
    if (typeof dir === 'number') return dir
    const map: any = { up: 0, right: 90, down: 180, left: 270 }
    return map[String(dir).toLowerCase()] || 0
  }

  const getTargetCoordsAndId = (block: any, elements: SceneElement[]) => {
    if (block.type === 'point_coords') {
      const parts = String(block.valueConfig?.exact || '0,0').split(/\s*,\s*/)
      return {
        coords: { x: parseFloat(parts[0]) || 1, y: parseFloat(parts[1]) || 1 },
        id: null
      }
    }
    const t = elements.find(e => e.id === (block.valueConfig?.elementId || block.type))
    return t ? { coords: { x: t.x, y: t.y }, id: t.id } : { coords: null, id: null }
  }

  return {
    instanceMap,
    processSequence
  }
}