// tests/no52-truck-height-wheels-sound.test.ts
// [№52] три репорта одним пакетом:
//
// 1) «легковые машины поднимаются как надо — не выше уровня дороги, а
//    грузовые все-таки выше» — подъём выезжающего ГРУЗОВИКА при разъезде
//    считался по корпусу ЭЛЕМЕНТА, хотя у спрайтов есть мёртвые зоны
//    (крыша ниже верха viewBox, грунт выше низа). Визуально грузовик лез
//    крышей на 15-20px выше легковой. Теперь exitPullPastFor у грузовика —
//    по видимой геометрии (колёса над видимой крышей встречного);
// 2) «почему я не вижу колес на грузовых автомобилях на виде сзади?» —
//    колёса тыла были полоской 6px под светлым бампером, тёмные #1f2937
//    на тёмном фоне базы #152129 не читались. Спрайты грузовика посажены
//    на грунт (y63 из 65, как у легковой 58 из 60) + светлые диски;
// 3) «добавь звук открытия ворот и калитки (щелчок кнопки) также и на
//    нажатия мыши по воротам/калитке» — handleGateClick играет тот же
//    UI-щелчок (audio.playUI), что и кнопки панели.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { exitPullPastFor, CAR_ROOF_DEAD, TRUCK_ROOF_DEAD, TRUCK_GROUND_DEAD } from '~/utils/gateFlow'
import { STOP_STANDOFF_ENTER } from '~/utils/simulatorTraffic'
import { getTruckSvg, getTruckSvgFront, getTruckSvgRear, getCarSvgRear } from '~/utils/simulatorSvg'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const coreSrc = readFileSync(resolve(root, 'app/composables/simulator/useSimulatorCore.ts'), 'utf8')

describe('[№52-ГРУЗ-НЕ-ВЫШЕ-ДОРОГИ] exitPullPastFor — видимая геометрия', () => {
  it('легковая выезжающая — прежняя формула (репорт: «легковые поднимаются как надо»)', () => {
    expect(exitPullPastFor(0)).toBe(0)
    expect(exitPullPastFor(50)).toBe(50 + STOP_STANDOFF_ENTER)       // 56
    expect(exitPullPastFor(65)).toBe(65 + STOP_STANDOFF_ENTER)       // 71
    // флаг грузовика у ВСТРЕЧНОЙ не меняет формулу легковой
    expect(exitPullPastFor(65, false, true)).toBe(71)
  })

  it('выезжающий грузовик против легковой — колёса над видимой крышей (≈ F − 41 при 50/65)', () => {
    const pull = exitPullPastFor(50, true, false, 65)
    expect(pull).toBe(50 + STOP_STANDOFF_ENTER + 1 - CAR_ROOF_DEAD - TRUCK_GROUND_DEAD) // 41
    expect(pull).toBeLessThan(50 + STOP_STANDOFF_ENTER) // ниже прежней посадки
  })

  it('выезжающий грузовик против грузовика — касание видимых силуэтов (≈ F − 58)', () => {
    const pull = exitPullPastFor(65, true, true, 65)
    expect(pull).toBe(65 + STOP_STANDOFF_ENTER + 1 - TRUCK_ROOF_DEAD - TRUCK_GROUND_DEAD) // 58
    expect(pull).toBeLessThan(71) // ниже гарантийного коридора №46/№48
  })

  it('масштабирование: мёртвые зоны пропорциональны высоте элемента', () => {
    // встречная легковая 40 (гарнисур 80x40 из тестов): крыша 17.2·(40/60) ≈ 11
    const pullSmallCar = exitPullPastFor(40, true, false, 65)
    expect(pullSmallCar).toBe(40 + STOP_STANDOFF_ENTER + 1 - Math.round((CAR_ROOF_DEAD / 50) * 40) - TRUCK_GROUND_DEAD)
    // свой рост учитывается в мёртвой зоне грунта (2px на каждые 65 высоты)
    const pullBigTruck = exitPullPastFor(65, true, true, 100)
    expect(pullBigTruck).toBe(65 + STOP_STANDOFF_ENTER + 1 - TRUCK_ROOF_DEAD - 3)
    expect(pullBigTruck).toBeLessThan(exitPullPastFor(65, true, true, 65))
  })
})

describe('[№52-КОЛЁСА-ТЫЛ] спрайты грузовика посажены на грунт, диски видны', () => {
  it('тыл: шины y55..63 (низ 63, зазор 2px как у легковой) + светлые диски #9ca3af', () => {
    const rear = getTruckSvgRear('#16a34a')
    expect(rear).toContain('viewBox="0 0 120 65"')
    expect(rear).toContain('x="35" y="55" width="10" height="8"')   // левая шина до грунта
    expect(rear).toContain('x="75" y="55" width="10" height="8"')   // правая шина до грунта
    expect(rear).toContain('#9ca3af')                                // диски читаются на тёмном фоне
  })

  it('фас: те же линии грунта и диски (вид не «прыгает» при смене ракурса)', () => {
    const front = getTruckSvgFront('#16a34a')
    expect(front).toContain('x="43" y="55" width="10" height="8"')
    expect(front).toContain('x="67" y="55" width="10" height="8"')
    expect(front).toContain('#9ca3af')
  })

  it('профиль: колёса r8 cy55 — низ на том же грунте y63', () => {
    const side = getTruckSvg('#16a34a')
    expect(side).toContain('cy="55" r="8"')
  })

  it('легковая не тронута: колёса тыла по-прежнему y50..58 (регрессия)', () => {
    const carRear = getCarSvgRear('#16a34a')
    expect(carRear).toContain('x="43" y="50" width="8" height="8"')
  })
})

describe('[№52-ЗВУК-КЛИКА] клик по воротам/калитке звучит как кнопка', () => {
  it('handleGateClick играет UI-щелчок (audio.playUI) — как onControlClick у кнопок', () => {
    const start = coreSrc.indexOf('const handleGateClick')
    expect(start).toBeGreaterThan(0)
    const block = coreSrc.slice(start, start + 700)
    expect(block).toContain('audio.playUI(0.8)')
  })
})
