// composables/useFamilyActions.ts
// Назначение: действия по управлению составом семьи (добавление родственников).
// [ИСПРАВЛЕНО v2]: id в IPerson опционален (запись создаётся ДО addItem);
// fio/gender больше не дублируются явными полями перед spread (TS2783/TS2741):
// порядок — дефолты, затем ...cleanData, затем вычисленный gender последним.

import { useDatabase } from './useDatabase'
import { useFamily } from './useFamily'

// Локальный тип записи человека (динамические поля IndexedDB).
// id опционален: новая запись получает его от addItem после вставки.
type IPerson = { id?: number | string; location?: string; relation?: string; [key: string]: any }

// Интерфейс входящих данных
interface IAddRelativeData {
  fio: string
  gender?: 'male' | 'female'
  [key: string]: any
}

export const useFamilyActions = () => {
  // updateItem — для привязки существующих людей
  const { addItem, updateItem, getAllItems } = useDatabase()
  const { getFamilyRoot } = useFamily()

  /**
   * Матрица транзитивности отношений.
   * MAP[TargetRelation][NewRelationToTarget] = NewRelationToHead
   */
  const RELATION_TRANSIVITY_MAP: Record<string, Record<string, string>> = {
    // Цель: Супруга Главы
    'Супруга': { 'Сын': 'Сын', 'Дочь': 'Дочь', 'Муж': 'Глава' },
    'Супруг': { 'Сын': 'Сын', 'Дочь': 'Дочь', 'Жена': 'Глава' },

    // Цель: Ребенок Главы
    'Сын': { 'Сын': 'Внук', 'Дочь': 'Внучка', 'Жена': 'Невестка' },
    'Дочь': { 'Сын': 'Внук', 'Дочь': 'Внучка', 'Муж': 'Зять' },

    // Цель: Внук Главы
    'Внук': { 'Сын': 'Правнук', 'Дочь': 'Правнучка' },
    'Внучка': { 'Сын': 'Правнук', 'Дочь': 'Правнучка' },

    // Цель: Брат/Сестра Главы
    'Брат': { 'Сын': 'Племянник', 'Дочь': 'Племянница', 'Жена': 'Невестка' },
    'Сестра': { 'Сын': 'Племянник', 'Дочь': 'Племянница', 'Муж': 'Зять' },

    // Цель: Родители Главы
    'Отец': { 'Сын': 'Брат', 'Дочь': 'Сестра' },
    'Мать': { 'Сын': 'Брат', 'Дочь': 'Сестра' },
  }

  /**
   * Добавляет родственника к выбранному человеку.
   * Автоматически вычисляет отношение к Главе семьи и пол.
   */
  const addRelative = async (
    targetPerson: IPerson,
    relationType: string,
    data: IAddRelativeData
  ): Promise<IPerson> => {
    if (!targetPerson) throw new Error('Целевой человек не выбран')

    const allPeople = await getAllItems('people')
    const head = getFamilyRoot(targetPerson, allPeople)
    if (!head) throw new Error('Не удалось определить главу семьи')

    let relationToHead = relationType

    // Если цель не является главой, вычисляем отношение через матрицу
    if (String(targetPerson.id) !== String(head.id)) {
      const targetRelation = targetPerson.relation || ''

      // guard: индексация Record -> string | undefined
      const mapped = RELATION_TRANSIVITY_MAP[targetRelation]?.[relationType]
      if (mapped) {
        relationToHead = mapped
      } else {
        // Фолбэк: редкая комбинация — оставляем как есть (потребует ручной правки)
        console.warn(`Unknown relation transitivity: ${targetRelation} -> ${relationType}`)
        relationToHead = relationType
      }
    }

    // Определение пола на основе отношения
    const maleRelations = ['Сын', 'Муж', 'Отец', 'Брат', 'Дядя', 'Внук', 'Племянник', 'Зять']
    const femaleRelations = ['Дочь', 'Жена', 'Мать', 'Сестра', 'Тётя', 'Внучка', 'Племянница', 'Невестка']

    let gender = data.gender
    if (!gender) {
      if (maleRelations.includes(relationToHead)) gender = 'male'
      else if (femaleRelations.includes(relationToHead)) gender = 'female'
      else gender = 'male' // Дефолт
    }

    // ====================================================================
    // Привязка СУЩЕСТВУЮЩЕГО взрослого человека
    // ====================================================================
    if (data._isExisting && data._existingId) {
      const existingId = data._existingId

      // Обновляем только семейные поля, не трогая внешность и данные
      await updateItem('people', {
        id: existingId,
        main_family_id: head.id,
        relation: relationToHead,
        location: head.location || '' // Синхронизируем проживание с главой
      })

      return {
        ...data,
        id: existingId,
        main_family_id: head.id,
        relation: relationToHead,
        gender
      } as IPerson
    }
    // ====================================================================

    // Очищаем данные от служебных флагов модалки
    const { _isExisting, _existingId, ...cleanData } = data

    // Формирование записи для НОВОГО человека.
    // [ИСПРАВЛЕНО v2] порядок: вычисленные дефолты -> ...cleanData (пользовательские
    // поля, включая fio) -> gender ПОСЛЕДНИМ (вычисленный пол побеждает).
    // Явное дублирование fio убрано — оно перезаписывалось spread'ом (TS2783).
    const payload: IPerson = {
      category: 'Член семьи',
      location: head.location || '',
      main_family_id: head.id,
      relation: relationToHead,

      // --- Базовая внешность для симулятора (если не передали свою) ---
      skinTone: cleanData.skinTone || '#FDE8D0',
      hairColor: cleanData.hairColor || (gender === 'female' ? '#5A3825' : '#3D2314'),
      topColor: cleanData.topColor || '#3b82f6',
      bottomColor: cleanData.bottomColor || '#1e3a8a',
      hairStyleId: cleanData.hairStyleId || (gender === 'female' ? 'long' : 'short'),
      glasses: cleanData.glasses || 'none',
      animation: cleanData.animation || { speed: 1, swingAmplitude: 5, bounceAmplitude: 3, armSwing: 15 },
      // ------------------------------------------------------

      // Пользовательские поля (fio и остальное)
      ...cleanData,

      // Вычисленный пол — строго после spread
      gender
    }

    const newId = await addItem('people', payload)

    // Возвращаем созданного человека с ID
    return { ...payload, id: newId }
  }

  return { addRelative }
}