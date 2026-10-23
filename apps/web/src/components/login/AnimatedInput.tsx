import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion, useAnimation } from 'motion/react'
import { fieldClass } from '../ui'
import { interactionTransition, motionTokens, shakeTarget, usePrefersReducedMotion } from './animations'

type AnimatedInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  revealable?: boolean
  shakeSignal?: number
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(function AnimatedInput(
  {
    label,
    hint,
    revealable = false,
    shakeSignal = 0,
    className = '',
    type = 'text',
    onFocus,
    onBlur,
    id,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const reduced = usePrefersReducedMotion()
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const controls = useAnimation()

  useEffect(() => {
    if (!hint || reduced) return
    void controls.start(shakeTarget(motionTokens.fieldShake))
  }, [controls, hint, reduced, shakeSignal])

  return (
    <label className="block" htmlFor={inputId}>
      <motion.span
        className="mb-1.5 block text-sm font-medium tracking-tight text-ink/80"
        animate={{ y: focused && !reduced ? -2 : 0 }}
        transition={interactionTransition}
      >
        {label}
      </motion.span>
      <motion.div className="relative" animate={controls}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={revealable ? (visible ? 'text' : 'password') : type}
          aria-invalid={hint ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`${fieldClass} duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${revealable ? 'pe-12' : ''} ${className}`}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
        />
        {revealable ? (
          <button
            type="button"
            className="login-icon-btn absolute end-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink"
            aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            aria-pressed={visible}
            aria-controls={inputId}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((current) => !current)}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={visible ? 'hide' : 'show'}
                className="col-start-1 row-start-1 flex"
                initial={{ opacity: 0, rotate: reduced ? 0 : -20 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: reduced ? 0 : 20 }}
                transition={interactionTransition}
              >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
              </motion.span>
            </AnimatePresence>
          </button>
        ) : null}
      </motion.div>
      {hint ? (
        <span id={hintId} className="mt-1.5 block text-sm text-[#9f1239]">
          {hint}
        </span>
      ) : null}
    </label>
  )
})

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function EyeIcon() {
  return (
    <Icon>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

function EyeOffIcon() {
  return (
    <Icon>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-3.8 4.8" />
      <path d="M6.7 6.7C4 8.3 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  )
}
