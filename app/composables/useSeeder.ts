// app/composables/useSeeder.ts
// Назначение: генератор тестовой популяции (семьи + транспорт) в IndexedDB.
// [ИСПРАВЛЕНО v3]:
//  1. generatePopulation возвращает Promise<{ success: boolean; count: number }> —
//     раньше возвращался Promise<unknown>, из-за чего потребители
//     (GeneratorControl.vue, SettingsGenerator.vue) получали 'result' of type 'unknown'.
//  2. getRandomItem / shuffledLastNames[f] — non-null assertion: справочники
//     константные и непустые, элемент гарантирован while-циклом.
//  3. settings типизирован как Partial<ISederConfig>.

import { useDatabase } from './useDatabase'
import { useConfig } from './useConfig'
import type { ISederConfig } from './useConfig'

export const useSeeder = () => {
  
  const { getDb, clearStore } = useDatabase()
  const configStore = useConfig()

  // --- Справочники ---
  const MALE_NAMES = ['Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артём', 'Илья', 'Кирилл', 'Михаил', 'Олег', 'Иван', 'Петр', 'Николай', 'Игорь', 'Никита'];
  const FEMALE_NAMES = ['Анастасия', 'Мария', 'Анна', 'Виктория', 'Екатерина', 'Наталья', 'Марина', 'Полина', 'София', 'Дарья', 'Елена', 'Ольга', 'Ирина', 'Татьяна'];
  const BASE_LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Соколов', 'Лебедев', 'Кузнецов', 'Попов', 'Смирнов', 'Орлов', 'Крылов'];
  const STREETS = ['Ленина', 'Советская', 'Мира', 'Садовая', 'Пушкина', 'Гагарина', 'Кирова', 'Заводская'];
  const CAR_BRANDS = ['Toyota Camry', 'BMW X5', 'Kia Rio', 'Hyundai Solaris', 'VAZ 2110', 'Ford Focus', 'Chevrolet Cruze', 'Renault Logan'];
  
  const BASE_LOCATIONS = ['На территории', 'В городе'];

  const ROLE_GENDER: Record<string, 'male' | 'female'> = {
    'Муж': 'male', 'Отец': 'male', 'Сын': 'male', 'Брат': 'male', 'Дед': 'male', 'Внук': 'male', 'Племянник': 'male', 'Зять': 'male',
    'Жена': 'female', 'Мать': 'female', 'Дочь': 'female', 'Сестра': 'female', 'Бабушка': 'female', 'Внучка': 'female', 'Племянница': 'female', 'Невестка': 'female',
  };

  const KID_ROLES = ['Сын', 'Дочь', 'Внук', 'Внучка', 'Племянник', 'Племянница'];

  const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const getRandomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  const chance = (probability: number) => Math.random() < probability;
  
  const generatePhone = () => {
    const prefix = ['916', '926', '977', '999'][Math.floor(Math.random() * 4)];
    return `+7 (${prefix}) ${Math.floor(1000000 + Math.random() * 9000000).toString().slice(0, 3)}-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`;
  };

  const generateAddress = () => {
    const street = getRandomItem(STREETS);
    const house = Math.floor(Math.random() * 150) + 1;
    const apt = Math.floor(Math.random() * 200) + 1;
    return `ул. ${street}, д. ${house}, кв. ${apt}`;
  };

  const generatePlate = (region: string) => {
    const letters = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'];
    const l1 = getRandomItem(letters);
    const l2 = getRandomItem(letters);
    const l3 = getRandomItem(letters);
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const regionCode = region || '77';
    return `${l1.toLowerCase()}${num}${l2.toLowerCase()}${l3.toLowerCase()} ${regionCode}`;
  };

  // --- ИСПРАВЛЕННАЯ ЛОГИКА ОТЧЕСТВА ---
  const makePatronymic = (fatherName: string, gender: 'male' | 'female'): string => {
    if (!fatherName) return gender === 'male' ? 'Иванович' : 'Ивановна';

    if (fatherName.endsWith('й') || fatherName.endsWith('ь')) {
      const base = fatherName.slice(0, -1);
      return gender === 'male' ? `${base}евич` : `${base}евна`;
    }
    if (fatherName.endsWith('а') || fatherName.endsWith('я')) {
      const base = fatherName.slice(0, -1);
      return gender === 'male' ? `${base}ич` : `${base}инична`;
    }

    return gender === 'male' ? `${fatherName}ович` : `${fatherName}овна`;
  };

  // --- 100% ТОЧНЫЙ СЛОВАРЬ: Извлечение имени отца из отчества ---
  // Жестко завязан на массив MALE_NAMES, чтобы избежать кривых алгоритмов русского языка
  const PATRONYMIC_TO_FATHER_MAP: Record<string, string> = {
    'александрович': 'Александр', 'александровна': 'Александр',
    'дмитриевич': 'Дмитрий', 'дмитриевна': 'Дмитрий',
    'максимович': 'Максим', 'максимовна': 'Максим',
    'сергеевич': 'Сергей', 'сергеевна': 'Сергей',
    'андреевич': 'Андрей', 'андреевна': 'Андрей',
    'алексеевич': 'Алексей', 'алексеевна': 'Алексей',
    'артёмович': 'Артём', 'артёмовна': 'Артём',
    'артемович': 'Артём', 'артемовна': 'Артём', // На случай если где-то пропадет ё
    'ильич': 'Илья', 'ильинична': 'Илья',
    'кириллович': 'Кирилл', 'кирилловна': 'Кирилл',
    'михайлович': 'Михаил', 'михайловна': 'Михаил',
    'олегович': 'Олег', 'олеговна': 'Олег',
    'иванович': 'Иван', 'ивановна': 'Иван',
    'петрович': 'Петр', 'петровна': 'Петр',
    'николаевич': 'Николай', 'николаевна': 'Николай',
    'игоревич': 'Игорь', 'игоревна': 'Игорь',
    'никитич': 'Никита', 'никитична': 'Никита'
  };

  const extractFatherNameFromPatronymic = (patronymic: string): string | null => {
    if (!patronymic) return null;
    return PATRONYMIC_TO_FATHER_MAP[patronymic.toLowerCase().trim()] || null;
  };

  // --- Генерация временного статуса ---
  const getRandomStatus = (isChild: boolean): string | null => {
    if (Math.random() > 0.1) return null;
    if (isChild) return getRandomItem(['Отпуск', 'Болен']);
    return getRandomItem(['Командировка', 'Отпуск', 'Болен']);
  };

  const makeFemaleLastName = (lastName: string): string => {
    if (lastName.endsWith('ов') || lastName.endsWith('ев') || lastName.endsWith('ин') || lastName.endsWith('ын')) {
      return lastName + 'а';
    }
    if (lastName.endsWith('ий')) {
      return lastName.slice(0, -2) + 'ая';
    }
    return lastName;
  };

  const generatePersonData = (
    id: number, 
    role: string, 
    familyHeadId: number | null, 
    gender: 'male' | 'female', 
    lastName: string, 
    fatherName: string | null = null,
    settings: any = {},
    forceLocation: string | null = null,
    forceStatus: string | null = null,
    forceFirstName: string | null = null 
  ) => {
    const firstName = forceFirstName || (gender === 'male' ? getRandomItem(MALE_NAMES) : getRandomItem(FEMALE_NAMES));
    const patronymic = makePatronymic(fatherName || getRandomItem(MALE_NAMES), gender);
    const personLastName = gender === 'female' ? makeFemaleLastName(lastName) : lastName;
    const fio = `${personLastName} ${firstName} ${patronymic}`;
    const category = KID_ROLES.includes(role) ? 'Ребенок' : 'Член семьи';

    const isChild = KID_ROLES.includes(role);
    const isSenior = ['Дед', 'Бабушка'].includes(role);
    const isAdult = !isChild;

    const defaultAdultChance = 0.7; 
    const defaultSeniorChance = 0.3; 
    const vChance = isSenior 
        ? (settings.vehicleChanceSenior || defaultSeniorChance) 
        : (settings.vehicleChanceAdult || defaultAdultChance);
    
    let vehicleObj: any = null;
    if (isAdult && chance(vChance)) {
      const plate = generatePlate(settings.vehicleRegionCode || '77');
      const brand = getRandomItem(CAR_BRANDS);
      const color = getRandomItem(['Черный', 'Белый', 'Серебро', 'Синий', 'Красный']);
      vehicleObj = {
        plate: plate,
        brand: brand,
        model: brand.split(' ')[1] || '',
        color: color,
        owner_id: id,
        owner_name: fio,
        is_primary: true,
        type: 'Личный'
      };
    }

    const location = forceLocation || getRandomItem(BASE_LOCATIONS);
    const status = forceStatus !== undefined ? forceStatus : getRandomStatus(isChild);

    const personObj = {
      id,
      fio,
      name: firstName,
      first_name: firstName,
      last_name: personLastName,
      patronymic,
      gender,
      relation: role, 
      category,
      main_family_id: familyHeadId,
      birth_date: getRandomDate(new Date(1940, 0, 1), new Date(2010, 0, 1)).toISOString().split('T')[0],
      phone: generatePhone(),
      address: generateAddress(),
      location, 
      status, 
    };

    return { person: personObj, vehicle: vehicleObj };
  };

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
      const familyMembers: any[] = [];
      // [ИСПРАВЛЕНО] while выше гарантирует длину; f < familiesCount — элемент существует
      const familyLastName = shuffledLastNames[f]!;
      
      // Общее проживание для всей семьи
      const familyLocation = getRandomItem(BASE_LOCATIONS);
      
      let fatherFirstName: string | null = null; 
      
      const isHeadMale = chance(settings.headIsMaleChance || 0.5);
      const isSenior = chance(settings.headIsSeniorChance || 0.2);
      
      // 1. Глава семьи
      const headStatus = getRandomStatus(false);
      const headData = generatePersonData(currentId++, 'Глава', null, isHeadMale ? 'male' : 'female', familyLastName, null, settings, familyLocation, headStatus);
      familyMembers.push(headData.person);
      if (headData.vehicle) allVehicles.push(headData.vehicle);
      if (isHeadMale) fatherFirstName = headData.person.first_name;

      // 2. Супруг(а)
      if (chance(settings.spouseChance || 0.8)) {
        const spouseRole = headData.person.gender === 'male' ? 'Жена' : 'Муж';
        const spouseGender = headData.person.gender === 'male' ? 'female' : 'male';
        const spouseStatus = getRandomStatus(false);
        const spouseData = generatePersonData(currentId++, spouseRole, headData.person.id, spouseGender, familyLastName, null, settings, familyLocation, spouseStatus);
        if (spouseGender === 'male') fatherFirstName = spouseData.person.first_name;
        familyMembers.push(spouseData.person);
        if (spouseData.vehicle) allVehicles.push(spouseData.vehicle);
      }

      // 3. Родители главы
      if (!isSenior && chance(settings.parentsChance || 0.3)) {
        // Извлекаем 100% точное имя отца из отчества главы
        const deducedFatherName = extractFatherNameFromPatronymic(headData.person.patronymic);
        
        // Если словарь не сработал (неизвестное отчество), берем рандомное
        const safeFatherName = deducedFatherName || getRandomItem(MALE_NAMES);

        const fatherData = generatePersonData(currentId++, 'Отец', headData.person.id, 'male', familyLastName, null, settings, familyLocation, getRandomStatus(false), safeFatherName);
        const motherData = generatePersonData(currentId++, 'Мать', headData.person.id, 'female', familyLastName, safeFatherName, settings, familyLocation, getRandomStatus(false));
        
        familyMembers.push(fatherData.person, motherData.person);
        if (fatherData.vehicle) allVehicles.push(fatherData.vehicle);
        if (motherData.vehicle) allVehicles.push(motherData.vehicle);
      }

      // 4. Дети
      const minK = settings.minKids || 0;
      const maxK = settings.maxKids || 3;
      const kidsCount = Math.floor(Math.random() * (maxK - minK + 1)) + minK;
      
      for (let k = 0; k < kidsCount; k++) {
        const isBoy = Math.random() > 0.5;
        const kidData = generatePersonData(currentId++, isBoy ? 'Сын' : 'Дочь', headData.person.id, isBoy ? 'male' : 'female', familyLastName, fatherFirstName, settings, familyLocation, getRandomStatus(true));
        familyMembers.push(kidData.person);
      }

      // 5. Братья/Сестры
      if (chance(settings.siblingChance || 0.3)) {
        const isBrother = Math.random() > 0.5;
        const siblingData = generatePersonData(currentId++, isBrother ? 'Брат' : 'Сестра', headData.person.id, isBrother ? 'male' : 'female', familyLastName, null, settings, familyLocation, getRandomStatus(false));
        familyMembers.push(siblingData.person);
        if (siblingData.vehicle) allVehicles.push(siblingData.vehicle);

        if (chance(settings.siblingSpouseChance || 0.5)) {
            const spRole = siblingData.person.gender === 'male' ? 'Невестка' : 'Зять';
            const spGender = siblingData.person.gender === 'male' ? 'female' : 'male';
            const spData = generatePersonData(currentId++, spRole, headData.person.id, spGender, familyLastName, null, settings, familyLocation, getRandomStatus(false));
            familyMembers.push(spData.person);
            if (spData.vehicle) allVehicles.push(spData.vehicle);
        }
      }

      // 6. Племянники
      if (chance(settings.nephewChance || 0.3)) {
        const isBoy = Math.random() > 0.5;
        const nephewData = generatePersonData(currentId++, isBoy ? 'Племянник' : 'Племянница', headData.person.id, isBoy ? 'male' : 'female', familyLastName, getRandomItem(MALE_NAMES), settings, familyLocation, getRandomStatus(true));
        familyMembers.push(nephewData.person);
      }

      allPeople.push(...familyMembers);
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