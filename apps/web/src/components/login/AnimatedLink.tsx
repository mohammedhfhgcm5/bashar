import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { easeOutSoft, interactionTransition, usePrefersReducedMotion } from './animations'

const MotionLink = motion.create(Link)

export function AnimatedLink({ to, children }: { to: string; children: ReactNode }) {
  const reduced = usePrefersReducedMotion()

  return (
    <MotionLink to={to} className="relative inline-block text-pine" initial="rest" animate="rest" whileHover="hover" whileFocus="hover">
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-px h-px origin-right bg-current"
        variants={{
          rest: { scaleX: 1, transition: interactionTransition },
          hover: reduced
            ? { scaleX: 1 }
            : { scaleX: [0, 1], transition: { duration: 0.4, ease: easeOutSoft } },
        }}
      />
    </MotionLink>
  )
}
