// tests/interpolated-styles.test.ts
// [№17-ПРЫЖОК] Шаблонные стили агентов обязаны интерполироваться тем же
// paintCoord, что и покадровая запись paint-моста: иначе любой структурный
// ререндер (спавн/деспавн/метки) перезаписывает transform ВСЕХ агентов
// текущей физпозицией — видимый прыжок вперёд на (1-альфа)*шаг и назад
// («телепорт за 2-3мм до точки остановки», регресс после №15).

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useSimulatorCore } from '~/composables/simulator/useSimulatorCore'

const makePerson = (over: Record<string, unknown> = {}) => ({
  id: 'p1', x: 100, y: 200, width: 40, height: 55,
  rotation: 0, velocity: 0, zIndex: 130,
  category: 'human', type: 'human', name: 'Иван',
  settings: {}, asset: { type: 'person', svg: '<svg/>' },
  ...over,
})

const makeCore = () => {
  const simElements = ref<any[]>([])
  return useSimulatorCore(simElements)
}

describe('getElementStyle — интерполяция (№17)', () => {
  it('alpha=1 (дефолт) — текущая позиция, прежнее поведение', () => {
    const core = makeCore()
    const st: any = core.getElementStyle(makePerson() as any, false)
    expect(st.transform).toBe('translate3d(100px, 200px, 0)')
  })

  it('alpha=0.5 с _px/_py — середина между prev и текущей', () => {
    const core = makeCore()
    const el = makePerson({ _px: 90, _py: 180 })
    const st: any = core.getElementStyle(el as any, false, 0.5)
    expect(st.transform).toBe('translate3d(95px, 190px, 0)')
  })

  it('alpha=0 — paintCoord возвращает текущую позицию (семантика №15: сброс аккумулятора = снап к физике)', () => {
    const core = makeCore()
    const el = makePerson({ _px: 90, _py: 180 })
    const st: any = core.getElementStyle(el as any, false, 0)
    expect(st.transform).toBe('translate3d(100px, 200px, 0)')
  })

  it('без prev-снимка (новый агент) — fallback на текущую позицию', () => {
    const core = makeCore()
    const st: any = core.getElementStyle(makePerson() as any, false, 0.3)
    expect(st.transform).toBe('translate3d(100px, 200px, 0)')
  })

  it('машина: зеркало scaleX сохраняется при интерполяции', () => {
    const core = makeCore()
    const el = makePerson({
      category: 'car', width: 80, height: 40,
      settings: { _facingLeft: true }, _px: 90, _py: 180,
    })
    const st: any = core.getElementStyle(el as any, false, 0.5)
    expect(st.transform).toBe('translate3d(95px, 190px, 0) scaleX(-1)')
  })
})
