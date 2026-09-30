// app/composables/useFamily.ts
import { RELATION_MAP } from '../constants/family';

export const useFamily = () => {
  
  /**
   * Находит Главу семьи для переданного человека
   */
  const getFamilyRoot = (person: any, people: any[]): any => {
    if (!person) return null;
    if (!person.main_family_id) return person;
    return people.find(p => String(p.id) === String(person.main_family_id)) || person;
  };

  /**
   * Получает полный список членов семьи с уже вычисленными перекрестными связями
   */
  const getFullFamily = (targetPerson: any, people: any[]): any[] => {
    if (!targetPerson || !people) return [];
    
    const head = getFamilyRoot(targetPerson, people);
    if (!head) return [];
    
    // Определяем роль целевого человека (для кого собираем список)
    const targetRole = String(targetPerson.id) === String(head.id) 
        ? 'Глава' 
        : (targetPerson.relation || 'Неизвестно');
    
    const familyMembers: any[] = [];
    
    // Если смотрим не на главу, добавляем главу в список его родственников
    if (String(head.id) !== String(targetPerson.id)) {
      const label = getLabelFromMatrix('Глава', targetRole, head.gender || 'male');
      familyMembers.push({ ...head, relation: label });
    }

    // Собираем всех dependants (членов семьи, у которых в main_family_id указан ID главы)
    const dependants = people.filter(p => String(p.main_family_id) === String(head.id));
    
    dependants.forEach(member => {
      // Пропускаем самого человека, чтобы он не был у себя же в родственниках
      if (String(member.id) === String(targetPerson.id)) return;

      const memberRole = member.relation || 'Неизвестно';
      const memberGender = member.gender || 'male';
      
      // Вычисляем, кем приходится этот член семьи целевому человеку
      const label = getLabelFromMatrix(memberRole, targetRole, memberGender);
      
      familyMembers.push({ ...member, relation: label });
    });

    return familyMembers;
  };

  /**
   * Хелпер для поиска в матрице.
   * АРХИТЕКТУРНЫЙ ФИКС: умеет работать как с объектами { male, female }, так и с простыми строками.
   */
  const getLabelFromMatrix = (memberRole: string, targetRole: string, gender: 'male' | 'female'): string => {
    const memberEntry = RELATION_MAP[memberRole];
    if (!memberEntry) return memberRole; 

    const relationEntry = memberEntry[targetRole];
    if (!relationEntry) return memberRole; 

    // Если связь жестко привязана к полу (вернулась строка), просто возвращаем её
    if (typeof relationEntry === 'string') return relationEntry;

    // Если вернулся объект (значит это роль 'Глава'), выбираем по полу того, кто смотрит
    return gender === 'female' ? relationEntry.female : relationEntry.male;
  };

  return { getFamilyRoot, getFullFamily }
}