import {
  DamageLevel,
  PropertyType,
  ReportStatus,
  damageLevelLabel,
  propertyTypeLabel,
  reportStatusLabel,
} from '@damage/shared'
import { fieldClass } from './ui'

export type FilterState = {
  status: string
  damageLevel: string
  propertyType: string
  q: string
  from: string
  to: string
}

export const emptyFilters: FilterState = { status: '', damageLevel: '', propertyType: '', q: '', from: '', to: '' }

export function Filters({
  value,
  onChange,
  hideStatus = false,
}: {
  value: FilterState
  onChange: (next: FilterState) => void
  hideStatus?: boolean
}) {
  const set = (key: keyof FilterState, next: string) => onChange({ ...value, [key]: next })
  return (
    <div className="surface grid gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
      {hideStatus ? null : (
        <select className={fieldClass} value={value.status} onChange={(event) => set('status', event.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {Object.values(ReportStatus).map((status) => (
            <option key={status} value={status}>
              {reportStatusLabel[status]}
            </option>
          ))}
        </select>
      )}
      <select className={fieldClass} value={value.damageLevel} onChange={(event) => set('damageLevel', event.target.value)} aria-label="مستوى الضرر">
        <option value="">كل المستويات</option>
        {Object.values(DamageLevel).map((level) => (
          <option key={level} value={level}>
            {damageLevelLabel[level]}
          </option>
        ))}
      </select>
      <select className={fieldClass} value={value.propertyType} onChange={(event) => set('propertyType', event.target.value)} aria-label="نوع العقار">
        <option value="">كل الأنواع</option>
        {Object.values(PropertyType).map((type) => (
          <option key={type} value={type}>
            {propertyTypeLabel[type]}
          </option>
        ))}
      </select>
      <input className={fieldClass} placeholder="رمز البلاغ" value={value.q} onChange={(event) => set('q', event.target.value)} aria-label="رمز البلاغ" />
      <input className={fieldClass} type="date" value={value.from} onChange={(event) => set('from', event.target.value)} aria-label="من تاريخ" />
      <input className={fieldClass} type="date" value={value.to} onChange={(event) => set('to', event.target.value)} aria-label="إلى تاريخ" />
    </div>
  )
}
