import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { damageLevelLabel, reportStatusLabel, type DamageLevel, type ReportStatus } from '@damage/shared'

export const fieldClass =
  'w-full rounded-xl border border-black/5 bg-white/80 px-3.5 py-3 text-base text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] outline-none transition focus:border-brass/50 focus:bg-white focus:ring-4 focus:ring-brass/15'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium tracking-tight text-ink/80">{label}</span>
      {children}
      {hint ? <span className="block text-sm text-[#9f1239]">{hint}</span> : null}
    </label>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'brass' }) {
  const styles = {
    primary: 'bg-pine text-card hover:bg-[#1f2757] active:bg-[#181e45]',
    ghost: 'border border-black/10 bg-white/70 text-ink hover:bg-white',
    danger: 'bg-[#9f1239] text-white hover:bg-[#881337]',
    brass: 'bg-brass text-white hover:bg-[#86652c]',
  }[variant]
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    />
  )
}

const damageTone: Record<DamageLevel, string> = {
  LOW: 'bg-[#e7f3ec] text-[#1f5c3a]',
  MEDIUM: 'bg-[#f8efd8] text-[#8a5a10]',
  HIGH: 'bg-[#fde7d8] text-[#9a3412]',
  CRITICAL: 'bg-[#f8d7e1] text-[#9f1239]',
}

const statusTone: Record<ReportStatus, string> = {
  DRAFT: 'bg-[#ece7df] text-[#4b453e]',
  SUBMITTED: 'bg-[#e7eef8] text-[#1e3a8a]',
  UNDER_REVIEW: 'bg-[#f8efd8] text-[#8a5a10]',
  APPROVED: 'bg-[#e8eaf5] text-[#27306b]',
  REJECTED: 'bg-[#f8d7e1] text-[#9f1239]',
}

export function DamageBadge({ level }: { level: DamageLevel }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${damageTone[level]}`}>{damageLevelLabel[level]}</span>
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[status]}`}>{reportStatusLabel[status]}</span>
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="surface px-6 py-14 text-center" role="status">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{body}</p>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-[#f8d7e1] px-3.5 py-2.5 text-sm font-medium text-[#9f1239]" role="alert">
      {message}
    </p>
  )
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-[1.75rem] font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p> : null}
    </header>
  )
}
