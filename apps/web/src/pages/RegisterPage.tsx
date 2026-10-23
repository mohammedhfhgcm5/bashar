import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate } from 'react-router-dom'
import { Role, registerSchema } from '@damage/shared'
import type { z } from 'zod'
import { useAuth } from '../auth'
import { Button, ErrorNote, Field, fieldClass } from '../components/ui'

type FormValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const { user, register: signUp } = useAuth()
  const [error, setError] = useState('')
  const form = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: Role.CITIZEN },
  })
  if (user) return <Navigate to="/map" replace />

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-4xl font-semibold">حساب جديد</h1>
      <p className="mt-2 text-sm leading-6 text-muted">التسجيل متاح للمواطن والمقيم. حسابات المشرف والمنظمة يصدرها المشرف.</p>
      <form
        className="surface mt-8 space-y-4 p-6"
        onSubmit={form.handleSubmit(async (values) => {
          setError('')
          try {
            await signUp(values)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'تعذر التسجيل')
          }
        })}
      >
        {error ? <ErrorNote message={error} /> : null}
        <Field label="الاسم" hint={form.formState.errors.fullName?.message}>
          <input className={fieldClass} {...form.register('fullName')} />
        </Field>
        <Field label="البريد" hint={form.formState.errors.email?.message}>
          <input className={fieldClass} type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="الهاتف" hint={form.formState.errors.phone?.message}>
          <input className={fieldClass} {...form.register('phone')} />
        </Field>
        <Field label="كلمة المرور" hint={form.formState.errors.password?.message}>
          <input className={fieldClass} type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium tracking-tight text-ink/80">الدور</legend>
          <div className="segmented">
            <button type="button" aria-pressed={form.watch('role') === Role.CITIZEN} onClick={() => form.setValue('role', Role.CITIZEN)}>
              مواطن
            </button>
            <button type="button" aria-pressed={form.watch('role') === Role.RESIDENT} onClick={() => form.setValue('role', Role.RESIDENT)}>
              مقيم
            </button>
          </div>
          <input type="hidden" {...form.register('role')} />
        </fieldset>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>إنشاء الحساب</Button>
        <p className="text-center text-sm">
          <Link className="text-pine underline" to="/login">لديك حساب؟ ادخل</Link>
        </p>
      </form>
    </main>
  )
}
