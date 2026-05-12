// utils/profileCompleteness.ts
export const calculateCompleteness = (user: any) => {
  const fields = [
    { key: 'name', fallback: 'userName', weight: 10 },
    { key: 'email', weight: 10 },
    { key: 'phone', weight: 10 },
    { key: 'location', fallback: 'address', weight: 10 },
    { key: 'about', weight: 10 },
    { key: 'profileImage', fallback: 'avatar', weight: 10 },
    { key: 'skills', weight: 10 },
    { key: 'gpa', fallback: 'gwa', weight: 10 },
    { key: 'fieldOfStudy', fallback: 'course', weight: 10 },
    { key: 'incomeCategory', fallback: 'netWorth', weight: 10 },
  ]
  return fields.reduce((total, field) => {
    const value = user[field.key] ?? user[field.fallback]
    const filled = value !== null &&
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    return total + (filled ? field.weight : 0)
  }, 0)
}