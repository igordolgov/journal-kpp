// app/composables/useSceneBuilder.ts
// Назначение: CRUD сцен в IndexedDB (store 'scenes') через useDatabase.
// [ИСПРАВЛЕНО] Промисы типизированы явно: раньше saveScene возвращал
// Promise<unknown>, loadScene — Promise<any>, что ломало типизацию потребителей
// (layouts/default.vue был вынужден работать с нетипизированным объектом).

import { useDatabase } from './useDatabase'
import type { SceneConfig } from '../types/scene'
import { toRaw } from 'vue'

export const useSceneBuilder = () => {

  // Единый инстанс базы данных
  const { getDb } = useDatabase()

  const saveScene = async (config: SceneConfig): Promise<boolean> => {
    if (import.meta.server) return false
    const db = await getDb()

    return new Promise<boolean>((resolve) => {
      try {
        // Глубокая копия через JSON — отбрасывает ВСЕ Vue-прокси на любой глубине
        const rawConfig = JSON.parse(JSON.stringify(toRaw(config)))
        rawConfig.updatedAt = Date.now()
        if (!rawConfig.createdAt) rawConfig.createdAt = Date.now()

        const transaction = db.transaction('scenes', 'readwrite')
        const store = transaction.objectStore('scenes')
        const request = store.put(rawConfig)

        request.onsuccess = () => {
          console.log(`[SceneBuilder] Saved: ${rawConfig.name}`)
          resolve(true)
        }
        request.onerror = () => {
          console.error('[SceneBuilder] Save Error:', request.error)
          resolve(false)
        }
      } catch (e) {
        console.error('[SceneBuilder] Save Error:', e)
        resolve(false)
      }
    })
  }

  const loadScene = async (id: string): Promise<SceneConfig | undefined> => {
    if (import.meta.server) return undefined
    const db = await getDb()
    return new Promise<SceneConfig | undefined>((resolve, reject) => {
      const transaction = db.transaction('scenes', 'readonly')
      const store = transaction.objectStore('scenes')
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  const listScenes = async (): Promise<SceneConfig[]> => {
    if (import.meta.server) return []
    const db = await getDb()
    return new Promise<SceneConfig[]>((resolve, reject) => {
      const transaction = db.transaction('scenes', 'readonly')
      const store = transaction.objectStore('scenes')
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  const deleteScene = async (id: string): Promise<void> => {
    if (import.meta.server) return
    const db = await getDb()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('scenes', 'readwrite')
      const store = transaction.objectStore('scenes')
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  return { saveScene, loadScene, listScenes, deleteScene }
}