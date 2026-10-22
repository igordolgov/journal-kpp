// app/utils/journalHighlight.ts
// [№15-БЕЗОПАСНОСТЬ] Подсветка поисковых вхождений для v-html в таблице журнала.
// Раньше highlightText вставлял сырой текст в v-html: значение поля из БД
// (ФИО, заметки, «транспорт») с <img onerror=...> исполнялось как HTML.
// database.vue экранировал, JournalTable — нет. Теперь текст экранируется
// ДО подстановки в разметку; функция чистая — покрыта юнит-тестами.

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type MaybeRef = { value?: unknown }

// Совместимо с прежним вызовом JournalTable: query может быть ref/''
export const highlightSearchText = (text: unknown, query: unknown): string => {
  const raw = query as MaybeRef | string | null | undefined
  const q = (raw && typeof raw === 'object' && 'value' in raw)
    ? String((raw as MaybeRef).value ?? '')
    : String(raw ?? '')
  const safe = escapeHtml(text)
  if (!q || !safe) return safe
  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi')
  return safe.replace(regex, '<span class="bg-warning/40 px-0.5 rounded">$1</span>')
}
