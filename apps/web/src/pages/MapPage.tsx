import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Role } from '@damage/shared'
import { reportsApi } from '../api'
import { useAuth } from '../auth'
import { DamageLegend, MapCanvas, type BBox } from '../components/MapCanvas'
import { Filters, emptyFilters, type FilterState } from '../components/Filters'
import { ErrorNote, PageTitle } from '../components/ui'

export function MapPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [box, setBox] = useState<BBox | null>(null)
  const query = useQuery({
    queryKey: ['map', box, filters],
    enabled: Boolean(box),
    queryFn: () => reportsApi.map({ ...filters, ...box! }),
  })

  return (
    <div className="space-y-4">
      <PageTitle
        title="الخريطة"
        subtitle={
          user?.role === Role.ORGANIZATION
            ? 'البلاغات المعتمدة ضمن الإطار الظاهر'
            : user?.role === Role.SUPERVISOR
              ? 'كل البلاغات ضمن الإطار الظاهر'
              : 'بلاغاتك ضمن الإطار الظاهر'
        }
      />
      <Filters value={filters} onChange={setFilters} hideStatus={user?.role === Role.ORGANIZATION} />
      <DamageLegend />
      {query.isError ? <ErrorNote message="تعذر تحميل نقاط الخريطة" /> : null}
      <MapCanvas features={query.data} onBounds={setBox} />
      {query.data && query.data.features.length === 0 ? (
        <p className="text-sm text-[#5e574e]">لا توجد بلاغات داخل هذا الإطار.</p>
      ) : null}
    </div>
  )
}
