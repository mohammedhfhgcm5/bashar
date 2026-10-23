import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { propertyTypeLabel, Role } from '@damage/shared'
import { reportsApi } from '../api'
import { useAuth } from '../auth'
import { Filters, emptyFilters, type FilterState } from '../components/Filters'
import { Button, DamageBadge, EmptyState, ErrorNote, PageTitle, StatusBadge } from '../components/ui'

export function ReportsPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['reports', filters, page],
    queryFn: () => reportsApi.list({ ...filters, page }),
  })
  const total = query.data?.total ?? 0
  const pageSize = query.data?.pageSize ?? 20
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <PageTitle
        title={user?.role === Role.ORGANIZATION ? 'البلاغات المعتمدة' : 'البلاغات'}
        subtitle={user?.role === Role.SUPERVISOR ? 'طابور المراجعة والبحث' : 'تابع حالة البلاغات المتاحة لك'}
      />
      <Filters
        value={filters}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
        }}
        hideStatus={user?.role === Role.ORGANIZATION}
      />
      {query.isError ? <ErrorNote message="تعذر تحميل البلاغات" /> : null}
      {query.isLoading ? <p className="text-sm text-[#5e574e]">جارٍ التحميل…</p> : null}
      {query.data && query.data.items.length === 0 ? (
        <EmptyState title="لا توجد بلاغات" body="غيّر عوامل التصفية أو أنشئ بلاغاً جديداً إذا كان الدور يسمح بذلك." />
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <div className="overflow-hidden surface">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f1e8] text-[#5e574e]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">الرمز</th>
                  <th className="px-4 py-3 text-right font-medium">العنوان</th>
                  <th className="px-4 py-3 text-right font-medium">الضرر</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">مقدّم البلاغ</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-pine underline-offset-4 hover:underline" to={`/reports/${item.id}`}>
                        {item.referenceCode}
                      </Link>
                      <div className="text-xs text-[#5e574e]">{propertyTypeLabel[item.property.propertyType]} · {item.imageCount} صور</div>
                    </td>
                    <td className="px-4 py-3">{item.property.address}</td>
                    <td className="px-4 py-3"><DamageBadge level={item.damageLevel} /></td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="hidden px-4 py-3 md:table-cell">{item.submittedBy.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5e574e]">
            <p>
              صفحة {page} من {pageCount} · {total} بلاغ
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => current - 1)}>
                السابق
              </Button>
              <Button type="button" variant="ghost" disabled={page >= pageCount || query.isFetching} onClick={() => setPage((current) => current + 1)}>
                التالي
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
