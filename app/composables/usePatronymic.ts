// app/composables/usePatronymic.ts
// Назначение: генерация отчества по имени отца и полу ребенка.
// [ИСПРАВЛЕНО] noUncheckedIndexedAccess: split(' ')[0] даёт string | undefined,
// обращение specialCases[nameLower] — объект | undefined.
export const usePatronymic = () => {

  // Вспомогательные множества символов
  const vowels = new Set(['а', 'у', 'о', 'ы', 'и', 'э', 'я', 'ю', 'ё', 'е'])
  const hushers = new Set(['ж', 'ш', 'щ', 'ч']) // шипящие
  const consonants = new Set([
    'б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ'
  ])

  // Особые случаи (исторические формы). Ключи в нижнем регистре.
  const specialCases: Record<string, { m: string; f: string }> = {
    'никита':   { m: 'Никитич',    f: 'Никитична' },
    'савва':    { m: 'Саввич',     f: 'Саввична' },
    'кузьма':   { m: 'Кузьмич',    f: 'Кузьминична' },
    'лука':     { m: 'Лукич',      f: 'Лукинична' },
    'фома':     { m: 'Фомич',      f: 'Фоминична' },
    'илья':     { m: 'Ильич',      f: 'Ильинична' },
    'яков':     { m: 'Яковлевич',  f: 'Яковлевна' },
    'лев':      { m: 'Львович',    f: 'Львовна' },
    'павел':    { m: 'Павлович',   f: 'Павловна' },
    'игорь':    { m: 'Игоревич',   f: 'Игоревна' },
    'валерий':  { m: 'Валерьевич', f: 'Валерьевна' },
    'сергей':   { m: 'Сергеевич',  f: 'Сергеевна' },
    'андрей':   { m: 'Андреевич',  f: 'Андреевна' },
    'дмитрий':  { m: 'Дмитриевич', f: 'Дмитриевна' },
    'николай':  { m: 'Николаевич', f: 'Николаевна' },
  }

  /**
   * Генерирует отчество по имени отца и полу ребенка
   * @param fatherName Имя отца (в именительном падеже)
   * @param gender Пол ребенка: 'male' или 'female'
   */
  const generatePatronymic = (fatherName: string, gender: 'male' | 'female'): string => {
    if (!fatherName) return ''

    // Берем только первое слово, если передали полное ФИО
    const nameLower = fatherName.toLowerCase().trim().split(' ')[0] ?? ''

    // 1. Проверка особых случаев
    const special = specialCases[nameLower]
    if (special) {
      return gender === 'male' ? special.m : special.f
    }

    let base = nameLower
    let lastChar = base.slice(-1)

    // 2. Обработка окончания -а / -я (усечение)
    if (lastChar === 'а' || lastChar === 'я') {
      base = base.slice(0, -1)
      lastChar = base.slice(-1)
    }

    // 3. Обработка окончания -й или -ь (отбрасываются)
    let suffixStart = '' // 'ов' или 'ев'

    if (lastChar === 'й' || lastChar === 'ь') {
      base = base.slice(0, -1)
      lastChar = base.slice(-1)
      suffixStart = 'ев'
    }
    else if (hushers.has(lastChar) || lastChar === 'ц') {
      // 4. Шипящие и Ц -> -ев-
      suffixStart = 'ев'
    }
    else if (consonants.has(lastChar)) {
      // 5. Твердый согласный -> -ов-
      suffixStart = 'ов'
    }
    else {
      // Если кончается на гласную, кроме -а/-я (редкость)
      suffixStart = (hushers.has(lastChar) || lastChar === 'ь') ? 'ев' : 'ов'
    }

    // Формируем результат
    const ending = gender === 'male' ? 'ич' : 'на'

    // Возвращаем с большой буквы
    return (base.charAt(0).toUpperCase() + base.slice(1) + suffixStart + ending)
  }

  return {
    generatePatronymic
  }
}