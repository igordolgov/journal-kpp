// tests/journal-highlight.test.ts
// [№15-БЕЗОПАСНОСТЬ] Подсветка поиска в журнале идёт в v-html: текст обязан
// экранироваться ДО подстановки разметки. Раньше <img onerror=...> из ФИО/
// заметок исполнялся (JournalTable не экранировал, в отличие от database.vue).
import { describe, it, expect } from 'vitest'
import { escapeHtml, highlightSearchText } from '~/utils/journalHighlight'

describe('journalHighlight: экранирование v-html', () => {
  it('escapeHtml нейтрализует все опасные символы', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    )
    expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#039;d&#039;')
  })

  it('escapeHtml: null/undefined -> пустая строка', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('highlightSearchText без запроса возвращает экранированный текст', () => {
    expect(highlightSearchText('<b>Иванов</b>', '')).toBe('&lt;b&gt;Иванов&lt;/b&gt;')
  })

  it('подсветка работает по экранированному тексту', () => {
    const out = highlightSearchText('Иванов Иван', 'Иван')
    expect(out).toContain('<span class="bg-warning/40 px-0.5 rounded">Иван</span>')
    expect(out).not.toContain('<img')
  })

  it('XSS в данных не исполняется даже при совпадении с запросом', () => {
    const evil = '<img src=x onerror="alert(1)">Иван'
    const out = highlightSearchText(evil, 'img')
    // '<' экранирован: подсветка может попасть ВНУТРЬ сущности (&lt;+img) —
    // это косметика, тега в DOM не возникает
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<span src')
    expect(out).toContain('&lt;')
  })

  it('запрос как ref-подобный объект (.value) поддерживается', () => {
    const out = highlightSearchText('Иванов', { value: 'ванов' })
    expect(out).toBe('И<span class="bg-warning/40 px-0.5 rounded">ванов</span>')
  })

  it('спецсимволы запроса не ломают regex', () => {
    expect(() => highlightSearchText('a(b)c', '(b)')).not.toThrow()
    expect(highlightSearchText('a(b)c', '(b)')).toContain('(b)')
  })
})
