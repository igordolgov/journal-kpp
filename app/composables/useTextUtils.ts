// app/composables/useTextUtils.ts
// Назначение: текстовые утилиты — форматирование ФИО.
export const useTextUtils = () => {

  const capitalizeFio = (fio: string): string => {
    if (!fio) return '';
    return fio.trim().split(/\s+/).map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  const generateShortName = (fio: string): string => {
    if (!fio) return '';
    const parts = fio.trim().split(/\s+/).filter(p => p.length > 0);
    // [ИСПРАВЛЕНО] noUncheckedIndexedAccess: проверка length не сужает тип
    // элементов — деструктурируем и проверяем явно
    const surnamePart = parts[0];
    if (!surnamePart) return '';
    const surname = surnamePart.charAt(0).toUpperCase() + surnamePart.slice(1).toLowerCase();
    let initials = '';
    if (parts[1]) initials += ' ' + parts[1].charAt(0).toUpperCase() + '.';
    if (parts[2]) initials += ' ' + parts[2].charAt(0).toUpperCase() + '.';
    return surname + initials;
  };

  return { capitalizeFio, generateShortName };
};