// tests/family-math.test.ts
// Назначение: юнит-тесты генеалогии генератора населения (app/utils/familyMath.ts).
// Проверяют связность семьи: отчества, возрасты, фамилии, адреса, роли.
// Всё детерминировано: ГПСЧ mulberry32 + фиксированная дата NOW.

import { describe, it, expect } from 'vitest'
import {
  planFamilyMembers,
  personFromPlan,
  makePatronymic,
  makeFemaleLastName,
  extractFatherNameFromPatronymic,
  ageFromBirthDate,
  MALE_NAMES,
  BASE_LAST_NAMES,
  KID_ROLES,
  type IFamilyMemberPlan,
  type IFamilyPlan,
  type ISeederPlanSettings,
} from '~/utils/familyMath'

// --- Детерминированный ГПСЧ (mulberry32) ---
const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOW = new Date('2026-10-20T12:00:00')

const buildFamily = (
  seed: number,
  settings: ISeederPlanSettings = {},
  familyLastName: string = BASE_LAST_NAMES[seed % BASE_LAST_NAMES.length]!
): IFamilyPlan =>
  planFamilyMembers({ familyLastName, settings, rand: mulberry32(seed), now: NOW })

const buildFamilies = (
  count: number,
  settings: ISeederPlanSettings = {},
  baseSeed = 1000
): IFamilyPlan[] =>
  Array.from({ length: count }, (_, i) => buildFamily(baseSeed + i, settings))

const isKidRole = (m: IFamilyMemberPlan) => KID_ROLES.includes(m.role)
// Дети главы (племянники — дети сиблинга, их связи проверяет отдельный тест)
const isDirectKid = (m: IFamilyMemberPlan) => m.role === 'Сын' || m.role === 'Дочь'
const kidsOf = (plan: IFamilyPlan) => plan.members.filter(isKidRole)
const directKidsOf = (plan: IFamilyPlan) => plan.members.filter(isDirectKid)
const adultMalesOf = (plan: IFamilyPlan) =>
  plan.members.filter(m => m.gender === 'male' && m.age >= 18)

const MALE_ROLES = ['Муж', 'Отец', 'Сын', 'Брат', 'Внук', 'Племянник', 'Зять']
const FEMALE_ROLES = ['Жена', 'Мать', 'Дочь', 'Сестра', 'Внучка', 'Племянница', 'Невестка']

// ============================================================
// 1. Отчества
// ============================================================
describe('makePatronymic / словарь отцов', () => {
  it('полный roundtrip: отчество каждого имени из справочника восстанавливает имя отца', () => {
    for (const name of MALE_NAMES) {
      expect(extractFatherNameFromPatronymic(makePatronymic(name, 'male'))).toBe(name)
      expect(extractFatherNameFromPatronymic(makePatronymic(name, 'female'))).toBe(name)
    }
  })

  it('особые случаи русского языка', () => {
    expect(makePatronymic('Илья', 'male')).toBe('Ильич')
    expect(makePatronymic('Илья', 'female')).toBe('Ильинична')
    expect(makePatronymic('Никита', 'male')).toBe('Никитич')
    expect(makePatronymic('Никита', 'female')).toBe('Никитична')
    expect(makePatronymic('Сергей', 'male')).toBe('Сергеевич')
    expect(makePatronymic('Сергей', 'female')).toBe('Сергеевна')
    expect(makePatronymic('Артём', 'male')).toBe('Артёмович')
    expect(makePatronymic('', 'male')).toBe('Иванович')
    expect(makePatronymic('', 'female')).toBe('Ивановна')
  })

  it('женская форма фамилии', () => {
    expect(makeFemaleLastName('Иванов')).toBe('Иванова')
    expect(makeFemaleLastName('Крылов')).toBe('Крылова')
    expect(makeFemaleLastName('Морский')).toBe('Морская')
    expect(makeFemaleLastName('Иванова')).toBe('Иванова')
  })
})

// ============================================================
// 2. Структура семьи
// ============================================================
describe('структура семьи', () => {
  const plans = buildFamilies(200)

  it('ровно одна Глава, и она первая в списке', () => {
    for (const plan of plans) {
      expect(plan.members[0]).toBe(plan.head)
      expect(plan.head.role).toBe('Глава')
      expect(plan.members.filter(m => m.role === 'Глава').length).toBe(1)
    }
  })

  it('пол соответствует роли', () => {
    for (const plan of plans) {
      for (const m of plan.members) {
        if (MALE_ROLES.includes(m.role)) expect(m.gender).toBe('male')
        if (FEMALE_ROLES.includes(m.role)) expect(m.gender).toBe('female')
      }
    }
  })

  it('супруг(а) соответствует полу главы', () => {
    for (const plan of plans) {
      const spouse = plan.members.find(m => m.role === 'Жена' || m.role === 'Муж')
      if (spouse) {
        if (spouse.role === 'Жена') {
          expect(plan.head.gender).toBe('male')
          expect(spouse.gender).toBe('female')
          // Жена берёт фамилию мужа
          expect(spouse.lastName).toBe(plan.head.lastName)
        } else {
          expect(plan.head.gender).toBe('female')
          expect(spouse.gender).toBe('male')
        }
        // Возраст супругов близкий
        expect(Math.abs(spouse.age - plan.head.age)).toBeLessThanOrEqual(8)
      }
    }
  })
})

// ============================================================
// 3. Отчества внутри семьи — ядро родственных отношений
// ============================================================
describe('отчества и родители', () => {
  const plans = buildFamilies(200)

  // Назначенный отец детей главы: мужчина-глава либо её муж. Если нет обоих —
  // отец неизвестен, отчество случайное (мать-одиночка), проверку пропускаем.
  const designatedFatherOf = (plan: IFamilyPlan): IFamilyMemberPlan | undefined =>
    plan.head.gender === 'male'
      ? plan.head
      : plan.members.find(m => m.role === 'Муж')

  it('у каждого ребёнка главы отчество образовано от имени его отца (глава-мужчина или муж главы)', () => {
    for (const plan of plans) {
      const father = designatedFatherOf(plan)
      if (!father) continue
      for (const kid of directKidsOf(plan)) {
        expect(extractFatherNameFromPatronymic(kid.patronymic)).toBe(father.firstName)
      }
    }
  })

  it('ребёнок главы моложе своего отца минимум на 16 лет', () => {
    for (const plan of plans) {
      const father = designatedFatherOf(plan)
      if (!father) continue
      for (const kid of directKidsOf(plan)) {
        expect(father.age - kid.age).toBeGreaterThanOrEqual(16)
      }
    }
  })

  it('РЕГРЕСС: бабушка (Мать главы) не является «дочерью» дедушки (Отец главы)', () => {
    let checked = 0
    for (const plan of plans) {
      const grandfather = plan.members.find(m => m.role === 'Отец')
      const grandmother = plan.members.find(m => m.role === 'Мать')
      if (!grandfather || !grandmother) continue
      checked++
      // Раньше отчество бабушки строилось из имени её мужа
      expect(grandmother.patronymic).not.toBe(makePatronymic(grandfather.firstName, 'female'))
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('у брата/сестры главы тот же отец, что у главы (совпадает имя из отчества)', () => {
    for (const plan of plans) {
      const sibling = plan.members.find(m => m.role === 'Брат' || m.role === 'Сестра')
      if (!sibling) continue
      expect(extractFatherNameFromPatronymic(sibling.patronymic))
        .toBe(extractFatherNameFromPatronymic(plan.head.patronymic))
    }
  })

  it('РЕГРЕСС: племянник существует только при наличии брата/сестры', () => {
    for (const plan of plans) {
      const nephew = plan.members.find(m => m.role === 'Племянник' || m.role === 'Племянница')
      const sibling = plan.members.find(m => m.role === 'Брат' || m.role === 'Сестра')
      if (nephew) expect(sibling).toBeDefined()
      if (!sibling) expect(nephew).toBeUndefined()
    }
  })

  it('отчество племянника образовано от имени его родителя (брат либо муж сестры)', () => {
    for (const plan of plans) {
      const sibling = plan.members.find(m => m.role === 'Брат' || m.role === 'Сестра')
      const nephew = plan.members.find(m => m.role === 'Племянник' || m.role === 'Племянница')
      if (!nephew || !sibling) continue
      const fatherName = extractFatherNameFromPatronymic(nephew.patronymic)
      expect(fatherName).not.toBeNull()
      if (sibling.gender === 'male') {
        expect(fatherName).toBe(sibling.firstName)
      } else {
        // Сестра: отец — её муж (Зять), либо отец неизвестен (случайное отчество)
        const zyat = plan.members.find(m => m.role === 'Зять')
        if (zyat) expect(fatherName).toBe(zyat.firstName)
      }
    }
  })

  it('Невестка есть только у брата, Зять — только у сестры', () => {
    for (const plan of plans) {
      const nev = plan.members.find(m => m.role === 'Невестка')
      const zyat = plan.members.find(m => m.role === 'Зять')
      const brother = plan.members.find(m => m.role === 'Брат')
      const sister = plan.members.find(m => m.role === 'Сестра')
      if (nev) expect(brother?.gender).toBe('male')
      if (zyat) expect(sister?.gender).toBe('female')
    }
  })
})

// ============================================================
// 4. Возрасты и даты рождения
// ============================================================
describe('возрасты и даты рождения', () => {
  const plans = buildFamilies(200)

  it('дети 3..17 лет, категория child, без машины', () => {
    for (const plan of plans) {
      for (const kid of kidsOf(plan)) {
        expect(kid.age).toBeGreaterThanOrEqual(3)
        expect(kid.age).toBeLessThanOrEqual(17)
        expect(kid.ageGroup).toBe('child')
        expect(kid.withVehicle).toBe(false)
      }
    }
  })

  it('взрослые — 18+, ageGroup соответствует возрасту', () => {
    for (const plan of plans) {
      for (const m of plan.members) {
        if (isKidRole(m)) continue
        expect(m.age).toBeGreaterThanOrEqual(18)
        if (m.age < 18) expect(m.ageGroup).toBe('child')
        else if (m.age >= 60) expect(m.ageGroup).toBe('elder')
        else expect(m.ageGroup).toBe('adult')
      }
    }
  })

  it('дата рождения согласована с возрастом и лежит в прошлом', () => {
    for (const plan of plans) {
      for (const m of plan.members) {
        const bd = new Date(`${m.birthDate}T00:00:00`)
        expect(bd.getTime()).toBeLessThanOrEqual(NOW.getTime())
        const computed = ageFromBirthDate(m.birthDate, NOW)
        expect(Math.abs(computed - m.age)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('родители главы старше главы минимум на 20 лет', () => {
    for (const plan of plans) {
      for (const role of ['Отец', 'Мать']) {
        const parent = plan.members.find(m => m.role === role)
        if (parent) expect(parent.age - plan.head.age).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('с пожилым главой (headIsSeniorChance=1) родители главы не генерируются', () => {
    const plans = buildFamilies(100, { headIsSeniorChance: 1, parentsChance: 1 })
    for (const plan of plans) {
      expect(plan.head.age).toBeGreaterThanOrEqual(60)
      expect(plan.members.find(m => m.role === 'Отец')).toBeUndefined()
      expect(plan.members.find(m => m.role === 'Мать')).toBeUndefined()
    }
  })
})

// ============================================================
// 5. Фамилии
// ============================================================
describe('фамилии', () => {
  const plans = buildFamilies(200)

  it('у главы семьи фамилия из справочника', () => {
    for (const plan of plans) {
      expect(BASE_LAST_NAMES).toContain(plan.head.lastName)
    }
  })

  it('муж женщины-главы сохраняет свою фамилию, дети носят фамилию отца', () => {
    let withMaleSpouse = 0
    for (const plan of plans) {
      if (plan.head.gender !== 'female') continue
      const spouse = plan.members.find(m => m.role === 'Муж')
      if (!spouse) continue
      withMaleSpouse++
      expect(spouse.lastName).not.toBe(plan.head.lastName)
      for (const kid of directKidsOf(plan)) {
        expect(kid.lastName).toBe(spouse.lastName)
      }
    }
    expect(withMaleSpouse).toBeGreaterThan(0)
  })

  it('без отца-мужчины дети главы носят фамилию матери', () => {
    for (const plan of plans) {
      const hasAdultMale = adultMalesOf(plan).length > 0
      if (hasAdultMale) continue
      for (const kid of directKidsOf(plan)) {
        expect(kid.lastName).toBe(plan.head.lastName)
      }
    }
  })

  it('женские формы фамилии применяются при маппинге в запись', () => {
    const plan = buildFamily(7, { minKids: 0, maxKids: 0, spouseChance: 0, parentsChance: 0, siblingChance: 0 })
    const femaleHead = plan.head.gender === 'female'
      ? plan
      : buildFamily(8, { headIsMaleChance: 0, minKids: 0, maxKids: 0, spouseChance: 0, parentsChance: 0, siblingChance: 0 })
    const { person } = personFromPlan(femaleHead.head, 1)
    expect(person.last_name.endsWith('а')).toBe(true)
  })
})

// ============================================================
// 6. Быт: адрес, локация, статусы
// ============================================================
describe('быт семьи', () => {
  const plans = buildFamilies(200)

  it('все члены семьи живут по одному адресу и в одной локации', () => {
    for (const plan of plans) {
      const addresses = new Set(plan.members.map(m => m.address))
      const locations = new Set(plan.members.map(m => m.location))
      expect(addresses.size).toBe(1)
      expect(locations.size).toBe(1)
    }
  })

  it('детям не назначается статус «Отпуск»', () => {
    for (const plan of plans) {
      for (const kid of kidsOf(plan)) {
        if (kid.status !== null) expect(kid.status).toBe('Болен')
      }
    }
  })
})

// ============================================================
// 7. Настройки и маппинг в записи БД
// ============================================================
describe('настройки и personFromPlan', () => {
  it('minKids/maxKids ограничивают число детей', () => {
    const plans = buildFamilies(100, { minKids: 2, maxKids: 4 })
    for (const plan of plans) {
      const kids = kidsOf(plan).filter(m => m.role === 'Сын' || m.role === 'Дочь').length
      expect(kids).toBeGreaterThanOrEqual(2)
      expect(kids).toBeLessThanOrEqual(4)
    }
  })

  it('personFromPlan: поле category, привязка машины к владельцу, формат номера', () => {
    const plan = buildFamily(11)
    let sawVehicle = false
    plan.members.forEach((m, idx) => {
      const { person, vehicle } = personFromPlan(m, idx + 1, '199')
      expect(person.id).toBe(idx + 1)
      expect(person.relation).toBe(m.role)
      expect(person.ageGroup).toBe(m.ageGroup)
      expect(person.birth_date).toBe(m.birthDate)
      if (isKidRole(m)) {
        expect(person.category).toBe('Ребенок')
        expect(vehicle).toBeNull()
      } else {
        expect(person.category).toBe('Член семьи')
      }
      if (vehicle) {
        sawVehicle = true
        expect(vehicle.owner_id).toBe(person.id)
        expect(vehicle.owner_name).toBe(person.fio)
        expect(vehicle.plate).toMatch(/^[авекмнорстух]\d{3}[авекмнорстух]{2} 199$/i)
      }
    })
    expect(sawVehicle).toBe(true)
  })

  it('план детерминирован при одном seed', () => {
    const a = buildFamily(99)
    const b = buildFamily(99)
    expect(JSON.stringify(a.members)).toBe(JSON.stringify(b.members))
  })
})
