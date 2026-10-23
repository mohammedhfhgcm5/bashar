export const DamageLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const
export type DamageLevel = (typeof DamageLevel)[keyof typeof DamageLevel]

export const damageLevelLabel: Record<DamageLevel, string> = {
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'مرتفع',
  CRITICAL: 'حرج',
}
