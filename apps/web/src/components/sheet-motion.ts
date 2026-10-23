const WIDTH = 256

export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

export function project(initialVelocity: number, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * (decelerationRate / (1 - decelerationRate))
}

export function springConstants(dampingRatio: number, response: number) {
  return {
    stiffness: (2 * Math.PI / response) ** 2,
    damping: (4 * Math.PI * dampingRatio) / response,
  }
}

export const sheetWidth = WIDTH

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isDesktopSheet() {
  return window.matchMedia('(min-width: 768px)').matches
}
