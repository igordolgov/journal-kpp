// app/composables/useSeeder.ts
// Назначение: генератор тестовой популяции (семьи + транспорт) в IndexedDB.
//
// [РЕФАКТОРИНГ v4] Генеалогия вынесена в чистый модуль app/utils/familyMath.ts
// (planFamilyMembers + personFromPlan): план семьи строится и проверяется
// юнит-тестами без IndexedDB. Заодно исправлена логика родственных отношений:
//  - у бабушки (Мать главы) больше не отчество мужа (она не «дочь» дедушки);
//  - племянники появляются только при наличии брата/сестры, отчество — от
//    фактического родителя;
//  - связные возрасты (ребенок 3..17 лет и моложе родителя на 16+ лет),
//    ageGroup выводится из возраста (дети в симуляторе выглядят детьми);
//  - у сиблингов общий отец (совпадают отчества);
//  - муж женщины-главы сохраняет свою фамилию, дети — фамилия и отчество отца;
//  - адрес один на семью; детям не назначается статус «Отпуск».
//
// [ИСПРАВЛЕНО v3]: типизированный возврат generatePopulation, non-null
// assertions на непустых справочниках, settings как Partial<ISederConfig>.

import { useDatabase } from './useDatabase'
import { useConfig } from './useConfig'
import type { ISederConfig } from './useConfig'
import {
  BASE_LAST_NAMES,
  planFamilyMembers,
  personFromPlan,
} from '../utils/familyMath'

export const useSeeder = () => {

  const { getDb, clearStore } = useDatabase()
  const configStore = useConfig()

  // [ИСПРАВЛЕНО] явный тип возврата — потребители больше не видят 'unknown'
  const generatePopulation = async (familiesCount: number = 1, clearBefore: boolean = true): Promise<{ success: boolean; count: number }> => {
    console.log(`[Seeder] Запуск генерации. Семей: ${familiesCount}`);

    let db: IDBDatabase;
    try {
      db = await getDb();
    } catch (e) {
      console.error('[Seeder] Ошибка подключения к БД', e);
      return { success: false, count: 0 };
    }

    // [ИСПРАВЛЕНО] типизированные настройки генератора
    const settings: Partial<ISederConfig> = configStore.config.value.seeder ?? {};

    const allPeople: any[] = [];
    const allVehicles: any[] = [];
    let currentId = 1;

    if (clearBefore) {
      try {
        await clearStore('people');
        await clearStore('vehicles');
        await clearStore('journal');
        console.log('[Seeder] Таблицы очищены');
      } catch (e) {
        console.error('[Seeder] Ошибка очистки', e);
      }
    }

    const shuffledLastNames = [...BASE_LAST_NAMES].sort(() => Math.random() - 0.5);

    while (shuffledLastNames.length < familiesCount) {
      shuffledLastNames.push(...BASE_LAST_NAMES);
    }

    for (let f = 0; f < familiesCount; f++) {
      // [ИСПРАВЛЕНО] while выше гарантирует длину; f < familiesCount — элемент существует
      const familyLastName = shuffledLastNames[f]!;

      // Связный план семьи: роли, полы, отчества, возрасты, адрес (см. familyMath)
      const plan = planFamilyMembers({ familyLastName, settings });
      const headId = currentId;

      for (const memberPlan of plan.members) {
        const isHead = memberPlan.role === 'Глава';
        const { person, vehicle } = personFromPlan(
          memberPlan,
          currentId++,
          settings.vehicleRegionCode
        );
        person.main_family_id = isHead ? null : headId;
        allPeople.push(person);
        if (vehicle) allVehicles.push(vehicle);
      }
    }

    // Запись
    // [ИСПРАВЛЕНО] тип-параметр промиса — без него весь возврат был unknown
    return new Promise<{ success: boolean; count: number }>((resolve) => {
      try {
        const storeNames = ['people', 'vehicles'];
        const transaction = db.transaction(storeNames, 'readwrite');

        const peopleStore = transaction.objectStore('people');
        const vehiclesStore = transaction.objectStore('vehicles');

        allPeople.forEach(person => {
          peopleStore.add(person);
        });

        allVehicles.forEach(vehicle => {
          vehiclesStore.add(vehicle);
        });

        transaction.oncomplete = () => {
          console.log(`[Seeder] Успешно сохранено ${allPeople.length} людей и ${allVehicles.length} машин`);
          resolve({ success: true, count: allPeople.length });
        };

        transaction.onerror = () => {
          console.error('[Seeder] Ошибка транзакции', transaction.error);
          resolve({ success: false, count: 0 });
        };
      } catch (e) {
        console.error('[Seeder] Критическая ошибка записи', e);
        resolve({ success: false, count: 0 });
      }
    });
  };

  return {
    generatePopulation
  };
};
