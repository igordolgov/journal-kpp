// app/composables/useCompanions.ts 
// Назначение: Логика расчета статусов местонахождения, проверка родственных связей  
// и валидация правил сопровождения (взрослые + дети) для формирования поездки. 

import { useFamily } from './useFamily' 

type LocationStatus = 'inside' | 'outside' | 'unknown' 

export const useCompanions = () => { 
  
  const { getFamilyRoot } = useFamily() 

  // --- 1. ОПРЕДЕЛЕНИЕ СТАТУСА (Где человек) --- 
  
  /** 
   * Определяет, где находится человек: на территории или за её пределами. 
   * Приоритет: Журнал > Место жительства. 
   */ 
  const getPersonLocationStatus = (person: any, journalList: any[]): LocationStatus => { 
    // ИСПРАВЛЕНИЕ: Убрана лишняя закрывающая скобка }
    if (!person || person.type === 'vehicle') return 'unknown' 
     
    const personId = String(person.id) 
 
    // Ищем записи в журнале.  
    const personEntries = journalList.filter((e: any) => String(e.person_id) === personId) 
 
    if (personEntries.length > 0) { 
      const hasOpenExit = personEntries.some((e: any) => e.timestamp_out && !e.timestamp_in) 
      const hasOpenEntry = personEntries.some((e: any) => e.timestamp_in && !e.timestamp_out) 
 
      // Приоритет выезду (если человек уехал, он снаружи) 
      if (hasOpenExit) return 'outside' 
      if (hasOpenEntry) return 'inside' 
    } 
     
    // По умолчанию - по месту жительства (поле location) 
    // ИСПРАВЛЕНО: 'вне территории' теперь правильно считается как СНАРУЖИ, а не внутри
    const loc = (person.location || '').trim().toLowerCase() 
    
    // ИСПРАВЛЕНО: Добавлены пропущенные операторы ||
    const isResident = loc === '' || !(loc.includes('город') || loc === 'outside' || loc === 'вне территории') 
 
    return isResident ? 'inside' : 'outside' 
  } 
 
  const getPersonStatusText = (status: LocationStatus): string => { 
    const map: Record<LocationStatus, string> = { 
      outside: 'снаружи', 
      inside: 'тут', 
      unknown: 'неизвестно' 
    } 
    return map[status] || 'неизвестно' 
  } 
 
  // --- 2. ПРОВЕРКА СВЯЗЕЙ (Семья и Доверенные) --- 
 
  /** 
   * Проверяет, имеет ли кандидат право сопровождать цель (ребенка). 
   * 1. Проверка по списку allowed_guardians. 
   * 2. Проверка через общий корень семьи. 
   */ 
 
  const isValidGuardianFor = (target: any, candidate: any, peopleList: any[]): boolean => { 
    if (!target || !candidate) return false 
 
    // 1. Явный разрешенный опекун 
    if (target.allowed_guardians?.includes(candidate.id)) { 
      return true 
    } 
 
    // 2. Член семьи (через корень семьи) 
    // ИСПРАВЛЕНО: Добавлена защита от падения, если peopleList пуст
    if (peopleList && peopleList.length > 0) { 
      const targetRoot = getFamilyRoot(target, peopleList) 
      const candidateRoot = getFamilyRoot(candidate, peopleList) 
       
      // Если у обоих есть корни и они совпадают -> одна семья 
      if (targetRoot && candidateRoot && targetRoot.id === candidateRoot.id) { 
        return true 
      } 
    } 
 
    return false 
  } 
 
  /** 
   * Определяет, является ли человек ребенком. 
   * Используется для правил сопровождения. 
   */ 
  const isChild = (person: any): boolean => { 
    if (!person) return false 
    if (person.category?.toLowerCase() === 'ребенок') return true 
    if (person.exit_category === 'small') return true 
    return false 
  } 
 
  // --- 3. ЛОГИКА ПОЕЗДКИ --- 
 
  // Простая проверка физического нахождения в одной зоне 
  const canPhysicallyJoin = (candidateStatus: LocationStatus, mainPersonStatus: LocationStatus): boolean => { 
    return candidateStatus === mainPersonStatus 
  } 
 
  /** 
   * Вычисляет список кандидатов для добавления в поездку.
   * Оптимизировано: создание карты статусов один раз. 
   */ 
  const getEligibleCompanions = ( 
    mainPerson: any,  
    currentPassengers: any[],  
    peopleList: any[],  
    journalList: any[] 
  ): any[] => { 
    // ИСПРАВЛЕНО: Добавлены пропущенные операторы ||
    if (!mainPerson || !peopleList || !peopleList.length) return [] 
 
    const mainStatus = getPersonLocationStatus(mainPerson, journalList) 
     
    // Множество ID, которые уже участвуют в поездке (Главный + Пассажиры) 
    const addedIds = new Set([mainPerson.id, ...currentPassengers.map((p: any) => p.id)]) 
 
    // Создаем карту статусов один раз для всего списка 
    const statusMap = new Map<string | number, LocationStatus>() 
    peopleList.forEach((p: any) => { 
      statusMap.set(p.id, getPersonLocationStatus(p, journalList)) 
    }) 
 
    // Фильтрация кандидатов 
    return peopleList.filter((candidate: any) => { 
      // Пропускаем уже добавленных 
      if (addedIds.has(candidate.id)) return false 
 
      const candStatus = statusMap.get(candidate.id) || 'unknown' 
       
      // Правило 1: Должны быть в одной локации 
      if (!canPhysicallyJoin(candStatus, mainStatus)) return false 
 
      // Правило 2: Если кандидат - ребенок 
      if (isChild(candidate)) { 
        // Условие: Главный ИЛИ один из пассажиров должны быть его опекуном 
        const mainIsGuardian = isValidGuardianFor(candidate, mainPerson, peopleList) 
        const passengerIsGuardian = currentPassengers.some((p: any) => isValidGuardianFor(candidate, p, peopleList)) 
 
        return mainIsGuardian || passengerIsGuardian 
      } 
 
      // Правило 3: Взрослые могут присоединиться, если они в той же локации 
      return true 
    }) 
  } 
 
  /** 
   * Валидация поездки перед стартом. 
   * Проверяет соблюдение правил сопровождения детей. 
   */ 
  const validateTrip = ( 
    mainPerson: any,  
    passengers: any[],  
    peopleList: any[],  
    journalList: any[] 
  ): { isValid: boolean; error: string | null } => { 
     
    if (!mainPerson) return { isValid: false, error: 'Не выбран человек или отсутствует ID' } 
 
    // --- Проверка: Главный - ребенок --- 
    if (isChild(mainPerson)) { 
      // Если ребенок едет один (без пассажиров), проверяем можно ли ему 
      const hasGuardianInPassengers = passengers.some((p: any) => isValidGuardianFor(mainPerson, p, peopleList)) 
       
      if (!hasGuardianInPassengers) { 
        // Строгое правило: "Маленькие" не могут выехать одни 
        if (mainPerson.exit_category === 'small') { 
          return { isValid: false, error: 'Ребенок (малыш) не может выехать без сопровождающего' } 
        } 
      } 
    } 
 
    // --- Проверка: Пассажиры - дети --- 
    const childrenInTrip = passengers.filter((p: any) => isChild(p)) 
    for (const child of childrenInTrip) { 
      // Опекуном может быть Главный или другой пассажир 
      const mainIsGuard = isValidGuardianFor(child, mainPerson, peopleList) 
       
      // ИСПРАВЛЕНО: Был пропущен аргумент peopleList в вызове isValidGuardianFor, что вызывало падение сервера
      const passIsGuard = passengers.some((p: any) => isValidGuardianFor(child, p, peopleList)) 
       
      if (!mainIsGuard && !passIsGuard) { 
        // ИСПРАВЛЕНО: Добавлены обратные кавычки для шаблонных строк
        return { isValid: false, error: `Для ${child.fio || 'ребенка'} необходим сопровождающий родственник` } 
      } 
    } 
 
    return { isValid: true, error: null } 
  } 
 
  return { 
    getPersonLocationStatus, 
    getPersonStatusText, 
    isValidGuardianFor, 
    isChild, 
    canPhysicallyJoin, 
    getEligibleCompanions, 
    validateTrip 
  } 
}