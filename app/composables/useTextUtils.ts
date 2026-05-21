// composables/useTextUtils.ts
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
    if (parts.length === 0) return '';
    const surname = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    let initials = '';
    if (parts[1]) initials += ' ' + parts[1].charAt(0).toUpperCase() + '.';
    if (parts[2]) initials += ' ' + parts[2].charAt(0).toUpperCase() + '.';
    return surname + initials;
  };

  return { capitalizeFio, generateShortName };
};