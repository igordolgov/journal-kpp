// composables/useSceneBuilder.ts
import { useDatabase } from './useDatabase'
import type { SceneConfig } from '../types/scene'
import { toRaw } from 'vue'

export const useSceneBuilder = () => {
  
  // ИСПОЛЬЗУЕМ ЕДИНСТВЕННЫЙ ИНСТАНС БАЗЫ ДАННЫХ
  const { getDb } = useDatabase()

  const saveScene = async (config: SceneConfig) => {
    if (import.meta.server) return false
    const db = await getDb()
    
    return new Promise((resolve) => {
      try {
        // JSON.parse(JSON.stringify) глубоко копирует объект, отбрасывая ВСЕ Vue-прокси на любой глубине
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

  const loadScene = async (id: string) => {
    if (import.meta.server) return undefined
    const db = await getDb()
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('scenes', 'readonly')
      const store = transaction.objectStore('scenes')
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  const deleteScene = async (id: string) => {
    if (import.meta.server) return
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('scenes', 'readwrite')
      const store = transaction.objectStore('scenes')
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  return { saveScene, loadScene, listScenes, deleteScene }
}