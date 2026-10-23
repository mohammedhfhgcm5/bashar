import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { loginSchema } from '@damage/shared'
import type { z } from 'zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../auth'
import { ErrorNote } from '../components/ui'
import { AnimatedButton } from '../components/login/AnimatedButton'
import { AnimatedCard } from '../components/login/AnimatedCard'
import { AnimatedInput } from '../components/login/AnimatedInput'
import { AnimatedLink } from '../components/login/AnimatedLink'
import { BackgroundBlobs } from '../components/login/BackgroundBlobs'
import {
  interactionTransition,
  riseVariants,
  staggerContainer,
  usePrefersReducedMotion,
} from '../components/login/animations'

type FormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const holdRedirect = useRef(false)
  const left = useRef(false)
  const reduced = usePrefersReducedMotion()
  const rise = useMemo(() => riseVariants(reduced), [reduced])
  const stagger = useMemo(() => staggerContainer(reduced), [reduced])
  const form = useForm<FormValues>({ resolver: zodResolver(loginSchema) })

  const finish = useCallback(() => {
    if (left.current) return
    left.current = true
    navigate('/map', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(finish, reduced ? 320 : 720)
    return () => window.clearTimeout(timer)
  }, [exiting, finish, reduced])

  if (user && !holdRedirect.current) return <Navigate to="/map" replace />

  return (
    <main className="relative min-h-screen">
      <BackgroundBlobs />
      <div className={`relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12 ${exiting ? 'pointer-events-none' : ''}`}>
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.p variants={rise} className="text-[0.7rem] font-semibold tracking-[0.18em] text-brass">
            توثيق ميداني
          </motion.p>
          <motion.h1 variants={rise} className="mt-3 text-4xl font-semibold">
            سجل الأضرار
          </motion.h1>
          <motion.p variants={rise} className="mt-2 text-sm leading-6 text-muted">
            ادخل لمتابعة البلاغات والمراجعة والتوزيع.
          </motion.p>
        </motion.div>
        <AnimatedCard
          exiting={exiting}
          errorSignal={error}
          onExited={finish}
          onSubmit={form.handleSubmit(async (values) => {
            setError('')
            setSubmitting(true)
            holdRedirect.current = true
            try {
              await login(values.email, values.password)
              setExiting(true)
            } catch (reason) {
              holdRedirect.current = false
              setSubmitting(false)
              setError(reason instanceof Error ? reason.message : 'تعذر الدخول')
            }
          })}
        >
          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                key="login-error"
                initial={{ opacity: 0, y: reduced ? 0 : -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={interactionTransition}
              >
                <ErrorNote message={error} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AnimatedInput
            label="البريد"
            hint={form.formState.errors.email?.message}
            shakeSignal={form.formState.submitCount}
            type="email"
            autoComplete="username"
            {...form.register('email')}
          />
          <AnimatedInput
            label="كلمة المرور"
            hint={form.formState.errors.password?.message}
            shakeSignal={form.formState.submitCount}
            revealable
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
          />
          <AnimatedButton type="submit" loading={submitting || exiting}>
            دخول
          </AnimatedButton>
          <p className="text-center text-sm">
            <AnimatedLink to="/register">تسجيل مواطن أو مقيم</AnimatedLink>
          </p>
        </AnimatedCard>
      </div>
    </main>
  )
}
