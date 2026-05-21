// app/composables/useFamily.ts
import { RELATION_MAP } from '../constants/family';

export const useFamily = () => {
  
  // Матрица теперь живет в constants/family.ts
  
  const getFamilyRoot = (person: any, people: any[]): any => {
    if (!person) return null;
    if (!person.main_family_id) return person;
    return people.find(p => String(p.id) === String(person.main_family_id)) || person;
  };

  const getFullFamily = (targetPerson: any, people: any[]): any[] => {
    if (!targetPerson || !people) return [];
    
    const head = getFamilyRoot(targetPerson, people);
    if (!head) return [];
    
    const targetRole = String(targetPerson.id) === String(head.id) 
        ? 'Глава' 
        : (targetPerson.relation || 'Неизвестно');
    
    const familyMembers: any[] = [];
    
    if (String(head.id) !== String(targetPerson.id)) {
      const label = getLabelFromMatrix('Глава', targetRole, head.gender || 'male');
      familyMembers.push({ ...head, relation: label });
    }

    const dependants = people.filter(p => String(p.main_family_id) === String(head.id));
    
    dependants.forEach(member => {
      if (String(member.id) === String(targetPerson.id)) return;

      const memberRole = member.relation || 'Неизвестно';
      const memberGender = member.gender || 'male';
      
      const label = getLabelFromMatrix(memberRole, targetRole, memberGender);
      
      familyMembers.push({ ...member, relation: label });
    });

    return familyMembers;
  };

  // Хелпер для поиска в матрице
  const getLabelFromMatrix = (memberRole: string, targetRole: string, gender: 'male' | 'female'): string => {
    const memberEntry = RELATION_MAP[memberRole];
    if (!memberEntry) return memberRole; 

    const relationEntry = memberEntry[targetRole];
    if (!relationEntry) return memberRole; 

    return gender === 'female' ? relationEntry.female : relationEntry.male;
  };

  return { getFamilyRoot, getFullFamily }
}