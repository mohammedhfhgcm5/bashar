import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  DamageLevel,
  MAX_IMAGES,
  PropertyType,
  ReportStatus,
  propertyTypeLabel,
  reportFieldsSchema,
} from '@damage/shared'
import { ApiError, reportsApi } from '../api'
import { MapCanvas } from '../components/MapCanvas'
import { Button, DamageBadge, ErrorNote, Field, PageTitle, fieldClass } from '../components/ui'

type Draft = {
  address: string
  lat: string
  lng: string
  propertyType: PropertyType
  description: string
  damageLevel: DamageLevel
  files: File[]
}

const initial: Draft = {
  address: '',
  lat: '',
  lng: '',
  propertyType: PropertyType.HOUSE,
  description: '',
  damageLevel: DamageLevel.MEDIUM,
  files: [],
}

type Preview = Awaited<ReturnType<typeof reportsApi.preview>> & { signature: string }

function fileSignature(files: File[]) {
  return files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join('|')
}

export function NewReportPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(initial)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)

  const previewMutation = useMutation({
    mutationFn: (files: File[]) => {
      const body = new FormData()
      files.forEach((file) => body.append('images', file))
      return reportsApi.preview(body).then((result) => ({ ...result, signature: fileSignature(files) }))
    },
    onSuccess: (result) => {
      setPreview(result)
      setError('')
      if (result.suggestedLevel) {
        setDraft((current) => ({ ...current, damageLevel: result.suggestedLevel! }))
      } else if (result.status === 'READY') {
        setDraft((current) => ({ ...current, damageLevel: DamageLevel.LOW }))
      }
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر تقييم الصور'),
  })

  const mutation = useMutation({
    mutationFn: ({
      intent,
      damageLevel,
    }: {
      intent: typeof ReportStatus.DRAFT | typeof ReportStatus.SUBMITTED
      damageLevel: DamageLevel
    }) => {
      const parsed = reportFieldsSchema.safeParse({ ...draft, damageLevel, lat: Number(draft.lat), lng: Number(draft.lng), intent })
      if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message || 'تحقق من الحقول', 400)
      if (intent === ReportStatus.SUBMITTED && draft.files.length === 0) {
        throw new ApiError('أرفق صورة واحدة على الأقل', 400)
      }
      const body = new FormData()
      Object.entries(parsed.data).forEach(([key, value]) => body.append(key, String(value)))
      draft.files.forEach((file) => body.append('images', file))
      return reportsApi.create(body)
    },
    onSuccess: (report) => navigate(`/reports/${report.id}`),
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'تعذر حفظ البلاغ'),
  })

  const freshPreview = preview && preview.signature === fileSignature(draft.files) ? preview : null

  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }))
      },
      () => setError('تعذر قراءة الموقع. حدّد النقطة على الخريطة.'),
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle title="بلاغ جديد" subtitle="الموقع، ثم وصف الضرر، ثم الصور. مستوى الضرر يحدده النموذج." />
      <ol className="stepper" aria-label="خطوات البلاغ">
        {['الموقع', 'الوصف', 'الصور'].map((label, index) => (
          <li key={label} data-state={index === step ? 'current' : index < step ? 'done' : 'upcoming'}>
            {label}
          </li>
        ))}
      </ol>
      {error ? <ErrorNote message={error} /> : null}
      {step === 0 ? (
        <section className="space-y-4">
          <MapCanvas
            pin={draft.lat && draft.lng ? { lat: Number(draft.lat), lng: Number(draft.lng) } : null}
            onPick={(lat, lng) => setDraft((current) => ({ ...current, lat: lat.toFixed(6), lng: lng.toFixed(6) }))}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={locate}>استخدام موقعي</Button>
            <span className="self-center text-sm text-[#5e574e]">
              {draft.lat ? `${draft.lat} ، ${draft.lng}` : 'انقر على الخريطة لتحديد العقار'}
            </span>
          </div>
          <Field label="العنوان">
            <input className={fieldClass} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
          </Field>
          <Field label="نوع العقار">
            <select className={fieldClass} value={draft.propertyType} onChange={(event) => setDraft({ ...draft, propertyType: event.target.value as PropertyType })}>
              {Object.values(PropertyType).map((type) => (
                <option key={type} value={type}>{propertyTypeLabel[type]}</option>
              ))}
            </select>
          </Field>
          <Button
            type="button"
            onClick={() => {
              if (!draft.lat || draft.address.trim().length < 3) {
                setError('حدد الموقع واكتب عنواناً واضحاً')
                return
              }
              setError('')
              setStep(1)
            }}
          >
            التالي
          </Button>
        </section>
      ) : null}
      {step === 1 ? (
        <section className="space-y-4">
          <Field label="وصف الضرر">
            <textarea className={`${fieldClass} min-h-32`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>السابق</Button>
            <Button
              type="button"
              onClick={() => {
                if (draft.description.trim().length < 10) {
                  setError('صف الضرر بما لا يقل عن 10 أحرف')
                  return
                }
                setError('')
                setStep(2)
              }}
            >
              التالي
            </Button>
          </div>
        </section>
      ) : null}
      {step === 2 ? (
        <section className="space-y-4">
          <Field label={`الصور (حد ${MAX_IMAGES})`}>
            <input
              className={fieldClass}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                setPreview(null)
                setDraft({ ...draft, files: Array.from(event.target.files ?? []).slice(0, MAX_IMAGES) })
              }}
            />
          </Field>
          <p className="text-sm text-[#5e574e]">{draft.files.length ? draft.files.map((file) => file.name).join('، ') : 'لم تُختر صور بعد'}</p>
          <div className="surface space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">مستوى الضرر</h2>
              {freshPreview?.status === 'READY' ? (
                <DamageBadge level={freshPreview.suggestedLevel ?? DamageLevel.LOW} />
              ) : null}
            </div>
            <p className="text-sm leading-7 text-[#5e574e]">
              {freshPreview?.summary ?? 'ارفع الصور ثم أرسلها للنموذج ليحدد مستوى الضرر.'}
            </p>
            {freshPreview?.confidence != null ? (
              <p className="text-sm text-[#5e574e]">الثقة {Math.round(freshPreview.confidence * 100)}٪</p>
            ) : null}
            {freshPreview && freshPreview.totals.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {freshPreview.totals.map((row) => (
                  <li key={row.key} className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-ink">
                    {row.label} · {row.count}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={previewMutation.isPending || draft.files.length === 0}
              onClick={() => previewMutation.mutate(draft.files)}
            >
              {previewMutation.isPending ? 'جارٍ التقييم…' : 'تقييم الصور بالنموذج'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>السابق</Button>
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending || previewMutation.isPending}
              onClick={() =>
                mutation.mutate({
                  intent: ReportStatus.DRAFT,
                  damageLevel: freshPreview?.suggestedLevel ?? draft.damageLevel,
                })
              }
            >
              حفظ مسودة
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || previewMutation.isPending}
              onClick={() => {
                if (draft.files.length === 0) {
                  setError('أرفق صورة واحدة على الأقل')
                  return
                }
                if (!freshPreview || freshPreview.status !== 'READY') {
                  setError('قيّم الصور بالنموذج قبل الإرسال')
                  return
                }
                setError('')
                mutation.mutate({
                  intent: ReportStatus.SUBMITTED,
                  damageLevel: freshPreview.suggestedLevel ?? DamageLevel.LOW,
                })
              }}
            >
              إرسال البلاغ
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
