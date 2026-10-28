// tests/no44-traffic-road-trucks.test.ts
// [№44-ФОНОВЫЙ-ТРАФИК] фоновая дорога (TrafficRoad, полоса сверху сцены)
// рисует ТЕ ЖЕ машины, что и основной симулятор:
//  1) локальный упрощённый генератор удалён — спрайты из simulatorSvg
//     (легковой профиль getCarSvg + грузовик getTruckSvg);
//  2) грузовик крупнее легковой теми же коэффициентами TRUCK_*_SCALE
//     ([№46-КРУПНЕЕ] 100x50 -> 120x65), доля грузовиков в потоке =
//     TRUCK_TYPE_SHARE (10%);
//  3) размер контейнера — по машине (car.w/car.h), а не константа.
// [№46-КРУПНЕЕ] размеры — ТЕ ЖЕ константы CAR_WIDTH/CAR_HEIGHT, что и в
// основном симуляторе («такие же по размеру на фоновой дороге»).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE, CAR_WIDTH, CAR_HEIGHT } from '~/utils/simulatorConstants'
import { TRUCK_TYPE_SHARE } from '~/utils/familyMath'
import { getCarSvg, getTruckSvg } from '~/utils/simulatorSvg'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const src = readFileSync(resolve(root, 'app/components/editor/TrafficRoad.vue'), 'utf8')

describe('[№44-ФОНОВЫЙ-ТРАФИК] общие спрайты с основным симулятором', () => {
  it('TrafficRoad импортирует getCarSvg/getTruckSvg из simulatorSvg', () => {
    expect(src).toContain("import { getCarSvg, getTruckSvg } from '~/utils/simulatorSvg'")
  })

  it('локальный упрощённый генератор удалён (ни CAR_SVG, ни buildCarSvg)', () => {
    expect(src).not.toContain('buildCarSvg')
    expect(src).not.toContain('CAR_SVG')
  })

  it('спрайт выбирается по типу транспорта: грузовик/легковая', () => {
    expect(src).toContain('svg: isTruck ? getTruckSvg(color) : getCarSvg(color)')
  })

  it('палитра и размеры машин — общие константы из simulatorConstants', () => {
    expect(src).toContain("import { CAR_COLORS, CAR_WIDTH, CAR_HEIGHT, TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE, TRAFFIC_ROAD_MIN_H } from '~/utils/simulatorConstants'")
    expect(src).not.toMatch(/const CAR_COLORS = \[/)
  })
})

describe('[№44-ФОНОВЫЙ-ТРАФИК] масштаб и доля грузовиков', () => {
  it('грузовик 120x65 — те же TRUCK_*_SCALE, что в основном симуляторе', () => {
    expect(TRUCK_WIDTH_SCALE).toBe(1.2)
    expect(TRUCK_HEIGHT_SCALE).toBe(1.3)
    expect(Math.round(100 * TRUCK_WIDTH_SCALE)).toBe(120)
    expect(Math.round(50 * TRUCK_HEIGHT_SCALE)).toBe(65)
    // константы компонента считаются от них, а не захардкожены
    expect(src).toContain('const TRUCK_W = Math.round(CAR_W * TRUCK_WIDTH_SCALE)')
    expect(src).toContain('const TRUCK_H = Math.round(CAR_H * TRUCK_HEIGHT_SCALE)')
  })

  it('[№46-КРУПНЕЕ] легковая на фоновой дороге = CAR_WIDTH/CAR_HEIGHT (100x50)', () => {
    expect(CAR_WIDTH).toBe(100)
    expect(CAR_HEIGHT).toBe(50)
    expect(src).toContain('const CAR_W = CAR_WIDTH')
    expect(src).toContain('const CAR_H = CAR_HEIGHT')
    // локальные захардкоженные 80x40 не возвращаются
    expect(src).not.toContain('const CAR_W = 80')
    expect(src).not.toContain('const CAR_H = 40')
  })

  it('доля грузовиков в потоке = TRUCK_TYPE_SHARE (0.1)', () => {
    expect(TRUCK_TYPE_SHARE).toBe(0.1)
    expect(src).toContain('const TRUCK_SHARE = 0.1')
  })

  it('размер контейнера по машине: carStyle использует car.w/car.h', () => {
    expect(src).toContain("width: car.w + 'px'")
    expect(src).toContain("height: car.h + 'px'")
    expect(src).not.toContain("width: CAR_W + 'px'")
  })

  it('спрайты корректны: у грузовика будка-торец, у легковой — силуэт седана', () => {
    expect(getTruckSvg('#22c55e')).toContain('viewBox="0 0 120 65"')
    expect(getCarSvg('#22c55e')).toContain('viewBox="0 0 120 60"')
  })
})
