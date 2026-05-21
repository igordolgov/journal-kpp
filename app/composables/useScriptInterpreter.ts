// composables/useScriptInterpreter.ts
import { ref } from 'vue'

export const useScriptInterpreter = (
  simElements: any, 
  activeCommands: any, 
  props: any
) => {
  
  const isValidElement = (el: any) => {
    return el && 
          typeof el.x === 'number' && !isNaN(el.x) && 
          typeof el.y === 'number' && !isNaN(el.y)
  }

  const processScriptLogic = () => {
    if (!props.isRunning) return
    if (!props.scripts || props.scripts.length === 0) return

    const busyActorIds = new Set(
      activeCommands.value
        .filter((c: any) => !c.done && c.actor && isValidElement(c.actor))
        .map((c: any) => String(c.actor.id))
    )

    props.scripts.forEach((script: any) => {
      const tracks = script.tracks || []

      tracks.forEach((track: any) => {
        const blocks = track.sequence || []

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]

          // --- Action: Move ---
          if (block.kind === 'action' && block.type === 'move') {

            const existingCommand = activeCommands.value.find((c: any) => c.id === `cmd-${block.id}`)
            if (existingCommand && existingCommand.done) continue
            if (existingCommand && !existingCommand.done) break

            // Ищем актера
            const nextBlock = blocks[i + 1]
            let actor = null
            if (nextBlock && nextBlock.kind === 'actor') {
              actor = simElements.value.find((el: any) => String(el.id) === nextBlock.type)
            }

            if (!actor) continue
            if (!isValidElement(actor)) {
              console.warn(`Actor ${actor?.name} has invalid coordinates, skipping`)
              continue
            }
            if (busyActorIds.has(String(actor.id))) break

            // Ищем цель
            const targetBlock = blocks[i + 2]
            let targetObject = null

            if (targetBlock) {
              if (targetBlock.type === 'direction') {
                const distBlock = blocks[i + 3]
                const dist = distBlock?.valueConfig?.exact || 100
                const dir = targetBlock.valueConfig?.exact
                let tx = actor.x + actor.width / 2
                let ty = actor.y + actor.height / 2

                if (dir === 'up') ty -= dist
                else if (dir === 'down') ty += dist
                else if (dir === 'left') tx -= dist
                else if (dir === 'right') tx += dist

                console.log(`Creating direction target for ${actor.name}: ${dir}, dist=${dist}, target=(${tx},${ty})`)
                
                targetObject = { 
                  id: `virt-dir-${Date.now()}-${Math.random()}`, 
                  x: tx - 20, // Центрируем
                  y: ty - 20,
                  width: 40, 
                  height: 40, 
                  name: `${dir} ${dist}px`,
                  category: 'virtual'
                }
              }
              else if (targetBlock.type === 'point_coords') {
                const cfg = targetBlock.valueConfig || {}
                let x = 0, y = 0
                if (cfg.mode === 'exact' && cfg.exact) {
                  const parts = String(cfg.exact).split(',').map(Number)
                  x = parts[0] || 0
                  y = parts[1] || 0
                } else if (cfg.mode === 'random') {
                  const min = cfg.min ?? 0
                  const max = cfg.max ?? 500
                  x = Math.floor(Math.random() * (max - min + 1)) + min
                  y = Math.floor(Math.random() * (max - min + 1)) + min
                }
                
                console.log(`Creating point target for ${actor.name}: (${x},${y})`)
                
                targetObject = { 
                  id: `virt-point-${Date.now()}-${Math.random()}`, 
                  x: x - 20, // Центрируем
                  y: y - 20,
                  width: 40, 
                  height: 40, 
                  name: `Point (${x},${y})`,
                  category: 'virtual'
                }
              }
              else {
                targetObject = simElements.value.find((el: any) => String(el.id) === targetBlock.type)
                if (targetObject && !isValidElement(targetObject)) {
                  console.warn(`Target ${targetObject.name} has invalid coordinates`)
                  targetObject = null
                }
              }
            }

            if (!targetObject) {
              console.warn(`No valid target for ${actor.name}, skipping command`)
              activeCommands.value.push({ 
                id: `cmd-${block.id}`, 
                actor: actor, 
                target: null, 
                speed: 0, 
                done: true 
              })
              continue
            }

            console.log(`Creating MOVE command: ${actor.name} -> ${targetObject.name} at (${targetObject.x},${targetObject.y})`)
            
            activeCommands.value.push({
              id: `cmd-${block.id}`,
              actor: actor,
              target: targetObject,
              speed: block.valueConfig?.speed || 100,
              done: false,
              type: 'move'
            })
            break
          }

          // --- Logic: Wait ---
          if (block.kind === 'logic' && (block.type === 'wait_until' || block.type === 'check_distance')) {
            const cmdId = `wait-${block.id}`
            const existingWait = activeCommands.value.find((c: any) => c.id === cmdId)

            if (existingWait && !existingWait.done) {
              const targetBlock = blocks[i + 1]
              const target = targetBlock ? simElements.value.find((el: any) => String(el.id) === targetBlock.type) : null

              let conditionMet = false
              if (target && (target.category === 'gate' || target.category === 'barrier')) {
                conditionMet = target.settings?.isOpen === true
              }

              if (conditionMet) {
                existingWait.done = true
                continue
              } else {
                break
              }
            }

            if (existingWait && existingWait.done) continue

            let waitActor = null
            for (let j = i - 1; j >= 0; j--) {
              if (blocks[j].kind === 'actor') {
                waitActor = simElements.value.find((el: any) => String(el.id) === blocks[j].type)
                break
              }
            }

            if (waitActor && isValidElement(waitActor)) {
              activeCommands.value.push({
                id: cmdId,
                actor: waitActor,
                type: 'wait',
                target: null,
                done: false
              })
            }
            break
          }
        }
      })
    })
  }// composables/useScriptInterpreter.ts
export const useScriptInterpreter = (
  simElements: any, 
  activeCommands: any, 
  props: any
) => {
  
  const isValidElement = (el: any) => {
    return el && 
           typeof el.x === 'number' && !isNaN(el.x) && 
           typeof el.y === 'number' && !isNaN(el.y)
  }

  // Принудительное исправление координат актера
  const ensureValidActor = (actor: any) => {
    if (!actor) return false
    if (!actor.x || isNaN(actor.x) || !actor.y || isNaN(actor.y)) {
      // Пытаемся найти актера в simElements и взять его координаты
      const found = simElements.value.find((el: any) => el.id === actor.id)
      if (found && isValidElement(found)) {
        actor.x = found.x
        actor.y = found.y
        actor.width = found.width
        actor.height = found.height
        console.log(`[FIX] Fixed actor ${actor.name} from found element: (${actor.x}, ${actor.y})`)
        return true
      }
      console.warn(`[FIX] Cannot fix actor ${actor.name} - no valid coordinates found`)
      return false
    }
    return true
  }

  const processScriptLogic = () => {
    if (!props.isRunning) return
    if (!props.scripts || props.scripts.length === 0) return

    // Сначала фиксируем всех существующих актеров
    simElements.value.forEach((el: any) => {
      if (['car', 'truck', 'bus', 'vehicle'].includes(el.category || '')) {
        if (!isValidElement(el)) {
          console.warn(`[FIX] Found invalid element ${el.name} at start of script processing`)
          // Восстанавливаем из сохраненных позиций (глобальное хранилище)
          // Доступ к vehiclePositions из usePhysics невозможен, поэтому используем fallback
          const fallbackPositions = [
            { x: 150, y: 200 },
            { x: 350, y: 250 },
            { x: 550, y: 300 },
          ]
          const idx = Math.abs((el.id?.toString().length || 0) % 3)
          el.x = fallbackPositions[idx].x
          el.y = fallbackPositions[idx].y
          console.log(`[FIX] Restored ${el.name} to (${el.x}, ${el.y})`)
        }
      }
    })

    const busyActorIds = new Set(
      activeCommands.value
        .filter((c: any) => !c.done && c.actor && isValidElement(c.actor))
        .map((c: any) => String(c.actor.id))
    )

    props.scripts.forEach((script: any) => {
      const tracks = script.tracks || []

      tracks.forEach((track: any) => {
        const blocks = track.sequence || []

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i]

          // --- Action: Move ---
          if (block.kind === 'action' && block.type === 'move') {

            const existingCommand = activeCommands.value.find((c: any) => c.id === `cmd-${block.id}`)
            if (existingCommand && existingCommand.done) continue
            if (existingCommand && !existingCommand.done) break

            // Ищем актера
            const nextBlock = blocks[i + 1]
            let actor = null
            if (nextBlock && nextBlock.kind === 'actor') {
              actor = simElements.value.find((el: any) => String(el.id) === nextBlock.type)
            }

            if (!actor) continue
            
            // Фиксируем актера перед использованием
            if (!ensureValidActor(actor)) {
              console.warn(`Actor ${actor?.name} has invalid coordinates, skipping command`)
              continue
            }
            
            if (busyActorIds.has(String(actor.id))) break

            // Ищем цель
            const targetBlock = blocks[i + 2]
            let targetObject = null

            if (targetBlock) {
              if (targetBlock.type === 'direction') {
                const distBlock = blocks[i + 3]
                const dist = distBlock?.valueConfig?.exact || 100
                const dir = targetBlock.valueConfig?.exact
                let tx = actor.x + actor.width / 2
                let ty = actor.y + actor.height / 2

                if (dir === 'up') ty -= dist
                else if (dir === 'down') ty += dist
                else if (dir === 'left') tx -= dist
                else if (dir === 'right') tx += dist

                console.log(`Creating direction target for ${actor.name}: ${dir}, dist=${dist}, target=(${tx},${ty})`)
                
                targetObject = { 
                  id: `virt-dir-${Date.now()}-${Math.random()}`, 
                  x: tx - 20,
                  y: ty - 20,
                  width: 40, 
                  height: 40, 
                  name: `${dir} ${dist}px`,
                  category: 'virtual'
                }
              }
              else if (targetBlock.type === 'point_coords') {
                const cfg = targetBlock.valueConfig || {}
                let x = 0, y = 0
                if (cfg.mode === 'exact' && cfg.exact) {
                  const parts = String(cfg.exact).split(',').map(Number)
                  x = parts[0] || 0
                  y = parts[1] || 0
                } else if (cfg.mode === 'random') {
                  const min = cfg.min ?? 0
                  const max = cfg.max ?? 500
                  x = Math.floor(Math.random() * (max - min + 1)) + min
                  y = Math.floor(Math.random() * (max - min + 1)) + min
                }
                
                console.log(`Creating point target for ${actor.name}: (${x},${y})`)
                
                targetObject = { 
                  id: `virt-point-${Date.now()}-${Math.random()}`, 
                  x: x - 20,
                  y: y - 20,
                  width: 40, 
                  height: 40, 
                  name: `Point (${x},${y})`,
                  category: 'virtual'
                }
              }
              else {
                targetObject = simElements.value.find((el: any) => String(el.id) === targetBlock.type)
                if (targetObject && !isValidElement(targetObject)) {
                  console.warn(`Target ${targetObject.name} has invalid coordinates`)
                  targetObject = null
                }
              }
            }

            if (!targetObject) {
              console.warn(`No valid target for ${actor.name}, skipping command`)
              activeCommands.value.push({ 
                id: `cmd-${block.id}`, 
                actor: actor, 
                target: null, 
                speed: 0, 
                done: true 
              })
              continue
            }

            console.log(`Creating MOVE command: ${actor.name} -> ${targetObject.name} at (${targetObject.x},${targetObject.y})`)
            
            activeCommands.value.push({
              id: `cmd-${block.id}`,
              actor: actor,
              target: targetObject,
              speed: block.valueConfig?.speed || 100,
              done: false,
              type: 'move'
            })
            break
          }

          // --- Logic: Wait ---
          if (block.kind === 'logic' && (block.type === 'wait_until' || block.type === 'check_distance')) {
            const cmdId = `wait-${block.id}`
            const existingWait = activeCommands.value.find((c: any) => c.id === cmdId)

            if (existingWait && !existingWait.done) {
              const targetBlock = blocks[i + 1]
              const target = targetBlock ? simElements.value.find((el: any) => String(el.id) === targetBlock.type) : null

              let conditionMet = false
              if (target && (target.category === 'gate' || target.category === 'barrier')) {
                conditionMet = target.settings?.isOpen === true
              }

              if (conditionMet) {
                existingWait.done = true
                continue
              } else {
                break
              }
            }

            if (existingWait && existingWait.done) continue

            let waitActor = null
            for (let j = i - 1; j >= 0; j--) {
              if (blocks[j].kind === 'actor') {
                waitActor = simElements.value.find((el: any) => String(el.id) === blocks[j].type)
                break
              }
            }

            if (waitActor && ensureValidActor(waitActor)) {
              activeCommands.value.push({
                id: cmdId,
                actor: waitActor,
                type: 'wait',
                target: null,
                done: false
              })
            }
            break
          }
        }
      })
    })
    
    // После создания команд, снова фиксируем всех актеров
    simElements.value.forEach((el: any) => {
      if (['car', 'truck', 'bus', 'vehicle'].includes(el.category || '')) {
        if (!isValidElement(el)) {
          console.warn(`[FIX] Found invalid element ${el.name} after script processing`)
          const fallbackPositions = [
            { x: 150, y: 200 },
            { x: 350, y: 250 },
            { x: 550, y: 300 },
          ]
          const idx = Math.abs((el.id?.toString().length || 0) % 3)
          el.x = fallbackPositions[idx].x
          el.y = fallbackPositions[idx].y
        }
      }
    })
  }

  return {
    processScriptLogic
  }
}