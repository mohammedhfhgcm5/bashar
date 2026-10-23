import { motion } from 'motion/react'
import { motionTokens, usePrefersReducedMotion } from './animations'

const orbs = [
  {
    id: 'gold',
    className: 'absolute -right-[12%] -top-[18%] h-[38rem] w-[38rem]',
    background:
      'radial-gradient(circle, rgba(236, 214, 164, 0.95) 0%, rgba(215, 181, 109, 0.42) 42%, transparent 70%)',
    duration: motionTokens.blobDuration[0],
    x: [0, -80, 36, 0],
    y: [0, 54, -28, 0],
    scale: [1, 1.12, 0.96, 1],
  },
  {
    id: 'navy',
    className: 'absolute -bottom-[22%] -left-[14%] h-[34rem] w-[34rem]',
    background:
      'radial-gradient(circle, rgba(39, 48, 107, 0.34) 0%, rgba(39, 48, 107, 0.12) 46%, transparent 72%)',
    duration: motionTokens.blobDuration[1],
    x: [0, 70, -24, 0],
    y: [0, -48, 30, 0],
    scale: [1, 0.94, 1.08, 1],
  },
  {
    id: 'sand',
    className: 'absolute left-[48%] top-[8%] h-[26rem] w-[26rem]',
    background:
      'radial-gradient(circle, rgba(255, 250, 242, 0.95) 0%, rgba(230, 211, 164, 0.55) 38%, transparent 70%)',
    duration: motionTokens.blobDuration[2],
    x: [0, -46, 22, 0],
    y: [0, 36, -18, 0],
    scale: [1, 1.06, 0.97, 1],
  },
] as const

export function BackgroundBlobs() {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(226,214,192,0.55)_100%)]" />
      {orbs.map((orb) => (
        <motion.div
          key={orb.id}
          className={orb.className}
          style={{ background: orb.background, willChange: 'transform' }}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={
            reduced
              ? undefined
              : { x: [...orb.x], y: [...orb.y], scale: [...orb.scale] }
          }
          transition={{ duration: orb.duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
        />
      ))}
      <Ring size={760} duration={72} stroke="rgba(154, 116, 51, 0.45)" dash="20 16 7 57" reduced={reduced} />
      <Ring size={560} duration={54} reverse stroke="rgba(39, 48, 107, 0.28)" dash="14 22 5 59" reduced={reduced} />
    </div>
  )
}

function Ring({
  size,
  duration,
  stroke,
  dash,
  reverse = false,
  reduced,
}: {
  size: number
  duration: number
  stroke: string
  dash: string
  reverse?: boolean
  reduced: boolean
}) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="absolute left-1/2 top-[46%]"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ rotate: 0 }}
      animate={reduced ? undefined : { rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      <circle cx="50" cy="50" r="48.5" fill="none" stroke={stroke} strokeWidth="0.35" strokeDasharray={dash} strokeLinecap="round" />
    </motion.svg>
  )
}
