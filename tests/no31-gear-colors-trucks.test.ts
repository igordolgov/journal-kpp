// tests/no31-gear-colors-trucks.test.ts
// [№31] Шестерня ворот, цвета машин из БД, грузовые автомобили:
//  - getGateGearSvg: разметка шестерни с классом gate-gear (paint крутит её);
//  - resolveVehicleColor: русские названия сидера -> CSS-цвет (раньше
//    невалидный fill рендерил все машины чёрными);
//  - stableVehicleColor: машины без цвета не «перекрашиваются» между поездками;
//  - getTruckSvg: отдельный спрайт грузового автомобиля;
//  - personFromPlan: доля грузовиков ~10%, марки грузовиков, цвета из справочника.

import { describe, it, expect } from 'vitest'
import { getGateGearSvg, GATE_GEAR_TEETH } from '~/constants/library'
import {
  VEHICLE_COLOR_NAMES,
  VEHICLE_PALETTE,
  resolveVehicleColor,
  stableVehicleColor,
  TRUCK_WIDTH_SCALE,
  TRUCK_HEIGHT_SCALE,
} from '~/utils/simulatorConstants'
import { getTruckSvg } from '~/utils/simulatorSvg'
import {
  FAMILY_CAR_COLORS,
  TRUCK_BRANDS,
  TRUCK_TYPE_SHARE,
  personFromPlan,
  type IFamilyMemberPlan,
} from '~/utils/familyMath'

describe('№31: шестерня ворот', () => {
  it('SVG шестерни содержит класс gate-gear и 8 зубьев', () => {
    const svg = getGateGearSvg()
    expect(svg).toContain('<svg')
    expect(svg).toContain('gate-gear')
    expect(svg).toContain(`rotate(${(360 / GATE_GEAR_TEETH) * (GATE_GEAR_TEETH - 1)}`)
    const teeth = (svg.match(/class="gate-gear"/g) || []).length
    expect(teeth).toBe(1)
    expect(GATE_GEAR_TEETH).toBe(8)
  })
})

describe('№31: цвета машин из БД', () => {
  it('справочник покрывает палитру сидера FAMILY_CAR_COLORS', () => {
    for (const name of FAMILY_CAR_COLORS) {
      expect(VEHICLE_COLOR_NAMES[name], `нет цвета «${name}»`).toBeTruthy()
      // каждое имя сидера приводится к валидному CSS hex
      expect(resolveVehicleColor(name)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('resolveVehicleColor: hex и css-имена проходят, мусор -> null', () => {
    expect(resolveVehicleColor('Черный')).toBe('#1f2937')
    expect(resolveVehicleColor('Чёрный')).toBe('#1f2937')
    expect(resolveVehicleColor('#ff8800')).toBe('#ff8800')
    expect(resolveVehicleColor('#f80')).toBe('#f80')
    expect(resolveVehicleColor('forestgreen')).toBe('forestgreen')
    expect(resolveVehicleColor('неизвестный-цвет')).toBeNull()
    expect(resolveVehicleColor('')).toBeNull()
    expect(resolveVehicleColor(null)).toBeNull()
    expect(resolveVehicleColor(undefined)).toBeNull()
  })

  it('stableVehicleColor: детерминирован по номеру и из палитры', () => {
    const a = stableVehicleColor('А 123 ВС 77')
    const b = stableVehicleColor('А 123 ВС 77')
    expect(a).toBe(b)
    expect(VEHICLE_PALETTE).toContain(a)
    // пустой номер — тоже валидный цвет
    expect(VEHICLE_PALETTE).toContain(stableVehicleColor(''))
  })
})

describe('№31: грузовики', () => {
  it('масштабы дают грузовик крупнее легковой ([№46] 100x50)', () => {
    const w = Math.round(100 * TRUCK_WIDTH_SCALE)
    const h = Math.round(50 * TRUCK_HEIGHT_SCALE)
    expect(w).toBeGreaterThan(100)
    expect(h).toBeGreaterThan(50)
    expect(w).toBe(120)
    expect(h).toBe(65)
  })

  it('getTruckSvg: viewBox и подстановка цвета; доля и марки объявлены', () => {
    const svg = getTruckSvg('#dc2626')
    expect(svg).toContain('viewBox="0 0 120 65"')
    expect(svg).toContain('#dc2626')
    expect(svg).toContain('#87CEEB') // остекление кабины
    expect(TRUCK_TYPE_SHARE).toBeLessThan(0.25) // «их не должно быть много»
    expect(TRUCK_TYPE_SHARE).toBeGreaterThan(0)
    expect(TRUCK_BRANDS.length).toBeGreaterThan(0)
  })

  it('personFromPlan: rand<доли -> Грузовой с грузовой маркой, иначе Личный', () => {
    const plan: IFamilyMemberPlan = {
      lastName: 'Иванов', firstName: 'Иван', patronymic: 'Иванович',
      gender: 'male', role: 'Отец', ageGroup: 'adult', age: 40,
      birthDate: '1985-01-01', address: 'ул. Ленина 1', location: 'В городе',
      status: '', withVehicle: true,
    } as any
    const truck = personFromPlan(plan, 1, '777', () => 0.05).vehicle!
    expect(truck.type).toBe('Грузовой')
    expect(TRUCK_BRANDS).toContain(truck.brand)
    const car = personFromPlan(plan, 2, '777', () => 0.5).vehicle!
    expect(car.type).toBe('Личный')
    expect(TRUCK_BRANDS).not.toContain(car.brand)
  })
})
