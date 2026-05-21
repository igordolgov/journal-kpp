// app/composables/useCustomAssets.ts
import { useNuxtApp } from '#app'

export const useCustomAssets = () => {
  // useState сохраняет данные глобально на уровне всего приложения.
  // Данные не пропадут при переходе между страницами!
  const customPeople = useState<any[]>('custom-people', () => [])

  // Если вы хотите, чтобы они сохранялись даже после перезагрузки браузера (F5),
  // можно добавить загрузку из localStorage при первой инициализации:
  if (process.client && customPeople.value.length === 0) {
    const saved = localStorage.getItem('my_custom_people')
    if (saved) {
      try { customPeople.value = JSON.parse(saved) } catch(e) {}
    }
  }

  const addPerson = (person: any) => {
    // Защита от дубликатов
    if (!customPeople.value.find(p => p.id === person.id)) {
      customPeople.value.push(person)
      
      // Сохраняем в localStorage (опционально)
      if (process.client) {
        localStorage.setItem('my_custom_people', JSON.stringify(customPeople.value))
      }
    }
  }

  return {
    customPeople,
    addPerson
  }
}