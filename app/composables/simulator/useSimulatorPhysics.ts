// composables/simulator/useSimulatorPhysics.ts
import { type Ref, onScopeDispose } from 'vue'
import { useAudioEngine } from '~/composables/useAudioEngine'
import type { SceneElement, AiAgent } from '~/types/simulator'
import { DESPAWN_MARGIN } from '~/utils/simulatorConstants'
import { dot, cross, normalizeAngle } from '~/utils/simulatorMath'

export function useSimulatorPhysics(
  simElements: Ref<SceneElement[]>,
  aiAgents: Ref<AiAgent[]>,
  sceneSize: Ref<{ width: number; height: number }>,
  openGateFn: (gate: SceneElement) => boolean,
  closeGateFn: (gate: SceneElement) => boolean,
  stopGateFn: (gate: SceneElement) => void,
  simOpts: any = {},
  onAgentDone?: (agent: AiAgent) => void
) {
  // ✅ audio теперь внутри setup-контекста
  const audio = useAudioEngine()
  
  // ✅ gateCloseTimers теперь внутри функции, а не на уровне модуля
  const gateCloseTimers = new Map<string, ReturnType<typeof setTimeout>>()
  
  // ✅ автоматическая очистка при размонтировании
  onScopeDispose(() => {
    clearAllTimers()
  })

  const updateAiMovement = (dt: number, cfg: { carGateId: string; personGateId: string }) => {
    const ACCEL = simOpts.ACCEL ?? 100
    const DECEL = simOpts.DECEL ?? 100
    const REACTION_TIME = simOpts.REACTION_TIME ?? 1.5
    const MIN_BUFFER = simOpts.MIN_BUFFER ?? 15
    const MAX_LOOKAHEAD = simOpts.MAX_LOOKAHEAD ?? 220
    const ARRIVE_THRESHOLD = simOpts.ARRIVE_THRESHOLD ?? 1
    const SPRITE_ORIENTATION_OFFSET = simOpts.SPRITE_ORIENTATION_OFFSET ?? 0
    const gateCloseDelay = simOpts.gateCloseDelay ?? 10
    const wicketCloseDelay = simOpts.wicketCloseDelay ?? 0

    // Удаление завершённых агентов + вызов логирования
    aiAgents.value = aiAgents.value.filter(agent => {
      if (agent.state === 'done') {
        if (onAgentDone) {
          onAgentDone(agent)
        }
        if (agent.type === 'car') audio.disposePool(`car-${agent.id}`)
        simElements.value = simElements.value.filter(el => el.id !== agent.id)
        return false
      }
      return true
    })

    const sorted = [...aiAgents.value].sort((a, b) =>
      Math.hypot(a.element.x - a.target.x, a.element.y - a.target.y) -
      Math.hypot(b.element.x - b.target.x, b.element.y - b.target.y)
    )

    const tryActivateNextInGroup = (agent: AiAgent) => {
      if (!agent.groupId || !agent.isLeader) return
      const groupMembers = agent.groupMembers
      if (!groupMembers) return
      const currentIndex = agent.groupIndex ?? 0
      const nextIndex = currentIndex + 1
      const nextMember = groupMembers.find(m => (m.groupIndex ?? 0) === nextIndex)
      if (nextMember && nextMember.state === 'waiting_before') {
        nextMember.state = 'crossing'
        nextMember.target = { ...nextMember.exitPoint, width: 0, height: 0 }
      }
    }

    for (const agent of sorted) {
      const el = agent.element
      const gateId = agent.type === 'car' ? cfg.carGateId : cfg.personGateId
      const gate = simElements.value.find(g => String(g.id) === gateId)
      const isWicket = gate?.settings?.gateType === 'wicket' || (gate?.width && gate.width <= 60)
      const closeDelay = isWicket ? wicketCloseDelay : gateCloseDelay

      if (agent.state === 'to_gate' && gate && !agent.groupId) {
        const prefix = agent.direction === 'enter' 
          ? (agent.type === 'person' ? 'stopEnterPerson' : 'stopEnterCar')
          : (agent.type === 'person' ? 'stopExitPerson' : 'stopExitCar')
        const offX = gate.settings?.[`${prefix}X`]
        const offY = gate.settings?.[`${prefix}Y`]
        if (offX !== undefined && offY !== undefined && !isNaN(offX) && !isNaN(offY)) {
          const gateCenterX = gate.x + gate.width / 2
          const gateCenterY = gate.y + gate.height / 2
          agent.target.x = gateCenterX - el.width / 2 + offX
          agent.target.y = gateCenterY - el.height / 2 + offY
        }
      }

      if (agent.state === 'waiting_before') {
        el.velocity = 0
        if (!gate) continue
        if (gate.settings.isAnimating) continue
        if (!gate.settings.isOpen) continue

        if (agent.isLeader) {
          if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
          agent.state = 'crossing'
          agent.target = { ...agent.exitPoint, width: 0, height: 0 }
          continue
        }

        const prevMember = agent.groupMembers?.find(m => (m.groupIndex ?? 0) === (agent.groupIndex ?? 0) - 1)
        if (!prevMember || prevMember.state === 'moving_away' || prevMember.state === 'done') {
          if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
          agent.state = 'crossing'
          agent.target = { ...agent.exitPoint, width: 0, height: 0 }
        }
        continue
      }

      if (agent.state === 'waiting_after') {
        el.velocity = 0
        const hasOtherCarNear = aiAgents.value.some(a =>
          a !== agent &&
          a.type === 'car' &&
          (a.state === 'waiting_before' || a.state === 'to_gate' || a.state === 'crossing') &&
          String(gate?.id) === cfg.carGateId
        )
        if (hasOtherCarNear) {
          agent.state = 'moving_away'
          agent.target = { ...agent.afterTarget, width: 0, height: 0 }
        } else if (gate && !gate.settings?.isOpen && !gate.settings?.isAnimating) {
          agent.state = 'moving_away'
          agent.target = { ...agent.afterTarget, width: 0, height: 0 }
        }
        continue
      }

      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const tx = agent.target.x + agent.target.width / 2
      const ty = agent.target.y + agent.target.height / 2
      let dx = tx - cx
      let dy = ty - cy
      let dist = Math.hypot(dx, dy)

      if (dist < 0.01) continue

      const dirX = dx / dist
      const dirY = dy / dist

      if (dist < ARRIVE_THRESHOLD) {
        if (agent.state === 'to_gate') {
          el.velocity = 0
          agent.state = 'waiting_before'
        } 
        else if (agent.state === 'crossing') {
          el.velocity = 0
          if (el.zIndex && el.zIndex < 400 && agent.direction === 'enter') {
            el.zIndex = 400
            simElements.value = [...simElements.value]
          }

          if (isWicket) {
            agent.state = 'moving_away'
            agent.target = { ...agent.afterTarget, width: 0, height: 0 }
            tryActivateNextInGroup(agent)

            let shouldClose = true
            if (agent.groupId) {
              const leader = aiAgents.value.find(a => a.groupId === agent.groupId && a.isLeader)
              if (leader && leader.groupMembers) {
                const anyRemaining = leader.groupMembers.some(m =>
                  m.state === 'waiting_before' || m.state === 'crossing'
                )
                if (anyRemaining) shouldClose = false
              }
            }

            if (shouldClose && gate && gate.settings?.isOpen && !gate.settings?.isAnimating && !gate.settings?.isStopping) {
              if (closeDelay === 0) closeGateFn(gate)
              else {
                if (gateCloseTimers.has(gateId)) clearTimeout(gateCloseTimers.get(gateId)!)
                const timer = setTimeout(() => {
                  const currentGate = simElements.value.find(g => String(g.id) === gateId)
                  if (currentGate && currentGate.settings?.isOpen && !currentGate.settings?.isAnimating && !currentGate.settings?.isStopping) {
                    const hasOtherWaiting = aiAgents.value.some(a =>
                      a.state === 'waiting_before' &&
                      ((a.type === 'person' && String(currentGate.id) === cfg.personGateId) ||
                      (a.type === 'car' && String(currentGate.id) === cfg.carGateId))
                    )
                    if (!hasOtherWaiting) closeGateFn(currentGate)
                  }
                  gateCloseTimers.delete(gateId)
                }, closeDelay * 1000)
                gateCloseTimers.set(gateId, timer)
              }
            }
          } 
          else {
            agent.state = 'waiting_after'
            if (gate && gate.settings?.isOpen && !gate.settings?.isAnimating && closeDelay > 0 && !gateCloseTimers.has(gateId) && !gate.settings?.isStopping) {
              const timer = setTimeout(() => {
                const currentGate = simElements.value.find(g => String(g.id) === gateId)
                if (currentGate && currentGate.settings?.isOpen && !currentGate.settings?.isAnimating && !currentGate.settings?.isStopping) {
                  const hasActiveAgents = aiAgents.value.some(a =>
                    (a.state === 'waiting_before' || a.state === 'crossing') &&
                    ((a.type === 'car' && String(currentGate.id) === cfg.carGateId) ||
                     (a.type === 'person' && String(currentGate.id) === cfg.personGateId))
                  )
                  if (!hasActiveAgents) closeGateFn(currentGate)
                }
                gateCloseTimers.delete(gateId)
              }, closeDelay * 1000)
              gateCloseTimers.set(gateId, timer)
            }
          }
        } 
        else if (agent.state === 'moving_away') {
          agent.state = 'done'
        }
        continue
      }

      let distanceToLeader = Infinity
      let leaderSpeed = Infinity
      const myLen = Math.max(el.width, el.height)
      const myWid = Math.min(el.width, el.height)

      for (const other of sorted) {
        if (other.id === agent.id) continue
        if (other.type !== agent.type) continue
        if (other.direction !== agent.direction) continue
        const ox = other.element.x + other.element.width / 2
        const oy = other.element.y + other.element.height / 2
        const toX = ox - cx
        const toY = oy - cy
        const forward = dot({ x: toX, y: toY }, { x: dirX, y: dirY })
        if (forward < 0 || forward > MAX_LOOKAHEAD) continue
        const lateral = Math.abs(cross({ x: toX, y: toY }, { x: dirX, y: dirY }))
        const otherWid = Math.min(other.element.width, other.element.height)
        if (lateral > myWid / 2 + otherWid / 2 + 15) continue
        const otherLen = Math.max(other.element.width, other.element.height)
        const gap = forward - (myLen / 2 + otherLen / 2)
        if (gap > 0 && gap < distanceToLeader) {
          distanceToLeader = gap
          leaderSpeed = other.element.velocity || 0
        }
      }

      let targetSpeed = agent.speed
      const safeDistance = Math.max(MIN_BUFFER, (el.velocity || 0) * REACTION_TIME)
      if (distanceToLeader < safeDistance) {
        targetSpeed = Math.min(targetSpeed, leaderSpeed * 0.8)
        if (distanceToLeader < safeDistance * 0.5) targetSpeed = 0
      }
      if (dist < 80) targetSpeed = Math.min(targetSpeed, 30)

      if ((el.velocity || 0) < targetSpeed) {
        el.velocity = Math.min(targetSpeed, (el.velocity || 0) + ACCEL * dt)
      } else {
        el.velocity = Math.max(targetSpeed, (el.velocity || 0) - DECEL * dt * 2)
      }

      const targetAngle = Math.atan2(dirY, dirX)
      let angleDiff = normalizeAngle(targetAngle - (el.rotation || 0) + SPRITE_ORIENTATION_OFFSET)
      el.rotation = (el.rotation || 0) + angleDiff * 0.1

      if ((el.velocity || 0) > 0.5) {
        el.x += dirX * (el.velocity || 0) * dt
        el.y += dirY * (el.velocity || 0) * dt
      }

      if (!(agent.direction === 'exit' && agent.state !== 'done')) {
        if (el.x + el.width < -DESPAWN_MARGIN || el.x > sceneSize.value.width + DESPAWN_MARGIN ||
            el.y + el.height < -DESPAWN_MARGIN || el.y > sceneSize.value.height + DESPAWN_MARGIN) {
          agent.state = 'done'
        }
      }
    }
  }

  const clearAllTimers = () => {
    for (const timer of gateCloseTimers.values()) clearTimeout(timer)
    gateCloseTimers.clear()
  }

  const cancelCloseTimer = (gateId: string) => {
    const timer = gateCloseTimers.get(gateId)
    if (timer) clearTimeout(timer)
    gateCloseTimers.delete(gateId)
  }

  return { updateAiMovement, clearAllTimers, cancelCloseTimer }
}