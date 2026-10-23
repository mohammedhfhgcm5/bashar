import { useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { easeOutSoft, interactionTransition, usePrefersReducedMotion } from './animations'

type AnimatedButtonProps = {
  loading?: boolean
  disabled?: boolean
  className?: string
  type?: 'submit' | 'button' | 'reset'
  children: ReactNode
}

export function AnimatedButton({
  loading = false,
  disabled,
  className = '',
  children,
  type = 'submit',
}: AnimatedButtonProps) {
  const reduced = usePrefersReducedMotion()
  const inactive = Boolean(loading || disabled)
  const variants = useMemo<Variants>(
    () => ({
      rest: { y: 0, scale: 1, filter: 'brightness(1)' },
      hover: {
        y: reduced ? 0 : -2,
        scale: 1,
        filter: reduced ? 'brightness(1)' : 'brightness(1.06)',
        transition: interactionTransition,
      },
      tap: {
        y: 0,
        scale: reduced ? 1 : 0.98,
        filter: 'brightness(1)',
        transition: { duration: 0.15, ease: easeOutSoft },
      },
    }),
    [reduced],
  )

  return (
    <motion.button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={`motion-press relative inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-card hover:bg-[#1f2757] active:bg-[#181e45] disabled:cursor-not-allowed ${inactive && !loading ? 'opacity-60' : ''} ${className}`}
      initial="rest"
      animate="rest"
      whileHover={inactive ? undefined : 'hover'}
      whileTap={inactive ? undefined : 'tap'}
      variants={variants}
    >
      {reduced ? null : (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
          <motion.span
            className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            variants={{
              rest: { x: '220%', opacity: 0 },
              hover: {
                x: ['220%', '40%', '-140%'],
                opacity: [0, 0.9, 0],
                transition: { duration: 0.55, ease: easeOutSoft },
              },
              tap: { opacity: 0, transition: { duration: 0.15 } },
            }}
          />
        </span>
      )}
      <span className="relative inline-flex items-center justify-center">
        <motion.span
          className="inline-flex"
          animate={{ opacity: loading ? 0 : 1 }}
          transition={interactionTransition}
          aria-hidden={loading || undefined}
        >
          {children}
        </motion.span>
        <AnimatePresence initial={false}>
          {loading ? (
            <motion.span
              key="spinner"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={interactionTransition}
            >
              <Spinner reduced={reduced} />
              <span className="sr-only">جارٍ الدخول</span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

function Spinner({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
      animate={reduced ? { opacity: [0.45, 1, 0.45] } : { rotate: 360 }}
      transition={
        reduced
          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.7, repeat: Infinity, ease: 'linear' }
      }
    />
  )
}
