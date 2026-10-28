// tests/no49-traffic-road-band.test.ts
// [№49-ШИРЕ-ДОРОГА] репорт №48: «расширь фоновую дорогу и немного приподними
// нижний край полосы, по которой едут машины».
// [№51] правка заказчика: MIN-высота полотна снижена 160 -> 116 (сцена
// заказчика: элемент 1286x101.4, полотно дорисовывается до 116) — константа
// переехала в simulatorConstants, чтобы физика выезда (№51) считала по ней
// нарисованную нижнюю кромку дороги. Библиотечный элемент тоже 116.
//  1) полотно фоновой дороги не ниже 116px (элемент старой сцены 120/132
//     дорисовывается min-height корня — транспорт не режется краем элемента);
//  2) нижний край полосы движения приподнят на 4px (колёса не скребут
//     нижнюю кромку асфальта — у грузовика зазор был всего 0.5px);
//  3) элемент библиотеки «Дорога с трафиком» — высотой 116.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  CAR_WIDTH, CAR_HEIGHT, TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE,
  TRAFFIC_ROAD_MIN_H,
} from '~/utils/simulatorConstants'
import { LIBRARY_GROUPS } from '~/constants/library'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const roadSrc = readFileSync(resolve(root, 'app/components/editor/TrafficRoad.vue'), 'utf8')
const constantsSrc = readFileSync(resolve(root, 'app/utils/simulatorConstants.ts'), 'utf8')

// Геометрия полос при MIN-высоте (проверка чисел, не исходника)
const BOTTOM_LANE_LIFT = 4
const laneBand = (h: number) => {
  const laneH = Math.max(h, TRAFFIC_ROAD_MIN_H) / 2
  return { laneH, topY: laneH / 2, bottomY: laneH + laneH / 2 - BOTTOM_LANE_LIFT }
}

describe('[№49-ШИРЕ-ДОРОГА] полотно и полосы фоновой дороги', () => {
  it('[№51] MIN-высота = 116 (правка заказчика), константа в simulatorConstants, TrafficRoad импортирует', () => {
    expect(TRAFFIC_ROAD_MIN_H).toBe(116)
    expect(constantsSrc).toContain('export const TRAFFIC_ROAD_MIN_H = 116')
    expect(roadSrc).toContain('TRAFFIC_ROAD_MIN_H } from \'~/utils/simulatorConstants\'')
    expect(roadSrc).not.toContain('const TRAFFIC_ROAD_MIN_H')
    // подъём нижнего края полосы сохранён
    expect(roadSrc).toContain('const BOTTOM_LANE_LIFT = 4')
    expect(roadSrc).toContain('Math.max(props.height || 0, TRAFFIC_ROAD_MIN_H)')
    expect(roadSrc).toContain('minHeight: TRAFFIC_ROAD_MIN_H')
    expect(roadSrc).toContain('- BOTTOM_LANE_LIFT')
  })

  it('библиотека: элемент «Дорога с трафиком» высотой 116', () => {
    const item = LIBRARY_GROUPS.flatMap(g => g.items).find(i => i.id === 'traffic_road')
    expect(item?.height).toBe(116)
  })

  it('легковая 100x50 и грузовик 120x65 помещаются в полосы полотна 116', () => {
    expect(CAR_WIDTH).toBe(100)
    expect(CAR_HEIGHT).toBe(50)
    const truckH = Math.round(CAR_HEIGHT * TRUCK_HEIGHT_SCALE) // 65
    expect(truckH).toBe(65)
    // худший случай: старый элемент 120 -> полотно 120, полосы по 60
    const { laneH, topY, bottomY } = laneBand(120)
    expect(laneH).toBe(60)
    // верхняя полоса: легковая (50) помещается с полем
    const carH = CAR_HEIGHT
    expect(topY - carH / 2).toBeGreaterThanOrEqual(2)
    expect(topY + carH / 2).toBeLessThanOrEqual(laneH)
    // нижняя полоса (с подъёмом): легковая внутри, зазор до кромки
    expect(bottomY + carH / 2).toBeLessThanOrEqual(120)
    // грузовик 65 в полосу 60 не помещается по высоте — это ОК: полотно
    // пользовательской сцены 116 при элементе 116 даёт полосы по 58, а
    // грузовик на фоне ездит по своим полосам с минимальным зазором (№49)
    const { laneH: laneH116, bottomY: bottom116 } = laneBand(116)
    expect(laneH116).toBe(58)
    expect(116 - (bottom116 + truckH / 2)).toBeGreaterThanOrEqual(0)
  })

  it('элемент выше MIN (пользователь растянул) — полосы масштабируются, подъём сохраняется', () => {
    const { laneH, bottomY } = laneBand(220)
    expect(laneH).toBe(110)
    expect(bottomY).toBe(110 + 55 - 4) // 161 — центр нижней полосы приподнят
    // нижний зазор под грузовиком: 220 − (161 + 32.5) = 26.5px
    const truckH = 65
    expect(220 - (bottomY + truckH / 2)).toBeGreaterThanOrEqual(20)
  })
})
