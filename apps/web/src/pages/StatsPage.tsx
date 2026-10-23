import { useQuery } from '@tanstack/react-query'
import {
  AidStatus,
  DamageLevel,
  PropertyType,
  ReportStatus,
  Role,
  aidStatusLabel,
  damageLevelLabel,
  propertyTypeLabel,
  reportStatusLabel,
} from '@damage/shared'
import { api, type StatsOverview } from '../api'
import { useAuth } from '../auth'
import { AreaChart, BarChart, DonutChart, type ChartSlice } from '../components/charts'
import { ErrorNote, PageTitle } from '../components/ui'

const damageColor: Record<DamageLevel, string> = {
  LOW: '#2f6f4e',
  MEDIUM: '#9a7433',
  HIGH: '#c2410c',
  CRITICAL: '#9f1239',
}

const statusColor: Record<ReportStatus, string> = {
  DRAFT: '#a3988c',
  SUBMITTED: '#3d5a80',
  UNDER_REVIEW: '#9a7433',
  APPROVED: '#27306b',
  REJECTED: '#9f1239',
}

const propertyColor: Record<PropertyType, string> = {
  HOUSE: '#27306b',
  APARTMENT: '#5c6494',
  BUILDING: '#9a7433',
  COMMERCIAL: '#c2410c',
  OTHER: '#8a8178',
}

const aidColor: Record<AidStatus, string> = {
  PLANNED: '#8a8178',
  IN_PROGRESS: '#3d5a80',
  DELIVERED: '#27306b',
  CANCELLED: '#9f1239',
}

function countOf<T extends string>(rows: { count: number }[], key: T, read: (row: { count: number }) => string) {
  return rows.find((row) => read(row) === key)?.count ?? 0
}

function slices<T extends string>(
  keys: T[],
  label: Record<T, string>,
  color: Record<T, string>,
  rows: { count: number }[],
  read: (row: { count: number }) => string,
): ChartSlice[] {
  return keys.map((key) => ({
    key,
    label: label[key],
    color: color[key],
    count: countOf(rows, key, read),
  }))
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1).toLocaleDateString('ar', {
    day: 'numeric',
    month: 'short',
    numberingSystem: 'latn',
  })
}

function last30Days(series: StatsOverview['series']) {
  const counts = new Map(series.map((row) => [row.day, row.count]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (29 - index))
    const key = dayKey(date)
    return { label: dayLabel(key), value: counts.get(key) ?? 0 }
  })
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="surface px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  )
}

export function StatsPage() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['stats'], queryFn: () => api<StatsOverview>('/api/stats/overview') })
  const data = query.data
  const organization = user?.role === Role.ORGANIZATION

  const damage = data
    ? slices(Object.values(DamageLevel), damageLevelLabel, damageColor, data.reportsByDamage, (row) =>
        'damageLevel' in row ? String(row.damageLevel) : '',
      )
    : []
  const statuses = data
    ? slices(Object.values(ReportStatus), reportStatusLabel, statusColor, data.reportsByStatus, (row) =>
        'status' in row ? String(row.status) : '',
      )
    : []
  const properties = data
    ? slices(Object.values(PropertyType), propertyTypeLabel, propertyColor, data.reportsByPropertyType, (row) =>
        'propertyType' in row ? String(row.propertyType) : '',
      )
    : []
  const aid = data
    ? slices(Object.values(AidStatus), aidStatusLabel, aidColor, data.aidByStatus, (row) =>
        'status' in row ? String(row.status) : '',
      )
    : []

  const reportTotal = statuses.reduce((sum, row) => sum + row.count, 0)
  const critical = damage.find((row) => row.key === DamageLevel.CRITICAL)?.count ?? 0
  const delivered = aid.find((row) => row.key === AidStatus.DELIVERED)?.count ?? 0
  const days = data ? last30Days(data.series) : []
  const periodTotal = days.reduce((sum, day) => sum + day.value, 0)

  return (
    <div className="space-y-5">
      <PageTitle
        title="الإحصاء"
        subtitle={organization ? 'البلاغات المعتمدة وتوزيعات منظمتك' : 'صورة عامة عن البلاغات والتوزيع'}
      />
      {query.isLoading ? <p className="text-sm text-muted">جارٍ التحميل…</p> : null}
      {query.isError ? <ErrorNote message="تعذر تحميل الإحصاء" /> : null}
      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label={organization ? 'بلاغات معتمدة' : 'كل البلاغات'} value={reportTotal} hint="ضمن نطاق حسابك" />
            {organization ? (
              <Metric label="قيد التنفيذ" value={aid.find((row) => row.key === AidStatus.IN_PROGRESS)?.count ?? 0} hint="مساعدات لم تُسلّم بعد" />
            ) : (
              <Metric label="بانتظار المراجعة" value={data.pendingReview} hint="مُرسل أو قيد المراجعة" />
            )}
            <Metric label="ضرر حرج" value={critical} hint="يحتاج أولوية" />
            <Metric label="تم التسليم" value={delivered} hint={organization ? 'مساعدات منظمتك' : 'من كل التوزيعات'} />
          </section>
          <article className="surface p-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">آخر 30 يوماً</h2>
              <p className="text-sm tabular-nums text-muted">{periodTotal} بلاغ</p>
            </div>
            <AreaChart points={days} caption={`بلاغات آخر 30 يوماً، المجموع ${periodTotal}`} />
          </article>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="surface p-5">
              <h2 className="mb-4 font-semibold">حسب مستوى الضرر</h2>
              <DonutChart slices={damage} caption="توزيع البلاغات حسب مستوى الضرر" />
            </article>
            <article className="surface p-5">
              <h2 className="mb-4 font-semibold">حسب الحالة</h2>
              <DonutChart slices={statuses} caption="توزيع البلاغات حسب الحالة" />
            </article>
            <article className="surface p-5">
              <h2 className="mb-4 font-semibold">حسب نوع العقار</h2>
              <BarChart rows={properties} />
            </article>
            <article className="surface p-5">
              <h2 className="mb-4 font-semibold">المساعدات</h2>
              <BarChart rows={aid} />
            </article>
          </div>
        </>
      ) : null}
    </div>
  )
}
