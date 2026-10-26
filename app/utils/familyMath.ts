// app/utils/familyMath.ts
// Назначение: чистая (без IndexedDB и Nuxt-импортов) логика генеалогии для
// генератора населения. useSeeder.ts превращает план семьи в записи people/vehicles.
//
// [ФИКСЫ РОДСТВЕННЫХ ОТНОШЕНИЙ] (было в useSeeder.ts до выноса):
//  1. Бабушка (Мать главы) получала отчество от имени СВОЕГО МУЖА (дедушки) —
//     получалось, что она одновременно жена и дочь дедушки. Теперь отчество
//     бабушки — от случайного имени (её собственный отец не входит в семью).
//  2. Племянник/Племянница генерировались даже БЕЗ брата/сестры главы —
//     «висящий» родственник без родителя. Теперь племянники появляются только
//     при наличии брата/сестры, отчество — от фактического родителя.
//  3. Даты рождения были полностью случайными (1940..2010): «ребёнок» из
//     категории «Ребенок» мог быть старше дедушки. Теперь возрасты связные:
//     дети 3..17 лет, каждый ребёнок моложе родителя минимум на 16 лет.
//  4. Отчество брата/сестры главы не совпадало с отчеством главы (разные отцы).
//     Теперь у сиблингов общий отец (имя из отчества главы).
//  5. Муж женщины-главы получал ЕЁ фамилию, дети — фамилию главы. Теперь муж
//     сохраняет свою фамилию, дети — фамилия и отчество фактического отца
//     (обещание GeneratorControl: «Дети (с отчеством и фамилией отца)»).
//  6. Каждый член семьи получал случайный адрес. Теперь адрес один на семью.
//  7. Ребёнок мог получить статус «Отпуск». Теперь детям — только «Болен».
//  8. Члены семьи не имели ageGroup: в симуляторе дети выглядели взрослыми.
//     Теперь ageGroup выводится из возраста (child < 18, elder >= 60).

export type SeederRand = () => number
export type AgeGroup = 'child' | 'adult' | 'elder'
export type Gender = 'male' | 'female'

// --- Справочники ---
export const MALE_NAMES = ['Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артём', 'Илья', 'Кирилл', 'Михаил', 'Олег', 'Иван', 'Петр', 'Николай', 'Игорь', 'Никита'];
export const FEMALE_NAMES = ['Анастасия', 'Мария', 'Анна', 'Виктория', 'Екатерина', 'Наталья', 'Марина', 'Полина', 'София', 'Дарья', 'Елена', 'Ольга', 'Ирина', 'Татьяна'];
export const BASE_LAST_NAMES = ['Иванов', 'Петров', 'Сидоров', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Соколов', 'Лебедев', 'Кузнецов', 'Попов', 'Смирнов', 'Орлов', 'Крылов'];
export const STREETS = ['Ленина', 'Советская', 'Мира', 'Садовая', 'Пушкина', 'Гагарина', 'Кирова', 'Заводская'];
export const CAR_BRANDS = ['Toyota Camry', 'BMW X5', 'Kia Rio', 'Hyundai Solaris', 'VAZ 2110', 'Ford Focus', 'Chevrolet Cruze', 'Renault Logan'];
// [№31-ГРУЗОВИКИ] марки грузовиков для БД-типа 'Грузовой'
export const TRUCK_BRANDS = ['ГАЗ Валдай', 'КАМАЗ Компас', 'ГАЗель NEXT', 'МАЗ Middle'];
// [ФИКС-DUPLICATED-IMPORTS] имя CAR_COLORS уже экспортирует
// utils/simulatorConstants.ts — Nuxt auto-import игнорировал второй экспорт
// с WARN «Duplicated imports». Справочник цветов БД переименован.
// [№31-ЦВЕТ] палитра расширена: названия входят в VEHICLE_COLOR_NAMES
// (simulatorConstants.ts) и корректно рендерятся в симуляторе
export const FAMILY_CAR_COLORS = ['Черный', 'Белый', 'Серебро', 'Синий', 'Красный', 'Зелёный', 'Серый', 'Голубой', 'Коричневый'];
// [№31-ГРУЗОВИКИ] доля грузовиков среди генерируемых машин — их не должно быть много
export const TRUCK_TYPE_SHARE = 0.1;

export const BASE_LOCATIONS = ['На территории', 'В городе'];

// Роли, которые дают категорию «Ребенок» (в симуляторе — зависимый, без машины)
export const KID_ROLES = ['Сын', 'Дочь', 'Внук', 'Внучка', 'Племянник', 'Племянница'];

// --- Простые хелперы с инъекцией генератора случайности (детерминизм в тестах) ---
export const pickItem = <T>(arr: readonly T[], rand: SeederRand): T =>
  arr[Math.floor(rand() * arr.length)] as T

export const randIntInclusive = (rand: SeederRand, min: number, max: number): number =>
  Math.floor(rand() * (max - min + 1)) + min

export const chanceRoll = (rand: SeederRand, probability: number): boolean =>
  rand() < probability

export const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

// --- Отчество по имени отца ---
// Исключения: имена, для которых общие правила дают неверную форму.
// Формы согласованы со словарём PATRONYMIC_TO_FATHER_MAP (тест roundtrip):
// Михаил -> Михайлович (а не «Михаилович»), Никита -> Никитична у дочерей.
const SPECIAL_PATRONYMICS: Record<string, { male: string; female: string }> = {
  'михаил': { male: 'Михайлович', female: 'Михайловна' },
  'никита': { male: 'Никитич', female: 'Никитична' },
};

export const makePatronymic = (fatherName: string, gender: Gender): string => {
  if (!fatherName) return gender === 'male' ? 'Иванович' : 'Ивановна';

  const special = SPECIAL_PATRONYMICS[fatherName.toLowerCase().trim()];
  if (special) return gender === 'male' ? special.male : special.female;

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

// --- Женская форма фамилии ---
export const makeFemaleLastName = (lastName: string): string => {
  if (lastName.endsWith('ов') || lastName.endsWith('ев') || lastName.endsWith('ин') || lastName.endsWith('ын')) {
    return lastName + 'а';
  }
  if (lastName.endsWith('ий')) {
    return lastName.slice(0, -2) + 'ая';
  }
  return lastName;
};

// --- 100% ТОЧНЫЙ СЛОВАРЬ: извлечение имени отца из отчества ---
// Жестко завязан на массив MALE_NAMES, чтобы избежать кривых алгоритмов языка.
// Используется для проверки согласованности (тесты) и ручных правок записей.
export const PATRONYMIC_TO_FATHER_MAP: Record<string, string> = {
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

export const extractFatherNameFromPatronymic = (patronymic: string): string | null => {
  if (!patronymic) return null;
  return PATRONYMIC_TO_FATHER_MAP[patronymic.toLowerCase().trim()] || null;
};

// --- Возраст <-> дата рождения ---
// Дата всегда в прошлом; месяц/день случайные (возраст может «не доехать»
// до дня рождения в текущем году — отсюда допуск +-1 в ageFromBirthDate).
export const birthDateForAge = (age: number, now: Date, rand: SeederRand): string => {
  const d = new Date(now.getFullYear() - age, randIntInclusive(rand, 0, 11), randIntInclusive(rand, 1, 28));
  if (d.getTime() > now.getTime()) d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0] ?? '';
};

export const ageFromBirthDate = (birthDate: string, now: Date): number => {
  const bd = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(bd.getTime())) return 0;
  let age = now.getFullYear() - bd.getFullYear();
  const monthDiff = now.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) age--;
  return age;
};

export const ageGroupForAge = (age: number): AgeGroup =>
  age < 18 ? 'child' : age >= 60 ? 'elder' : 'adult';

// --- Адрес и статус ---
export const generateFamilyAddress = (rand: SeederRand): string => {
  const street = pickItem(STREETS, rand);
  const house = randIntInclusive(rand, 1, 150);
  const apt = randIntInclusive(rand, 1, 200);
  return `ул. ${street}, д. ${house}, кв. ${apt}`;
};

// Временный статус с вероятностью 10%. Дети болеют, но не уходят в отпуск.
export const pickRandomStatus = (rand: SeederRand, isChild: boolean): string | null => {
  if (rand() > 0.1) return null;
  return isChild ? 'Болен' : pickItem(['Командировка', 'Отпуск', 'Болен'], rand);
};

// --- Телефон и госномер ---
export const generatePhone = (rand: SeederRand): string => {
  const prefix = pickItem(['916', '926', '977', '999'], rand);
  const part1 = String(randIntInclusive(rand, 100, 999));
  const part2 = String(randIntInclusive(rand, 10, 99));
  const part3 = String(randIntInclusive(rand, 10, 99));
  return `+7 (${prefix}) ${part1}-${part2}-${part3}`;
};

const PLATE_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'];

export const generatePlate = (rand: SeederRand, region: string | undefined): string => {
  const l1 = pickItem(PLATE_LETTERS, rand);
  const l2 = pickItem(PLATE_LETTERS, rand);
  const l3 = pickItem(PLATE_LETTERS, rand);
  const num = String(randIntInclusive(rand, 0, 999)).padStart(3, '0');
  const regionCode = region || '77';
  return `${l1.toLowerCase()}${num}${l2.toLowerCase()}${l3.toLowerCase()} ${regionCode}`;
};

// --- План члена семьи ---
export interface IFamilyMemberPlan {
  role: string
  gender: Gender
  /** Основа фамилии в мужской форме; женские формы — в personFromPlan */
  lastName: string
  firstName: string
  patronymic: string
  age: number
  birthDate: string
  ageGroup: AgeGroup
  location: string
  address: string
  status: string | null
  withVehicle: boolean
}

export interface ISeederPlanSettings {
  headIsMaleChance?: number
  headIsSeniorChance?: number
  spouseChance?: number
  parentsChance?: number
  minKids?: number
  maxKids?: number
  siblingChance?: number
  siblingSpouseChance?: number
  nephewChance?: number
  vehicleChanceAdult?: number
  vehicleChanceSenior?: number
}

export interface IFamilyPlan {
  members: IFamilyMemberPlan[]
  head: IFamilyMemberPlan
}

export interface IPlanFamilyOptions {
  familyLastName: string
  settings?: ISeederPlanSettings
  rand?: SeederRand
  now?: Date
}

/**
 * Строит связный план одной семьи: роли, полы, имена, отчества, возрасты.
 * Чистая функция — всё случайное через инъекцию rand, время через now.
 * Порядок members: Глава всегда первым (personFromPlan привязывает
 * main_family_id к его id).
 */
export const planFamilyMembers = (opts: IPlanFamilyOptions): IFamilyPlan => {
  const rand: SeederRand = opts.rand ?? Math.random
  const now: Date = opts.now ?? new Date()
  const settings = opts.settings ?? {}
  const familyLastName = opts.familyLastName

  const s = {
    headIsMaleChance: settings.headIsMaleChance ?? 0.5,
    headIsSeniorChance: settings.headIsSeniorChance ?? 0.2,
    spouseChance: settings.spouseChance ?? 0.8,
    parentsChance: settings.parentsChance ?? 0.3,
    minKids: Math.max(0, settings.minKids ?? 1),
    maxKids: Math.max(settings.minKids ?? 1, settings.maxKids ?? 3),
    siblingChance: settings.siblingChance ?? 0.3,
    siblingSpouseChance: settings.siblingSpouseChance ?? 0.5,
    nephewChance: settings.nephewChance ?? 0.3,
    vehicleChanceAdult: settings.vehicleChanceAdult ?? 0.7,
    vehicleChanceSenior: settings.vehicleChanceSenior ?? 0.3,
  }

  const chance = (p: number) => chanceRoll(rand, p)
  const pickMaleName = () => pickItem(MALE_NAMES, rand)
  const pickFemaleName = () => pickItem(FEMALE_NAMES, rand)
  const familyLocation = pickItem(BASE_LOCATIONS, rand)
  const familyAddress = generateFamilyAddress(rand)

  const buildMember = (
    role: string,
    gender: Gender,
    lastName: string,
    fatherName: string | null,
    firstName: string | null,
    age: number,
    withVehicle: boolean,
    isChildRole: boolean
  ): IFamilyMemberPlan => ({
    role,
    gender,
    lastName,
    firstName: firstName || (gender === 'male' ? pickMaleName() : pickFemaleName()),
    patronymic: makePatronymic(fatherName || pickMaleName(), gender),
    age,
    birthDate: birthDateForAge(age, now, rand),
    ageGroup: ageGroupForAge(age),
    location: familyLocation,
    address: familyAddress,
    status: pickRandomStatus(rand, isChildRole),
    withVehicle,
  })

  const members: IFamilyMemberPlan[] = []

  // --- 1. Глава семьи ---
  const isHeadMale = chance(s.headIsMaleChance)
  const isSeniorHead = chance(s.headIsSeniorChance)
  const headAge = isSeniorHead ? randIntInclusive(rand, 60, 78) : randIntInclusive(rand, 24, 55)
  const headGender: Gender = isHeadMale ? 'male' : 'female'
  // Имя отца главы (дедушки). Из него же образуются отчества главы и его
  // братьев/сестёр — у сиблингов общий отец.
  const headFatherName = pickMaleName()

  const head = buildMember(
    'Глава', headGender, familyLastName, headFatherName, null, headAge,
    chance(isSeniorHead ? s.vehicleChanceSenior : s.vehicleChanceAdult), false
  )
  members.push(head)

  // Фактический отец детей: мужчина-глава либо муж женщины-главы.
  let fatherFirstName: string | null = isHeadMale ? head.firstName : null
  let fatherLastName: string | null = isHeadMale ? familyLastName : null
  let fatherAge: number | null = isHeadMale ? headAge : null

  // --- 2. Супруг(а) ---
  if (chance(s.spouseChance)) {
    if (isHeadMale) {
      // Жена берёт фамилию мужа; её собственный отец не входит в семью,
      // поэтому отчество — от случайного имени.
      const spouseAge = clampInt(headAge + randIntInclusive(rand, -4, 4), 18, 80)
      const spouse = buildMember(
        'Жена', 'female', familyLastName, null, null, spouseAge,
        chance(s.vehicleChanceAdult), false
      )
      members.push(spouse)
    } else {
      // Муж женщины-главы сохраняет СВОЮ фамилию (раньше получал её фамилию);
      // дети будут с его фамилией и отчеством.
      const otherSurname = pickItem(
        BASE_LAST_NAMES.filter(ln => ln !== familyLastName), rand
      )
      const spouseAge = clampInt(headAge + randIntInclusive(rand, -4, 4), 24, 80)
      const spouse = buildMember(
        'Муж', 'male', otherSurname, null, null, spouseAge,
        chance(s.vehicleChanceAdult), false
      )
      members.push(spouse)
      fatherFirstName = spouse.firstName
      fatherLastName = otherSurname
      fatherAge = spouseAge
    }
  }

  // --- 3. Родители главы (дедушка и бабушка) ---
  if (!isSeniorHead && chance(s.parentsChance)) {
    const fatherAgeValue = clampInt(headAge + randIntInclusive(rand, 20, 38), 20, 88)
    // Имя дедушки согласовано с отчеством главы (общий отец).
    const grandfather = buildMember(
      'Отец', 'male', familyLastName, null, headFatherName, fatherAgeValue,
      chance(s.vehicleChanceSenior), false
    )
    // [ФИКС] Отчество бабушки — от ЕЁ отца (случайное имя), а не от имени мужа:
    // раньше бабушка становилась «дочерью» собственного мужа. Имя берём отличное
    // от имени дедушки, чтобы даже случайно не выглядеть его «дочерью».
    const grandmotherFatherName = pickItem(
      MALE_NAMES.filter(n => n !== headFatherName), rand
    )
    const grandmotherAge = clampInt(headAge + randIntInclusive(rand, 20, 38), 20, 88)
    const grandmother = buildMember(
      'Мать', 'female', familyLastName, grandmotherFatherName, null, grandmotherAge,
      chance(s.vehicleChanceSenior), false
    )
    members.push(grandfather, grandmother)
  }

  // --- 4. Дети (Сын/Дочь) ---
  const kidsCount = randIntInclusive(rand, s.minKids, s.maxKids)
  const kidMaxAge = fatherAge !== null
    ? Math.min(17, fatherAge - 19)
    : Math.min(17, headAge - 18)
  for (let k = 0; k < kidsCount; k++) {
    const isBoy = rand() > 0.5
    const kidAge = randIntInclusive(rand, 3, Math.max(3, kidMaxAge))
    const kid = buildMember(
      isBoy ? 'Сын' : 'Дочь',
      isBoy ? 'male' : 'female',
      // Фамилия отца, если он есть; иначе фамилия матери
      fatherLastName || familyLastName,
      fatherFirstName,
      null,
      kidAge,
      false, // дети без машины
      true
    )
    members.push(kid)
  }

  // --- 5. Брат/Сестра главы (общий отец — общее отчество) ---
  let sibling: IFamilyMemberPlan | null = null
  let siblingSpouse: IFamilyMemberPlan | null = null
  if (chance(s.siblingChance)) {
    const isBrother = rand() > 0.5
    const siblingAge = clampInt(headAge + randIntInclusive(rand, -8, 8), 22, 70)
    sibling = buildMember(
      isBrother ? 'Брат' : 'Сестра',
      isBrother ? 'male' : 'female',
      familyLastName,
      // [ФИКС] Общий отец с главой — то же имя, из которого образовано
      // отчество главы (раньше отчество сиблинга было случайным).
      headFatherName,
      null,
      siblingAge,
      chance(s.vehicleChanceAdult),
      false
    )
    members.push(sibling)

    // --- 5a. Супруг(а) брата/сестры ---
    if (chance(s.siblingSpouseChance)) {
      if (isBrother) {
        // Невестка — жена брата, фамилия мужа
        const spAge = clampInt(siblingAge + randIntInclusive(rand, -5, 5), 18, 75)
        siblingSpouse = buildMember(
          'Невестка', 'female', familyLastName, null, null, spAge,
          chance(s.vehicleChanceAdult), false
        )
      } else {
        // Зять — муж сестры, своя фамилия; возраст близок к возрасту сестры,
        // но не сильно младше (он будет отцом племянников)
        const otherSurname = pickItem(
          BASE_LAST_NAMES.filter(ln => ln !== familyLastName), rand
        )
        const spAge = clampInt(siblingAge + randIntInclusive(rand, -2, 8), 18, 75)
        siblingSpouse = buildMember(
          'Зять', 'male', otherSurname, null, null, spAge,
          chance(s.vehicleChanceAdult), false
        )
      }
      members.push(siblingSpouse)
    }
  }

  // --- 6. Племянник/Племянница ---
  // [ФИКС] Только при наличии брата/сестры: у племянника должен быть родитель.
  if (sibling && chance(s.nephewChance)) {
    const isBoy = rand() > 0.5
    const siblingIsBrother = sibling.gender === 'male'
    // Отец племянника: брат главы либо муж сестры (если сестра замужем)
    const nephewFather = siblingIsBrother
      ? sibling
      : (siblingSpouse && siblingSpouse.role === 'Зять' ? siblingSpouse : null)
    // Возраст от фактического отца: моложе минимум на 19 лет; если отец слишком
    // молод (максимум < 3 лет) — племянника не генерируем вовсе.
    const fatherAgeForNephew = nephewFather ? nephewFather.age : sibling.age
    const nephewMaxAge = Math.min(17, fatherAgeForNephew - 19)
    if (nephewMaxAge >= 3) {
      const nephew = buildMember(
        isBoy ? 'Племянник' : 'Племянница',
        isBoy ? 'male' : 'female',
        nephewFather ? nephewFather.lastName : familyLastName,
        nephewFather ? nephewFather.firstName : null,
        null,
        randIntInclusive(rand, 3, nephewMaxAge),
        false,
        true
      )
      members.push(nephew)
    }
  }

  return { members, head }
}

// --- Запись человека по плану (чистая, без IndexedDB) ---
export interface IPersonRecord {
  id: number
  fio: string
  name: string
  first_name: string
  last_name: string
  patronymic: string
  gender: Gender
  relation: string
  category: string
  ageGroup: AgeGroup
  age: number
  birth_date: string
  phone: string
  address: string
  location: string
  status: string | null
  [key: string]: unknown
}

export interface IVehicleRecord {
  plate: string
  brand: string
  model: string
  color: string
  owner_id: number
  owner_name: string
  is_primary: boolean
  type: string
}

export const personFromPlan = (
  plan: IFamilyMemberPlan,
  id: number,
  region: string | undefined = undefined,
  rand: SeederRand = Math.random
): { person: IPersonRecord; vehicle: IVehicleRecord | null } => {
  const personLastName = plan.gender === 'female' ? makeFemaleLastName(plan.lastName) : plan.lastName
  const fio = `${personLastName} ${plan.firstName} ${plan.patronymic}`

  const person: IPersonRecord = {
    id,
    fio,
    name: plan.firstName,
    first_name: plan.firstName,
    last_name: personLastName,
    patronymic: plan.patronymic,
    gender: plan.gender,
    relation: plan.role,
    category: KID_ROLES.includes(plan.role) ? 'Ребенок' : 'Член семьи',
    ageGroup: plan.ageGroup,
    age: plan.age,
    birth_date: plan.birthDate,
    phone: generatePhone(rand),
    address: plan.address,
    location: plan.location,
    status: plan.status,
  }

  let vehicle: IVehicleRecord | null = null
  if (plan.withVehicle) {
    // [№31-ГРУЗОВИКИ] небольшая доля машин — грузовые (везут только водителя)
    const isTruck = rand() < TRUCK_TYPE_SHARE
    const brand = isTruck ? pickItem(TRUCK_BRANDS, rand) : pickItem(CAR_BRANDS, rand)
    vehicle = {
      plate: generatePlate(rand, region),
      brand,
      model: brand.split(' ')[1] || '',
      color: pickItem(FAMILY_CAR_COLORS, rand),
      owner_id: id,
      owner_name: fio,
      is_primary: true,
      type: isTruck ? 'Грузовой' : 'Личный'
    }
  }

  return { person, vehicle }
}
