import { useEffect, useRef, useState } from 'react'
import { MAX_IMAGES } from '@damage/shared'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

type PhotoPickerProps = {
  files: File[]
  max?: number
  onChange: (files: File[]) => void
}

function isImage(file: File) {
  return ACCEPT.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
}

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}

export function PhotoPicker({ files, max = MAX_IMAGES, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [note, setNote] = useState('')
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file))
    setUrls(created)
    return () => created.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const open = () => inputRef.current?.click()

  const take = (list: File[]) => {
    if (inputRef.current) inputRef.current.value = ''
    if (list.length === 0) return
    const images = list.filter(isImage)
    const room = Math.max(0, max - files.length)
    const fresh = images.filter((file) => !files.some((current) => sameFile(current, file)))
    const added = fresh.slice(0, room)
    if (added.length) onChange([...files, ...added])
    if (images.length === 0) setNote('تُقبل صور JPEG و PNG و WebP فقط.')
    else if (added.length === 0 && fresh.length === 0) setNote('هذه الصور مضافة مسبقاً.')
    else if (fresh.length > added.length) setNote(`الحد ${max} صور. أُضيف ما يتسع فقط.`)
    else if (images.length < list.length) setNote('تم تجاهل الملفات غير المدعومة.')
    else setNote('')
  }

  return (
    <div
      className={`surface relative p-4 sm:p-5 ${over ? 'ring-2 ring-brass/50' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        take(Array.from(event.dataTransfer.files))
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium tracking-tight text-ink/80">الصور</h2>
        <p className="text-xs font-medium text-muted">
          {files.length} من {max}
        </p>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept={ACCEPT.join(',')}
        multiple
        aria-hidden
        onChange={(event) => take(Array.from(event.target.files ?? []))}
      />
      {files.length === 0 ? (
        <button type="button" className="photo-zone flex w-full flex-col items-center rounded-xl border border-dashed border-line bg-white/55 px-6 py-8 text-center" aria-label="اختيار الصور" onClick={open}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f8efd8] text-brass" aria-hidden>
            <ImageIcon />
          </span>
          <span className="mt-4 text-base font-semibold text-ink">أفلت صور الضرر هنا</span>
          <span className="mt-1 text-sm leading-6 text-muted">أو اخترها من جهازك. JPEG و PNG و WebP.</span>
          <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-pine px-4 text-sm font-semibold text-card">اختيار الصور</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              <figure className="space-y-1.5">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#ece7df]">
                  {urls[index] ? <img src={urls[index]} alt={file.name} className="h-full w-full object-cover" /> : null}
                  <button
                    type="button"
                    className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-[0_1px_3px_rgba(28,25,21,0.18)]"
                    aria-label={`إزالة ${file.name}`}
                    onClick={() => onChange(files.filter((_, item) => item !== index))}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <figcaption className="truncate text-xs text-muted">{file.name}</figcaption>
              </figure>
            </li>
          ))}
          {files.length < max ? (
            <li>
              <button
                type="button"
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-white/55 text-sm font-semibold text-ink"
                onClick={open}
              >
                <PlusIcon />
                إضافة
              </button>
            </li>
          ) : null}
        </ul>
      )}
      {over ? (
        <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-xl border border-dashed border-brass bg-[#fbf8f3]/95 text-sm font-semibold text-brass">
          أفلت الصور هنا
        </div>
      ) : null}
      {note ? <p className="mt-3 text-sm text-[#9f1239]">{note}</p> : null}
    </div>
  )
}

function ImageIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M21 16l-4.5-4.5a1.5 1.5 0 0 0-2.1 0L7 19" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
