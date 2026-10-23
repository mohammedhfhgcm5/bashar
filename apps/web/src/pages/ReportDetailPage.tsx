import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DamageLevel,
  MAX_IMAGES,
  PropertyType,
  ReportStatus,
  ReviewAction,
  Role,
  aidStatusLabel,
  aidTypeLabel,
  damageLevelLabel,
  propertyTypeLabel,
  reviewActionLabel,
  type VisionDetectionView,
} from '@damage/shared'
import { apiBlob, reportsApi, type ReportDetail } from '../api'
import { useAuth } from '../auth'
import { MapCanvas } from '../components/MapCanvas'
import { Button, DamageBadge, ErrorNote, Field, PageTitle, StatusBadge, fieldClass } from '../components/ui'

const levelStroke: Record<DamageLevel, string> = {
  LOW: '#2f6f4e',
  MEDIUM: '#a16207',
  HIGH: '#c2410c',
  CRITICAL: '#9f1239',
}

function ReportImage({
  url,
  name,
  detections,
}: {
  url: string
  name: string
  detections: VisionDetectionView[]
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    apiBlob(url)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (active) setSrc('')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])
  if (!src) return <div className="h-48 animate-pulse rounded-xl bg-[#efe6d6]" />
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#1a1a1a]">
      <img src={src} alt={name} className="h-48 w-full object-cover" />
      {detections.length > 0 ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
          {detections.map((detection, index) => {
            const [x, y, w, h] = detection.box
            const stroke = levelStroke[detection.level]
            return (
              <g key={`${detection.classId}-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={`${stroke}33`}
                  stroke={stroke}
                  strokeWidth={0.008}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
        </svg>
      ) : null}
      {detections.length > 0 ? (
        <ul className="absolute bottom-2 right-2 left-2 flex flex-wrap gap-1">
          {detections.slice(0, 4).map((detection, index) => (
            <li
              key={`${detection.label}-${index}`}
              className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
            >
              {detection.label} · {Math.round(detection.confidence * 100)}٪
            </li>
          ))}
          {detections.length > 4 ? (
            <li className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">+{detections.length - 4}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

export function ReportDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const client = useQueryClient()
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const query = useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id) })
  const report = query.data

  const refresh = async (next: ReportDetail) => {
    client.setQueryData(['report', id], next)
    await client.invalidateQueries({ queryKey: ['reports'] })
    await client.invalidateQueries({ queryKey: ['map'] })
  }

  const update = useMutation({
    mutationFn: (body: unknown) => reportsApi.update(id, body),
    onSuccess: (next) => {
      setError('')
      return refresh(next)
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر الحفظ'),
  })
  const submit = useMutation({
    mutationFn: async (body: unknown) => {
      await reportsApi.update(id, body)
      return reportsApi.submit(id)
    },
    onSuccess: refresh,
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر الإرسال'),
  })
  const review = useMutation({
    mutationFn: (body: unknown) => reportsApi.review(id, body),
    onSuccess: (next) => {
      setNote('')
      setError('')
      return refresh(next)
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذرت المراجعة'),
  })
  const addImages = useMutation({
    mutationFn: (files: File[]) => {
      const body = new FormData()
      files.forEach((file) => body.append('images', file))
      return reportsApi.addImages(id, body)
    },
    onSuccess: refresh,
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر رفع الصور'),
  })
  const removeImage = useMutation({
    mutationFn: (imageId: string) => reportsApi.removeImage(id, imageId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['report', id] }),
  })
  const assess = useMutation({
    mutationFn: () => reportsApi.assess(id),
    onSuccess: refresh,
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر تقييم الصور'),
  })

  if (query.isLoading) return <p className="text-sm text-muted" role="status">جارٍ التحميل…</p>
  if (query.isError || !report || !user) return <ErrorNote message="البلاغ غير متاح" />

  const ownerEdit =
    report.submittedBy.id === user.id &&
    (report.status === ReportStatus.DRAFT || report.status === ReportStatus.REJECTED)
  const supervisorReview =
    user.role === Role.SUPERVISOR &&
    (report.status === ReportStatus.SUBMITTED || report.status === ReportStatus.UNDER_REVIEW)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={report.referenceCode} subtitle={report.property.address} />
        <div className="flex gap-2">
          <DamageBadge level={report.damageLevel} />
          <StatusBadge status={report.status} />
        </div>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {report.rejectionReason ? (
        <p className="rounded-xl bg-[#f8d7e1] px-4 py-3 text-sm text-[#9f1239]">سبب الرفض: {report.rejectionReason}</p>
      ) : null}
      <section className="grid gap-4 surface p-5 md:grid-cols-2">
        <p className="md:col-span-2 leading-7">{report.description}</p>
        <p className="text-sm text-[#5e574e]">النوع: {propertyTypeLabel[report.property.propertyType]}</p>
        <p className="text-sm text-[#5e574e]">الموقع: {report.property.lat.toFixed(5)} ، {report.property.lng.toFixed(5)}</p>
        <p className="text-sm text-[#5e574e]">مقدّم البلاغ: {report.submittedBy.fullName}</p>
        {report.submittedBy.phone ? <p className="text-sm text-[#5e574e]">الهاتف: {report.submittedBy.phone}</p> : null}
        {report.submittedBy.email ? <p className="text-sm text-[#5e574e]">البريد: {report.submittedBy.email}</p> : null}
      </section>
      <AssessmentPanel
        report={report}
        pending={assess.isPending}
        onReassess={() => assess.mutate()}
      />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {report.images.map((image) => {
          const detections = report.assessment?.images.find((item) => item.imageId === image.id)?.detections ?? []
          return (
            <figure key={image.id} className="space-y-2">
              <ReportImage url={image.url} name={image.originalName} detections={detections} />
              <figcaption className="flex items-center justify-between gap-2 text-xs text-[#5e574e]">
                <span className="truncate">{image.originalName}</span>
                {ownerEdit ? (
                  <button className="shrink-0 text-[#9f1239]" onClick={() => removeImage.mutate(image.id)}>حذف</button>
                ) : null}
              </figcaption>
              {detections.length > 0 ? (
                <p className="text-xs leading-5 text-ink">
                  {detections.length} كشف · أعلى ثقة {Math.round(Math.max(...detections.map((item) => item.confidence)) * 100)}٪
                </p>
              ) : (
                <p className="text-xs text-[#5e574e]">لا يوجد كشف على هذه الصورة</p>
              )}
            </figure>
          )
        })}
      </section>
      {ownerEdit ? (
        <OwnerEditor
          report={report}
          pending={update.isPending || submit.isPending || addImages.isPending}
          onSave={(body) => update.mutate(body)}
          onSubmit={(body) => submit.mutate(body)}
          onFiles={(files) => {
            if (report.images.length + files.length > MAX_IMAGES) {
              setError('الحد عشر صور لكل بلاغ')
              return
            }
            addImages.mutate(files)
          }}
        />
      ) : null}
      {supervisorReview ? (
        <SupervisorReview
          report={report}
          note={note}
          setNote={setNote}
          pending={review.isPending || update.isPending}
          onAction={(action, damageLevel, description) => {
            if (action === ReviewAction.REJECT && note.trim().length < 3) {
              setError('سبب الرفض مطلوب')
              return
            }
            review.mutate({ action, damageLevel, description, note })
          }}
        />
      ) : null}
      {report.reviewLogs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">سجل المراجعة</h2>
          <ul className="space-y-2">
            {report.reviewLogs.map((log) => (
              <li key={log.id} className="surface px-4 py-3 text-sm">
                <span className="font-semibold">{reviewActionLabel[log.action]}</span>
                <span className="text-[#5e574e]"> · {log.actor.fullName}</span>
                {log.note ? <p className="mt-1">{log.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {report.aidRecords && report.aidRecords.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">المساعدات</h2>
            {user.role === Role.ORGANIZATION || user.role === Role.SUPERVISOR ? (
              <Link className="text-sm text-pine underline" to="/aid">
                {user.role === Role.SUPERVISOR ? 'عرض التوزيعات' : 'إدارة التوزيع'}
              </Link>
            ) : null}
          </div>
          <ul className="space-y-2">
            {report.aidRecords.map((aid) => (
              <li key={aid.id} className="surface space-y-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{aid.organization.name}</span>
                  <span>{aidStatusLabel[aid.status]}</span>
                </div>
                <p className="text-[#5e574e]">{aidTypeLabel[aid.aidType]}</p>
                {aid.scheduledAt ? (
                  <p className="text-xs text-[#5e574e]">موعد: {new Date(aid.scheduledAt).toLocaleDateString('ar')}</p>
                ) : null}
                {aid.notes ? <p className="leading-6">{aid.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function AssessmentPanel({
  report,
  pending,
  onReassess,
}: {
  report: ReportDetail
  pending: boolean
  onReassess: () => void
}) {
  const assessment = report.assessment
  return (
    <section className="space-y-3 surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">اقتراح النموذج</h2>
        {assessment?.suggestedLevel ? <DamageBadge level={assessment.suggestedLevel} /> : null}
      </div>
      <p className="text-sm leading-7 text-[#5e574e]">
        {assessment?.summary ?? 'لم تُقيَّم الصور بعد. التقييم يجمع كل صور البلاغ ثم يقترح نوع الضرر.'}
      </p>
      <div className="flex flex-wrap gap-4 text-sm text-[#5e574e]">
        {assessment?.confidence != null ? <p>الثقة {Math.round(assessment.confidence * 100)}٪</p> : null}
        {assessment?.coverageRatio != null ? (
          <p>تغطية العيوب {Math.round(assessment.coverageRatio * 100)}٪</p>
        ) : null}
      </div>
      {assessment && assessment.totals.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {assessment.totals.map((row) => (
            <li key={row.key} className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-ink">
              {row.label} · {row.count}
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="ghost" disabled={pending} onClick={onReassess}>
        {pending ? 'جارٍ التقييم…' : 'تقييم الصور'}
      </Button>
    </section>
  )
}

function OwnerEditor({
  report,
  pending,
  onSave,
  onSubmit,
  onFiles,
}: {
  report: ReportDetail
  pending: boolean
  onSave: (body: unknown) => void
  onSubmit: (body: unknown) => void
  onFiles: (files: File[]) => void
}) {
  const [description, setDescription] = useState(report.description)
  const [damageLevel, setDamageLevel] = useState(report.damageLevel)
  const [address, setAddress] = useState(report.property.address)
  const [propertyType, setPropertyType] = useState(report.property.propertyType)
  const [lat, setLat] = useState(report.property.lat)
  const [lng, setLng] = useState(report.property.lng)
  const payload = { description, damageLevel, address, propertyType, lat, lng }
  return (
    <section className="space-y-4 surface p-5">
      <h2 className="font-semibold">{report.status === ReportStatus.DRAFT ? 'تعديل المسودة' : 'تعديل البلاغ المرفوض'}</h2>
      <MapCanvas
        pin={{ lat, lng }}
        onPick={(nextLat, nextLng) => {
          setLat(nextLat)
          setLng(nextLng)
        }}
      />
      <p className="text-sm text-[#5e574e]">
        {lat.toFixed(5)} ، {lng.toFixed(5)} — انقر على الخريطة لنقل النقطة
      </p>
      <Field label="العنوان">
        <input className={fieldClass} value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      <Field label="نوع العقار">
        <select className={fieldClass} value={propertyType} onChange={(event) => setPropertyType(event.target.value as PropertyType)}>
          {Object.values(PropertyType).map((type) => (
            <option key={type} value={type}>{propertyTypeLabel[type]}</option>
          ))}
        </select>
      </Field>
      <Field label="الوصف">
        <textarea className={`${fieldClass} min-h-28`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="مستوى الضرر">
        <select className={fieldClass} value={damageLevel} onChange={(event) => setDamageLevel(event.target.value as DamageLevel)}>
          {Object.values(DamageLevel).map((level) => (
            <option key={level} value={level}>{damageLevelLabel[level]}</option>
          ))}
        </select>
      </Field>
      {report.assessment?.suggestedLevel ? (
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setDamageLevel(report.assessment!.suggestedLevel!)}>
          استخدام المستوى المقترح ({damageLevelLabel[report.assessment.suggestedLevel]})
        </Button>
      ) : null}
      <Field label="إضافة صور">
        <input
          className={fieldClass}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) onFiles(files)
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => onSave(payload)}>حفظ</Button>
        <Button type="button" disabled={pending} onClick={() => onSubmit(payload)}>
          {report.status === ReportStatus.REJECTED ? 'إعادة الإرسال' : 'إرسال البلاغ'}
        </Button>
      </div>
    </section>
  )
}

function SupervisorReview({
  report,
  note,
  setNote,
  pending,
  onAction,
}: {
  report: ReportDetail
  note: string
  setNote: (value: string) => void
  pending: boolean
  onAction: (action: ReviewAction, damageLevel: DamageLevel, description: string) => void
}) {
  const [damageLevel, setDamageLevel] = useState(report.damageLevel)
  const [description, setDescription] = useState(report.description)
  return (
    <section className="space-y-4 surface p-5">
      <h2 className="font-semibold">المراجعة</h2>
      <Field label="وصف الضرر">
        <textarea className={`${fieldClass} min-h-28`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="مستوى الضرر">
        <select className={fieldClass} value={damageLevel} onChange={(event) => setDamageLevel(event.target.value as DamageLevel)}>
          {Object.values(DamageLevel).map((level) => (
            <option key={level} value={level}>{damageLevelLabel[level]}</option>
          ))}
        </select>
      </Field>
      {report.assessment?.suggestedLevel ? (
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setDamageLevel(report.assessment!.suggestedLevel!)}>
          استخدام المستوى المقترح ({damageLevelLabel[report.assessment.suggestedLevel]})
        </Button>
      ) : null}
      <Field label="ملاحظة">
        <textarea className={`${fieldClass} min-h-20`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => onAction(ReviewAction.APPROVE, damageLevel, description)}>اعتماد</Button>
        <Button type="button" variant="brass" disabled={pending} onClick={() => onAction(ReviewAction.EDIT, damageLevel, description)}>حفظ التعديل</Button>
        <Button type="button" variant="danger" disabled={pending} onClick={() => onAction(ReviewAction.REJECT, damageLevel, description)}>رفض</Button>
      </div>
    </section>
  )
}
