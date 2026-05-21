// composables/usePhysics.ts
import { onUnmounted, watch } from 'vue'

const PHYSICS = {
  MAX_SPEED: 120,
  REVERSE_SPEED: 40,
  ACCEL: 100,
  DECEL: 400,
  SAFE_GAP: 4,
  REACTION_TIME: 0.8,
  ARRIVAL_RADIUS: 15,
  REVERSE_ANGLE_THRESHOLD: -0.95, 
  MIN_WIDTH: 10, 
}

interface Vector { x: number; y: number }
interface SimObject {
  id: string | number
  x: number
  y: number
  width: number
  height: number
  velocity?: number
  rotation?: number
  category?: string
  settings?: any
}

export const usePhysics = (
  simElements: any,
  activeCommands: any,
  props: any,
  hooks: { processScriptLogic: () => void }
) => {
  let animationFrameId: number | null = null
  let lastTime = performance.now()
  let vehicles: SimObject[] = []
  let obstacles: SimObject[] = []
  let pedestrians: SimObject[] = [] // ДОБАВЛЕНО: Кэш пешеходов

  const updateCache = () => {
    vehicles = simElements.value.filter((el: SimObject) =>
      ['car', 'truck', 'bus', 'vehicle'].includes(el.category || '')
    )
    
    // ДОБАВЛЕНО: Фильтрация пешеходов
    pedestrians = simElements.value.filter((el: SimObject) =>
      ['human', 'person', 'pedestrian'].includes(el.category || '')
    )

    obstacles = simElements.value.filter((el: SimObject) => {
      if (['building', 'tree', 'wall'].includes(el.category || '')) return true
      if (['gate', 'barrier'].includes(el.category || '')) return !el.settings?.isOpen
      return false
    })
  }

  watch(simElements, updateCache, { immediate: true })

  const dot = (v1: Vector, v2: Vector) => v1.x * v2.x + v1.y * v2.y
  const cross = (v1: Vector, v2: Vector) => v1.x * v2.y - v1.y * v2.x

  const initVehicles = () => {
    vehicles.forEach((v, i) => {
      if (v.velocity === undefined) v.velocity = 0
      if (!v.x || isNaN(v.x)) {
        v.x = 100 + i * 80
        v.y = 250
      }
      v.width = v.width || 40
      v.height = v.height || 20
    })
  }

  const gameLoop = (timestamp: number) => {
    if (!props.isRunning) return
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05)
    lastTime = timestamp

    try { hooks.processScriptLogic() } catch (e) { console.error(e) }

    const updates = vehicles.map(vehicle => {
      const cmd = activeCommands.value.find((c: any) => c.actor?.id === vehicle.id)
      const state = { 
        v: vehicle, 
        cmd, 
        newVel: vehicle.velocity || 0, 
        moveX: 0, 
        moveY: 0, 
        done: false, 
        newRotation: vehicle.rotation || 0 
      }
      
      if (!cmd || cmd.done || !cmd.target) {
        state.newVel = Math.max(0, (vehicle.velocity || 0) - PHYSICS.DECEL * dt)
        return state
      }

      const target = cmd.target
      const vCenter = { x: vehicle.x + vehicle.width / 2, y: vehicle.y + vehicle.height / 2 }
      const tCenter = { x: target.x + (target.width || 0) / 2, y: target.y + (target.height || 0) / 2 }

      const toTarget = { x: tCenter.x - vCenter.x, y: tCenter.y - vCenter.y }
      const distToTarget = Math.sqrt(toTarget.x * toTarget.x + toTarget.y * toTarget.y)

      if (distToTarget < PHYSICS.ARRIVAL_RADIUS) {
        state.done = true
        state.newVel = 0
        return state
      }

      const currentRotation = vehicle.rotation || 0
      const noseVec = { x: Math.cos(currentRotation), y: Math.sin(currentRotation) }
      const normToTarget = { x: toTarget.x / distToTarget, y: toTarget.y / distToTarget }
      const forwardness = dot(noseVec, normToTarget)

      const currentV = vehicle.velocity || 0
      const shouldReverse = (forwardness < PHYSICS.REVERSE_ANGLE_THRESHOLD) && (currentV < 1)

      let moveDir: Vector
      let maxSpeed = cmd.speed || PHYSICS.MAX_SPEED
      
      if (shouldReverse) {
        const targetAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI
        state.newRotation = currentRotation + normalizeAngle(targetAngle - currentRotation) * 0.1
        moveDir = { x: -Math.cos(state.newRotation), y: -Math.sin(state.newRotation) }
        maxSpeed = Math.min(maxSpeed, PHYSICS.REVERSE_SPEED)
      } else {
        const targetAngle = Math.atan2(toTarget.y, toTarget.x)
        state.newRotation = currentRotation + normalizeAngle(targetAngle - currentRotation) * 0.1
        moveDir = { x: Math.cos(state.newRotation), y: Math.sin(state.newRotation) }
      }

      // ИЗМЕНЕНО: Передаем список пешеходов в проверку
      const minObsDist = checkTrafficAhead(vehicle, moveDir, vehicles, obstacles, pedestrians, target.id)

      let accel = PHYSICS.ACCEL

      if (minObsDist < Infinity) {
        const desiredGap = PHYSICS.SAFE_GAP + Math.abs(currentV) * PHYSICS.REACTION_TIME
        const effectiveDist = Math.max(0.1, minObsDist)
        const interaction = (desiredGap / effectiveDist) ** 2
        
        if (minObsDist < PHYSICS.SAFE_GAP) {
            if (currentV < 1) accel = 0
            else accel = -PHYSICS.DECEL * 2
        } else {
             accel = PHYSICS.ACCEL * (1 - interaction)
        }
      } else {
        accel = PHYSICS.ACCEL * (1 - (currentV / maxSpeed) ** 4)
      }

      state.newVel = currentV + accel * dt
      state.newVel = Math.max(0, Math.min(state.newVel, maxSpeed))
      
      if (state.newVel > 0.1) {
        state.moveX = moveDir.x * state.newVel * dt
        state.moveY = moveDir.y * state.newVel * dt
      }

      return state
    })

    updates.forEach(s => {
      s.v.velocity = s.newVel
      s.v.rotation = s.newRotation
      
      if (s.moveX !== 0 || s.moveY !== 0) {
        s.v.x += s.moveX
        s.v.y += s.moveY
        s.v.x = Math.max(0, Math.min(s.v.x, props.mapWidth - s.v.width))
        s.v.y = Math.max(0, Math.min(s.v.y, props.mapHeight - s.v.height))
      }
      if (s.done && s.cmd) s.cmd.done = true
    })

    animationFrameId = requestAnimationFrame(gameLoop)
  }

  function normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI
    while (angle < -Math.PI) angle += 2 * Math.PI
    return angle
  }

  /**
   * Проверка пути с учетом пешеходов.
   */
  function checkTrafficAhead(
    self: SimObject, 
    moveDir: Vector, 
    allVehicles: SimObject[], 
    allObstacles: SimObject[],
    allPedestrians: SimObject[], // ДОБАВЛЕНО
    targetId: string | number | undefined
  ): number {
    let minDist = Infinity
    
    const myHalfW = (self.width || PHYSICS.MIN_WIDTH) / 2
    const myFront = self.height ? self.height / 2 : self.width / 2

    const myCenter = { x: self.x + self.width/2, y: self.y + self.height/2 }
    
    // ИЗМЕНЕНО: Объединяем все списки препятствий
    const others = [...allVehicles, ...allObstacles, ...allPedestrians]

    for (const other of others) {
      if (other.id === self.id) continue
      if (other.id === targetId) continue

      const otherRadius = Math.min(other.width || 40, other.height || 40) / 2

      const toOther = {
        x: (other.x + other.width/2) - myCenter.x,
        y: (other.y + other.height/2) - myCenter.y
      }

      const forwardDist = dot(toOther, moveDir)
      if (forwardDist < 0) continue;

      const lateralDist = Math.abs(cross(toOther, moveDir))
      if (lateralDist > myHalfW + otherRadius) continue;

      const gap = forwardDist - myFront - otherRadius;
      if (gap < 0) continue;

      if (gap < minDist) {
        minDist = gap
      }
    }

    return minDist
  }

  const startPhysics = () => {
    updateCache()
    initVehicles()
    activeCommands.value = []
    lastTime = performance.now()
    if (!animationFrameId) animationFrameId = requestAnimationFrame(gameLoop)
  }

  const stopPhysics = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  onUnmounted(stopPhysics)

  return { startPhysics, stopPhysics }
}