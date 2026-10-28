// tests/no49-traffic-road-band.test.ts
// [№49-ШИРЕ-ДОРОГА] репорт №48: «расширь фоновую дорогу и немного приподними
// нижний край полосы, по которой едут машины».
//  1) полотно фоновой дороги не ниже 160px (две полосы по 80px — грузовик
//     120x65 помещается с полем; элемент старой сцены 120/132 дорисовывается
//     min-height корня — грузовик больше не режется краем элемента);
//  2) нижний край полосы движения приподнят на 4px (колёса не скребут
//     нижнюю кромку асфальта — у грузовика зазор был всего 0.5px);
//  3) новый элемент библиотеки «Дорога с трафиком» — высотой 160.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { CAR_WIDTH, CAR_HEIGHT, TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE } from '~/utils/simulatorConstants'
import { LIBRARY_GROUPS } from '~/constants/library'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const roadSrc = readFileSync(resolve(root, 'app/components/editor/TrafficRoad.vue'), 'utf8')

// Геометрия полос при MIN-высоте (проверка чисел, не исходника)
const TRAFFIC_ROAD_MIN_H = 160
const BOTTOM_LANE_LIFT = 4
const laneBand = (h: number) => {
  const laneH = Math.max(h, TRAFFIC_ROAD_MIN_H) / 2
  return { laneH, topY: laneH / 2, bottomY: laneH + laneH / 2 - BOTTOM_LANE_LIFT }
}

describe('[№49-ШИРЕ-ДОРОГА] полотно и полосы фоновой дороги', () => {
  it('TrafficRoad: MIN-высота полотна 160 и подъём нижнего края полосы', () => {
    expect(roadSrc).toContain('const TRAFFIC_ROAD_MIN_H = 160')
    expect(roadSrc).toContain('const BOTTOM_LANE_LIFT = 4')
    expect(roadSrc).toContain('Math.max(props.height || 0, TRAFFIC_ROAD_MIN_H)')
    expect(roadSrc).toContain('minHeight: TRAFFIC_ROAD_MIN_H')
    expect(roadSrc).toContain('- BOTTOM_LANE_LIFT')
  })

  it('библиотека: новый элемент «Дорога с трафиком» высотой 160', () => {
    const item = LIBRARY_GROUPS.flatMap(g => g.items).find(i => i.id === 'traffic_road')
    expect(item?.height).toBe(160)
  })

  it('грузовик 120x65 помещается в обе полосы с полями (не режется краями)', () => {
    expect(CAR_WIDTH).toBe(100)
    expect(CAR_HEIGHT).toBe(50)
    const truckH = Math.round(CAR_HEIGHT * TRUCK_HEIGHT_SCALE) // 65
    expect(truckH).toBe(65)
    const { laneH, topY, bottomY } = laneBand(120) // худший случай: старый элемент 120
    expect(laneH).toBe(80)
    // верхняя полоса: грузовик от 7.5 до 72.5 — внутри полотна и не задёт
    // центр (80) и верхний край (0)
    const truckTop = topY - truckH / 2
    const truckBottom = topY + truckH / 2
    expect(truckTop).toBeGreaterThanOrEqual(7)
    expect(truckBottom).toBeLessThanOrEqual(laneH)
    // нижняя полоса (с подъёмом): от 85.5 до 150.5 — внутри и выше нижней
    // кромки на >= 8px
    const botTop = bottomY - truckH / 2
    const botBottom = bottomY + truckH / 2
    expect(botTop).toBeGreaterThanOrEqual(laneH)
    expect(160 - botBottom).toBeGreaterThanOrEqual(8)
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
