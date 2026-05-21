// composables/useFamilyActions.ts
// Назначение: Действия по управлению составом семьи (добавление родственников).
// Содержит логику вычисления отношения нового члена семьи к Главе семейства 
// на основе его отношения к выбранному целевому человеку.

import { useDatabase } from './useDatabase'
import { useFamily } from './useFamily'

// Интерфейс входящих данных
interface IAddRelativeData {
  fio: string
  gender?: 'male' | 'female'
  // Можно добавить другие поля, если нужно (phone, document и т.д.)
  [key: string]: any
}

export const useFamilyActions = () => {
  const { addItem, getAllItems } = useDatabase()
  const { getFamilyRoot } = useFamily()

  /**
   * Матрица транзитивности отношений.
   * Определяет, кем является НОВЫЙ человек для ГЛАВЫ, если мы знаем:
   * 1. Кем ЦЕЛЬ является для ГЛАВЫ (TargetRelation).
   * 2. Кем НОВЫЙ является для ЦЕЛИ (NewRelationToTarget).
   * 
   * Структура: MAP[TargetRelation][NewRelationToTarget] = NewRelationToHead
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

    // Цель: Брат/Сестра Главы (Дядя/Тётя для детей Главы)
    'Брат': { 'Сын': 'Племянник', 'Дочь': 'Племянница', 'Жена': 'Невестка' },
    'Сестра': { 'Сын': 'Племянник', 'Дочь': 'Племянница', 'Муж': 'Зять' },

    // Цель: Родители Главы
    'Отец': { 'Сын': 'Брат', 'Дочь': 'Сестра' }, // Сын отца = Брат
    'Мать': { 'Сын': 'Брат', 'Дочь': 'Сестра' }, // Сын матери = Брат
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
      
      // Ищем в матрице
      if (RELATION_TRANSIVITY_MAP[targetRelation]?.[relationType]) {
        relationToHead = RELATION_TRANSIVITY_MAP[targetRelation][relationType]
      } else {
        // Фолбэк: если комбинация редкая, оставляем как есть (потребует ручной правки)
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

    // Формирование записи
    const payload: IPerson = {
      fio: data.fio,
      gender: gender,
      category: 'Член семьи',
      location: head.location || '', // Наследуем локацию главы
      main_family_id: head.id, // Привязка к семье
      relation: relationToHead,
      // Копируем дополнительные поля из data
      ...data 
    }

    const newId = await addItem('people', payload)
    
    // Возвращаем созданного человека с ID
    return { ...payload, id: newId }
  }

  return { addRelative }
}