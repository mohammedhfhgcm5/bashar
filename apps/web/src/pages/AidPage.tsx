import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AidStatus, AidType, ReportStatus, Role, aidStatusLabel, aidTypeLabel, damageLevelLabel } from '@damage/shared'
import { api, reportsApi, type AidRow } from '../api'
import { useAuth } from '../auth'
import { Button, DamageBadge, ErrorNote, Field, PageTitle, fieldClass } from '../components/ui'

export function AidPage() {
  const { user } = useAuth()
  const client = useQueryClient()
  const readOnly = user?.role === Role.SUPERVISOR
  const [error, setError] = useState('')
  const [reportQuery, setReportQuery] = useState('')
  const [form, setForm] = useState<{ reportId: string; aidType: AidType; notes: string; scheduledAt: string }>({
    reportId: '',
    aidType: AidType.FOOD,
    notes: '',
    scheduledAt: '',
  })
  const aid = useQuery({ queryKey: ['aid'], queryFn: () => api<AidRow[]>('/api/aid') })
  const reports = useQuery({
    queryKey: ['reports', 'approved-for-aid', reportQuery],
    enabled: !readOnly,
    queryFn: () =>
      reportsApi.list({
        status: ReportStatus.APPROVED,
        page: 1,
        pageSize: 50,
        ...(reportQuery.trim() ? { q: reportQuery.trim() } : {}),
      }),
  })

  const create = useMutation({
    mutationFn: () =>
      api('/api/aid', {
        method: 'POST',
        body: JSON.stringify({
          reportId: form.reportId,
          aidType: form.aidType,
          notes: form.notes,
          ...(form.scheduledAt ? { scheduledAt: form.scheduledAt } : {}),
        }),
      }),
    onSuccess: async () => {
      setForm({ reportId: '', aidType: AidType.FOOD, notes: '', scheduledAt: '' })
      setError('')
      await client.invalidateQueries({ queryKey: ['aid'] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر إنشاء التوزيع'),
  })
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AidStatus }) =>
      api(`/api/aid/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['aid'] }),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر تحديث التوزيع'),
  })

  return (
    <div className="space-y-6">
      <PageTitle
        title="المساعدات"
        subtitle={readOnly ? 'عرض توزيعات المنظمات على البلاغات المعتمدة' : 'التوزيع مرتبط ببلاغ معتمد ومنظمتك'}
      />
      {error ? <ErrorNote message={error} /> : null}
      {!readOnly ? (
        <form
          className="grid gap-3 surface p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <Field label="بحث برمز البلاغ">
            <input
              className={fieldClass}
              value={reportQuery}
              onChange={(event) => {
                setReportQuery(event.target.value)
                setForm((current) => ({ ...current, reportId: '' }))
              }}
              placeholder="مثلاً RPT-2026"
            />
          </Field>
          <Field label="البلاغ المعتمد">
            <select
              className={fieldClass}
              value={form.reportId}
              onChange={(event) => setForm({ ...form, reportId: event.target.value })}
              required
            >
              <option value="">اختر بلاغاً</option>
              {(reports.data?.items ?? []).map((report) => (
                <option key={report.id} value={report.id}>
                  {report.referenceCode} · {damageLevelLabel[report.damageLevel]} · {report.property.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع المساعدة">
            <select className={fieldClass} value={form.aidType} onChange={(event) => setForm({ ...form, aidType: event.target.value as AidType })}>
              {Object.values(AidType).map((type) => (
                <option key={type} value={type}>{aidTypeLabel[type]}</option>
              ))}
            </select>
          </Field>
          <Field label="موعد مجدول">
            <input className={fieldClass} type="date" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} />
          </Field>
          <Field label="ملاحظات">
            <input className={fieldClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
          <div className="md:col-span-2"><Button type="submit" disabled={create.isPending || !form.reportId}>تسجيل التوزيع</Button></div>
        </form>
      ) : null}
      {(aid.data ?? []).length === 0 && !aid.isLoading ? <p className="text-sm text-[#5e574e]">لا توجد توزيعات بعد.</p> : null}
      <ul className="space-y-3">
        {(aid.data ?? []).map((row) => (
          <li key={row.id} className="space-y-3 surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link className="font-semibold text-pine" to={`/reports/${row.report.id}`}>{row.report.referenceCode}</Link>
                <p className="text-sm text-[#5e574e]">
                  {aidTypeLabel[row.aidType]} · {row.report.property?.address}
                  {row.organization?.name ? ` · ${row.organization.name}` : ''}
                </p>
              </div>
              <DamageBadge level={row.report.damageLevel} />
            </div>
            <p className="text-sm">الحالة: {aidStatusLabel[row.status]}</p>
            {row.notes ? <p className="text-sm text-[#5e574e]">{row.notes}</p> : null}
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                {Object.values(AidStatus).map((status) => (
                  <Button key={status} type="button" variant={status === row.status ? 'primary' : 'ghost'} onClick={() => update.mutate({ id: row.id, status })}>
                    {aidStatusLabel[status]}
                  </Button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
