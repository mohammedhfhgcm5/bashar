import { useEffect, useState } from 'react'
import type { Transition, Variants } from 'motion/react'

/**
 * Login motion tokens. Change these to retune the whole page:
 * - `stagger` / `rise` / `cardScaleFrom` — page-load sequence
 * - `fast` / `entrance` / `exit` / `shake` — interaction timing (seconds)
 * - `tilt` — max card tilt in degrees
 * - `blobDuration` — background orb loops, in seconds (shorter = faster)
 * - `easeOutSoft` — shared easing
 */
export const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const motionTokens = {
  stagger: 0.08,
  rise: 16,
  cardScaleFrom: 0.97,
  cardScaleTo: 0.96,
  tilt: 3.5,
  fast: 0.2,
  entrance: 0.5,
  exit: 0.4,
  shake: 0.42,
  fieldShake: 5,
  cardShake: 3,
  blobDuration: [18, 22, 16] as const,
} as const

export const interactionTransition: Transition = {
  duration: motionTokens.fast,
  ease: easeOutSoft,
}

export const entranceTransition: Transition = {
  type: 'spring',
  bounce: 0,
  duration: motionTokens.entrance,
}

export const exitTransition: Transition = {
  duration: motionTokens.exit,
  ease: easeOutSoft,
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

export function useFinePointer() {
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFine(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return fine
}

function enter(reduced: boolean, delay = 0): Transition {
  if (reduced) return { duration: motionTokens.fast, ease: easeOutSoft, delay }
  return { ...entranceTransition, delay }
}

export function staggerContainer(reduced: boolean): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0.04 : motionTokens.stagger,
        delayChildren: reduced ? 0.02 : 0.04,
      },
    },
  }
}

export function cardEntranceDelay(reduced: boolean) {
  const step = reduced ? 0.04 : motionTokens.stagger
  const lead = reduced ? 0.02 : 0.04
  return lead + step * 3
}

export function riseVariants(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : motionTokens.rise },
    show: {
      opacity: 1,
      y: 0,
      transition: enter(reduced),
    },
  }
}

export function cardVariants(reduced: boolean): Variants {
  return {
    hidden: {
      opacity: 0,
      y: reduced ? 0 : motionTokens.rise,
      scale: reduced ? 1 : motionTokens.cardScaleFrom,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: enter(reduced, cardEntranceDelay(reduced)),
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : 8,
      scale: reduced ? 1 : motionTokens.cardScaleTo,
      transition: reduced ? { duration: motionTokens.fast, ease: easeOutSoft } : exitTransition,
    },
  }
}

export function shakeTarget(distance: number) {
  return {
    x: [0, -distance, distance, -distance * 0.6, distance * 0.6, 0],
    transition: { duration: motionTokens.shake, ease: easeOutSoft },
  }
}
