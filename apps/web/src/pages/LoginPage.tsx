import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate } from 'react-router-dom'
import { loginSchema } from '@damage/shared'
import type { z } from 'zod'
import { useState } from 'react'
import { useAuth } from '../auth'
import { Button, ErrorNote, Field, fieldClass } from '../components/ui'

type FormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user, login } = useAuth()
  const [error, setError] = useState('')
  const form = useForm<FormValues>({ resolver: zodResolver(loginSchema) })
  if (user) return <Navigate to="/map" replace />

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-brass">توثيق ميداني</p>
      <h1 className="mt-3 text-4xl font-semibold">سجل الأضرار</h1>
      <p className="mt-2 text-sm leading-6 text-muted">ادخل لمتابعة البلاغات والمراجعة والتوزيع.</p>
      <form
        className="surface mt-8 space-y-4 p-6"
        onSubmit={form.handleSubmit(async (values) => {
          setError('')
          try {
            await login(values.email, values.password)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'تعذر الدخول')
          }
        })}
      >
        {error ? <ErrorNote message={error} /> : null}
        <Field label="البريد" hint={form.formState.errors.email?.message}>
          <input className={fieldClass} type="email" autoComplete="username" {...form.register('email')} />
        </Field>
        <Field label="كلمة المرور" hint={form.formState.errors.password?.message}>
          <input className={fieldClass} type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>دخول</Button>
        <p className="text-center text-sm">
          <Link className="text-pine underline" to="/register">تسجيل مواطن أو مقيم</Link>
        </p>
      </form>
    </main>
  )
}
