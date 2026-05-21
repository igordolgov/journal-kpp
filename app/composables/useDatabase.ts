// app/composables/useDatabase.ts
import { useNuxtApp } from '#imports'

// ВАЖНО: Эти переменные живут вне функции useDatabase, 
// поэтому они сохраняются между вызовами (Singleton)
let dbInstance: IDBDatabase | null = null
let dbOpeningPromise: Promise<IDBDatabase> | null = null

interface KppDatabase {
  people: any[]
  vehicles: any[]
  journal: any[]
  settings: any[]
  shifts: any[]
  scenes: any[]
}

export const useDatabase = () => {
  const { $db } = useNuxtApp() as any

  const getDb = (): Promise<IDBDatabase> => {
    // 1. Если БД уже полностью открыта и готова — возвращаем её мгновенно
    if (dbInstance) {
      return Promise.resolve(dbInstance)
    }

    // 2. Если БД сейчас в процессе открытия — возвращаем текущий Promise 
    // (это предотвращает множественные вызовы indexedDB.open)
    if (dbOpeningPromise) {
      return dbOpeningPromise
    }

    // 3. Открываем БД (это выполнится только 1 раз за жизнь приложения)
    dbOpeningPromise = new Promise((resolve, reject) => {
      // Если Nuxt плагин уже передал готовую БД
      if ($db) {
        dbInstance = $db
        dbOpeningPromise = null
        resolve($db)
        return
      }

      if (import.meta.server) {
        reject(new Error("IndexedDB is not available on server"))
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
        dbOpeningPromise = null // Сбрасываем промис, так как БД теперь готова
        
        // Защита на случай неожиданного закрытия БД браузером
        dbInstance.onclose = () => {
          console.warn('[DB] Соединение неожиданно закрылось. Переподключение при следующем запросе...')
          dbInstance = null
        }

        resolve(dbInstance)
      }

      request.onerror = (event: any) => {
        dbOpeningPromise = null // Сбрасываем при ошибке, чтобы можно было попробовать снова
        reject(event.target.error)
      }
    })

    return dbOpeningPromise
  }

  // --- Основные методы (остаются без изменений) ---

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
      const searchField = field ? item[field] : (item.fio || item.plate || item.display || JSON.stringify(item))
      return String(searchField).toLowerCase().includes(q)
    })
  }

  // --- Запись данных ---

  const addItem = async (storeName: string, item: any): Promise<number> => {
    if (import.meta.server) return 0
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.add(item)
      request.onsuccess = () => resolve(request.result as number)
      request.onerror = () => reject(request.error)
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
          store.add(newItem)
        } else {
          const mergedData = { ...existingData, ...newItem }
          const putRequest = store.put(mergedData)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
      transaction.onerror = () => reject(transaction.error)
    })
  }

  const deleteItem = async (storeName: string, id: number): Promise<void> => {
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
      console.log(`[DB] Initializing default settings...`)
      await updateItem('settings', { id: 'app_config', values: {} })
    }
  }

  // --- Экспорт / Импорт данных ---
  const exportDB = async () => {
    if (import.meta.server) return
    const data: Record<string, any[]> = {};
    const stores = ['people', 'vehicles', 'journal', 'settings', 'shifts', 'scenes'];
    for (const storeName of stores) {
      data[storeName] = await getAllItems(storeName);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpp_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDB = async (file: File) => {
    if (import.meta.server) return
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const db = await getDb();
          const stores = ['people', 'vehicles', 'journal', 'settings', 'shifts', 'scenes'];

          for (const storeName of stores) {
            if (data[storeName] && Array.isArray(data[storeName])) {
              const tx = db.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              await new Promise<void>((res, rej) => {
                const req = store.clear();
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
              });

              for (const item of data[storeName]) {
                store.add(item);
              }
              await new Promise<void>((res) => {
                tx.oncomplete = () => res();
                tx.onerror = () => reject(tx.error);
              });
            }
          }
          resolve();
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
  };

  return {
    getDb,
    getAllItems,
    getItem,
    searchItems,
    addItem,
    updateItem,
    deleteItem,
    clearStore,
    initSettings,
    exportDB,
    importDB
  }
}