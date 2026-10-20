// tests/shift-accept.test.ts
// [СМЕНА] Регрессии принятия смены:
//  1) «Принять смену» при незакрытой предыдущей — предыдущая закрывается
//     автоматически (иначе в store 'shifts' копятся вечные активные смены,
//     и принятая смена «не считается» принятой);
//  2) без активной смены автозакрытия нет — просто добавляется новая;
//  3) loadCurrentShift находит единственную активную.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbMock = vi.hoisted(() => ({
  getAllItems: vi.fn(async (_store: string) => [] as any[]),
  addItem: vi.fn(async (_store: string, _item: any) => 101),
  updateItem: vi.fn(async (_store: string, _item: any) => 1),
}))

vi.mock('~/composables/useDatabase', () => ({
  useDatabase: () => dbMock,
}))

vi.mock('~/composables/usePayroll', () => ({
  usePayroll: () => ({
    init: vi.fn(async () => {}),
    setActiveShift: vi.fn(),
    setPaused: vi.fn(),
  }),
}))

import { useShift } from '~/composables/useShift'

describe('принятие смены ([СМЕНА])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMock.getAllItems.mockResolvedValue([])
  })

  it('автозакрывает незакрытую предыдущую смену при принятии новой', async () => {
    dbMock.getAllItems.mockResolvedValue([
      { id: 7, guard_name: 'Петров', start_time: 1000, end_time: null },
    ])
    const { currentShift, loadCurrentShift, startShift } = useShift()
    await loadCurrentShift()
    expect(currentShift.value?.id).toBe(7)

    await startShift('Иванов')

    // предыдущая закрыта: updateItem с end_time
    expect(dbMock.updateItem).toHaveBeenCalledTimes(1)
    const closed = dbMock.updateItem.mock.calls[0]![1]
    expect(closed.id).toBe(7)
    expect(closed.end_time).toBeTypeOf('number')
    // новая добавлена и стала текущей
    expect(dbMock.addItem).toHaveBeenCalledTimes(1)
    expect(currentShift.value?.guard_name).toBe('Иванов')
    expect(currentShift.value?.id).toBe(101)
  })

  it('без активной смены просто добавляет новую (без автозакрытия)', async () => {
    const { currentShift, loadCurrentShift, startShift } = useShift()
    await loadCurrentShift()
    expect(currentShift.value).toBeNull()

    await startShift('Сидоров')

    expect(dbMock.updateItem).not.toHaveBeenCalled()
    expect(dbMock.addItem).toHaveBeenCalledTimes(1)
    expect(currentShift.value?.guard_name).toBe('Сидоров')
  })

  it('loadCurrentShift находит активную смену среди закрытых', async () => {
    dbMock.getAllItems.mockResolvedValue([
      { id: 1, guard_name: 'А', start_time: 100, end_time: 200 },
      { id: 2, guard_name: 'Б', start_time: 300, end_time: null },
      { id: 3, guard_name: 'В', start_time: 400, end_time: null },
    ])
    const { currentShift, loadCurrentShift } = useShift()
    await loadCurrentShift()
    // первая запись без end_time
    expect(currentShift.value?.id).toBe(2)
  })
})
