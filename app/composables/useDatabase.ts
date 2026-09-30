// app/composables/useDatabase.ts
// Назначение: слой IndexedDB — CRUD, пакетная вставка, экспорт/импорт.
// [FIX] Deep-clone перед каждой записью (toRaw + JSON): Vue-Proxy нельзя
// клонировать в structuredClone IndexedDB — падало
// "Uncaught DOMException: Proxy object could not be cloned"
// (воспроизводилось в updateItem при миграциях: записи из reactive-списков
// уходили в put() как Proxy). Теперь write-путь безопасен для любых входных.
// [FIX] deleteItem — guard от записи с невалидным ключом.

// toRaw импортируем явно: composable может вызываться вне автоимпорт-контекста
import { toRaw } from 'vue'

let dbInstance: IDBDatabase | null = null
let dbOpeningPromise: Promise<IDBDatabase> | null = null

// Deep-клон без прокси: toRaw снимает внешний реактивный прокси,
// JSON-цикл снимает ВСЕ вложенные. Функции теряются — для БД это ок.
const toPlain = <T,>(value: T): T => JSON.parse(JSON.stringify(toRaw(value)))


export const useDatabase = () => {
  const { $db } = useNuxtApp() as any

  const getDb = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance)
    if (dbOpeningPromise) return dbOpeningPromise

    dbOpeningPromise = new Promise((resolve, reject) => {
      if ($db) {
        dbInstance = $db
        dbOpeningPromise = null
        resolve($db)
        return
      }

      if (import.meta.server) {
        reject(new Error('IndexedDB is not available on server'))
        return
      }

      const request = indexedDB.open('KppDatabase', 10)

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        const stores = ['people', 'vehicles', 'journal', 'settings', 'shifts', 'scenes']
        stores.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id', autoIncrement: true })
          }
        })
      }

      request.onsuccess = (event: any) => {
        dbInstance = event.target.result
        dbOpeningPromise = null

        dbInstance!.onclose = () => {
          console.warn('[DB] Соединение закрылось. Переподключение при следующем запросе...')
          dbInstance = null
        }

        resolve(dbInstance!)
      }

      request.onerror = (event: any) => {
        dbOpeningPromise = null
        reject(event.target.error)
      }
    })

    return dbOpeningPromise
  }

  // Явно закрыть соединение (например, при logout или полном сбросе)
  const destroyDb = () => {
    dbInstance?.close()
    dbInstance = null
    dbOpeningPromise = null
  }

  const getAllItems = async (storeName: string): Promise<any[]> => {
    if (import.meta.server) return []
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  const getItem = async (storeName: string, id: string | number): Promise<any> => {
    if (import.meta.server) return null
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  const searchItems = async (storeName: string, query: string, field?: string): Promise<any[]> => {
    const items = await getAllItems(storeName)
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter(item => {
      const searchField = field
        ? item[field]
        : (item.fio || item.plate || item.display || JSON.stringify(item))
      return String(searchField).toLowerCase().includes(q)
    })
  }

  const addItem = async (storeName: string, item: any): Promise<number> => {
    if (import.meta.server) return 0
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      // [FIX] клон: Proxy в structured clone не проходит
      const request = store.add(toPlain(item))
      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Пакетная вставка нескольких записей в одну транзакцию.
   * Возвращает массив присвоенных id (в порядке вставки).
   */
  const addItems = async (storeName: string, items: any[]): Promise<number[]> => {
    if (import.meta.server) return []
    if (!items.length) return []
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const ids: number[] = []

      for (const item of items) {
        // [FIX] клон каждой записи
        const request = store.add(toPlain(item))
        request.onsuccess = () => ids.push(request.result as number)
        request.onerror = () => reject(request.error)
      }

      transaction.oncomplete = () => resolve(ids)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  const updateItem = async (storeName: string, newItem: any): Promise<void> => {
    if (import.meta.server) return
    if (!newItem || !newItem.id) return
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const getRequest = store.get(newItem.id)

      getRequest.onsuccess = () => {
        const existingData = getRequest.result
        if (!existingData) {
          // [FIX] клон
          store.add(toPlain(newItem))
        } else {
          const mergedData = { ...existingData, ...toPlain(newItem) }
          // [FIX] клон — здесь и падало (Proxy from reactive list)
          const putRequest = store.put(toPlain(mergedData))
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  const deleteItem = async (storeName: string, id: number | string): Promise<void> => {
    if (import.meta.server) return
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  const clearStore = async (storeName: string): Promise<void> => {
    if (import.meta.server) return
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  const initSettings = async () => {
    const existing = await getItem('settings', 'app_config')
    if (!existing) {
      await updateItem('settings', { id: 'app_config', values: {} })
    }
  }

  const exportDB = async () => {
    if (import.meta.server) return
    const data: Record<string, any[]> = {}
    const stores = ['people', 'vehicles', 'journal', 'settings', 'shifts', 'scenes']
    for (const storeName of stores) {
      data[storeName] = await getAllItems(storeName)
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kpp_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importDB = async (file: File) => {
    if (import.meta.server) return
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          const db = await getDb()
          const stores = ['people', 'vehicles', 'journal', 'settings', 'shifts', 'scenes']

          for (const storeName of stores) {
            if (data[storeName] && Array.isArray(data[storeName])) {
              const tx = db.transaction(storeName, 'readwrite')
              const store = tx.objectStore(storeName)
              await new Promise<void>((res, rej) => {
                const req = store.clear()
                req.onsuccess = () => res()
                req.onerror = () => rej(req.error)
              })
              for (const item of data[storeName]) {
                // [FIX] клон
                store.add(toPlain(item))
              }
              await new Promise<void>((res) => {
                tx.oncomplete = () => res()
                tx.onerror = () => reject(tx.error)
              })
            }
          }
          resolve()
        } catch (err) { reject(err) }
      }
      reader.readAsText(file)
    })
  }

  return {
    getDb,
    getAllItems,
    getItem,
    searchItems,
    addItem,
    addItems,
    updateItem,
    deleteItem,
    clearStore,
    initSettings,
    destroyDb,
    exportDB,
    importDB,
  }
}