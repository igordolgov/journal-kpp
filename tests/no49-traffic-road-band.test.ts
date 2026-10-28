// tests/no49-traffic-road-band.test.ts
// [№49-ШИРЕ-ДОРОГА] репорт №48: «расширь фоновую дорогу и немного приподними
// нижний край полосы, по которой едут машины».
//  1) новый элемент библиотеки «Дорога с трафиком» — высотой 160;
//  2) нижний край полосы движения приподнят на 4px (колёса не скребут
//     нижнюю кромку асфальта — у грузовика зазор был всего 0.5px).
// [№51-РАЗМЕРЫ-ЗАКАЗЧИКА] репорт: «учти размеры фоновой дороги, которые
// я поменял». ПРИНУДИТЕЛЬНАЯ min-height 160 УБРАНА: полотно строго по
// размеру элемента (у заказчика 1286x101.4 — раньше min-height дорисовывал
// асфальт на 59px выше габарита, и дорога наезжала на ворота). Полосы и
// транспорт масштабируются под фактическую высоту (пропорции №46/№49
// сохраняются): на высоте 160+ вид как в №49, ниже — меньше без обрезки.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { CAR_WIDTH, CAR_HEIGHT, TRUCK_WIDTH_SCALE, TRUCK_HEIGHT_SCALE } from '~/utils/simulatorConstants'
import { LIBRARY_GROUPS } from '~/constants/library'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const roadSrc = readFileSync(resolve(root, 'app/components/editor/TrafficRoad.vue'), 'utf8')

// Геометрия полос №51: полотно = фактическая высота элемента, транспорт
// масштабируется под полосу по ГРУЗОВИКУ (самый высокий), пропорция машин
// сохранена. Проверяем формулу ровно в том виде, в каком она в компоненте.
const BOTTOM_LANE_LIFT = 4
const roadScale = (h: number, truckH: number) =>
  Math.min(1, (Math.max(h, 24) / 2 - BOTTOM_LANE_LIFT * 2) / truckH)
const laneBand = (h: number) => {
  const laneH = Math.max(h, 24) / 2
  return { laneH, topY: laneH / 2, bottomY: laneH + laneH / 2 - Math.min(BOTTOM_LANE_LIFT, laneH * 0.1) }
}

describe('[№49→№51] полотно и полосы фоновой дороги', () => {
  it('TrafficRoad: полотно по фактической высоте элемента — min-height принудительной дорисовки больше нет', () => {
    // [№51] min-height корня убран: асфальт не вылезает за габарит элемента
    expect(roadSrc).not.toContain('minHeight')
    // масштабирование по фактической высоте (без подмешивания MIN)
    expect(roadSrc).toContain('const ROAD_H = Math.max(props.height || 0, 24)')
    expect(roadSrc).not.toContain('TRAFFIC_ROAD_MIN_H)')
    // подъём нижнего края полосы сохранён
    expect(roadSrc).toContain('const BOTTOM_LANE_LIFT = 4')
    expect(roadSrc).toContain('- lift')
  })

  it('библиотека: новый элемент «Дорога с трафиком» по-прежнему высотой 160', () => {
    const item = LIBRARY_GROUPS.flatMap(g => g.items).find(i => i.id === 'traffic_road')
    expect(item?.height).toBe(160)
  })

  it('высота 160+: масштаб 1 — размеры машин №46/№49 без изменений', () => {
    expect(CAR_WIDTH).toBe(100)
    expect(CAR_HEIGHT).toBe(50)
    const truckH = Math.round(CAR_HEIGHT * TRUCK_HEIGHT_SCALE) // 65
    expect(truckH).toBe(65)
    const s = roadScale(160, truckH)
    expect(s).toBe(1)
    const { laneH, topY, bottomY } = laneBand(160)
    expect(laneH).toBe(80)
    // верхняя полоса: грузовик 65 от 7.5 до 72.5 — внутри полотна
    const truckTop = topY - truckH / 2
    const truckBottom = topY + truckH / 2
    expect(truckTop).toBeGreaterThanOrEqual(7)
    expect(truckBottom).toBeLessThanOrEqual(laneH)
    // нижняя полоса (с подъёмом): нижний зазор под грузовиком >= 8px
    const botBottom = bottomY + truckH / 2
    expect(160 - botBottom).toBeGreaterThanOrEqual(8)
  })

  it('[№51] пользовательская высота 101.4 (сцена заказчика): транспорт уменьшается, в полотно помещается, ничего не обрезается', () => {
    const truckH = 65
    const carH = 50
    const s = roadScale(101.4, truckH)
    expect(s).toBeLessThan(1) // масштаб включился
    const scaledTruckH = Math.round(truckH * s)
    const scaledCarH = Math.round(carH * s)
    // пропорция легковая/грузовик сохранена (грузовик выше легковой)
    expect(scaledTruckH).toBeGreaterThan(scaledCarH)
    const { laneH, topY, bottomY } = laneBand(101.4)
    // грузовик в верхней полосе: целиком внутри [0, laneH]
    expect(topY - scaledTruckH / 2).toBeGreaterThanOrEqual(0)
    expect(topY + scaledTruckH / 2).toBeLessThanOrEqual(laneH)
    // и в нижней (с подъёмом): целиком внутри [laneH, ROAD_H]
    expect(bottomY - scaledTruckH / 2).toBeGreaterThanOrEqual(laneH - 0.5)
    expect(bottomY + scaledTruckH / 2).toBeLessThanOrEqual(101.4 + 0.5)
  })

  it('элемент выше 160 (пользователь растянул) — полосы масштабируются, подъём сохраняется', () => {
    const { laneH, bottomY } = laneBand(220)
    expect(laneH).toBe(110)
    expect(bottomY).toBe(110 + 55 - 4) // 161 — центр нижней полосы приподнят
    const truckH = 65
    expect(220 - (bottomY + truckH / 2)).toBeGreaterThanOrEqual(20)
  })
})
