import { useEffect, useMemo, useRef, type FormEventHandler, type MouseEvent, type ReactNode } from 'react'
import { motion, useAnimation, useMotionValue, useSpring, useTransform } from 'motion/react'
import { cardVariants, motionTokens, shakeTarget, useFinePointer, usePrefersReducedMotion } from './animations'

type AnimatedCardProps = {
  children: ReactNode
  exiting: boolean
  errorSignal: string
  onExited: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

function usePointerTilt(enabled: boolean) {
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [motionTokens.tilt, -motionTokens.tilt]), {
    bounce: 0,
    duration: 0.35,
  })
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-motionTokens.tilt, motionTokens.tilt]), {
    bounce: 0,
    duration: 0.35,
  })

  useEffect(() => {
    if (enabled) return
    pointerX.set(0)
    pointerY.set(0)
  }, [enabled, pointerX, pointerY])

  const onMouseMove = (event: MouseEvent<HTMLFormElement>) => {
    if (!enabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  const onMouseLeave = () => {
    pointerX.set(0)
    pointerY.set(0)
  }

  return { rotateX, rotateY, onMouseMove, onMouseLeave }
}

export function AnimatedCard({ children, exiting, errorSignal, onExited, onSubmit }: AnimatedCardProps) {
  const reduced = usePrefersReducedMotion()
  const fine = useFinePointer()
  const tiltEnabled = fine && !reduced && !exiting
  const tilt = usePointerTilt(tiltEnabled)
  const controls = useAnimation()
  const variants = useMemo(() => cardVariants(reduced), [reduced])
  const exited = useRef(false)

  useEffect(() => {
    if (!errorSignal || reduced) return
    void controls.start(shakeTarget(motionTokens.cardShake))
  }, [controls, errorSignal, reduced])

  return (
    <motion.div
      className="mt-8"
      variants={variants}
      initial="hidden"
      animate={exiting ? 'exit' : 'show'}
      onAnimationComplete={(definition) => {
        if (definition !== 'exit' || exited.current) return
        exited.current = true
        onExited()
      }}
    >
      <motion.form
        className={`login-card surface space-y-4 p-6 ${exiting ? 'pointer-events-none' : ''}`}
        noValidate
        animate={controls}
        onSubmit={onSubmit}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={
          fine && !reduced
            ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 900 }
            : undefined
        }
      >
        {children}
      </motion.form>
    </motion.div>
  )
}
