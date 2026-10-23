import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Role, roleLabel } from '@damage/shared'
import { useAuth } from '../auth'
import { isDesktopSheet, prefersReducedMotion, project, rubberband, sheetWidth, springConstants } from './sheet-motion'

export function Shell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLButtonElement>(null)
  const motion = useRef({ x: sheetWidth, v: 0, target: sheetWidth, dragging: false })
  const frame = useRef(0)
  const momentum = useRef(false)

  const paint = () => {
    const aside = asideRef.current
    const scrim = scrimRef.current
    if (!aside) return
    if (isDesktopSheet()) {
      aside.style.transform = ''
      if (scrim) {
        scrim.style.opacity = '0'
        scrim.style.pointerEvents = 'none'
      }
      return
    }
    const x = motion.current.x
    aside.style.transform = `translate3d(${x}px,0,0)`
    if (scrim) {
      const shown = 1 - Math.min(sheetWidth, Math.max(0, x)) / sheetWidth
      scrim.style.opacity = String(shown)
      scrim.style.pointerEvents = shown > 0.04 ? 'auto' : 'none'
    }
  }

  const settle = () => {
    cancelAnimationFrame(frame.current)
    if (motion.current.dragging || isDesktopSheet()) {
      paint()
      return
    }
    if (prefersReducedMotion()) {
      motion.current.x = motion.current.target
      motion.current.v = 0
      momentum.current = false
      paint()
      return
    }
    const ratio = momentum.current ? 0.8 : 1
    momentum.current = false
    const { stiffness, damping } = springConstants(ratio, ratio === 1 ? 0.4 : 0.3)
    let last = performance.now()
    const step = (now: number) => {
      if (motion.current.dragging) return
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      const { x, v, target } = motion.current
      const accel = -stiffness * (x - target) - damping * v
      motion.current.v = v + accel * dt
      motion.current.x = x + motion.current.v * dt
      paint()
      const resting = Math.abs(motion.current.x - target) < 0.45 && Math.abs(motion.current.v) < 8
      if (resting) {
        motion.current.x = target
        motion.current.v = 0
        paint()
        return
      }
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    const next = open ? 0 : sheetWidth
    const continuing = motion.current.target === next && frame.current !== 0 && !isDesktopSheet()
    motion.current.target = next
    if (!continuing) settle()
  }, [open])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const sync = () => {
      cancelAnimationFrame(frame.current)
      motion.current.dragging = false
      motion.current.v = 0
      if (query.matches) {
        motion.current.x = 0
        motion.current.target = 0
      } else {
        motion.current.target = openRef.current ? 0 : sheetWidth
        motion.current.x = motion.current.target
      }
      paint()
    }
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const onGrab = (event: React.PointerEvent<HTMLElement>) => {
    if (isDesktopSheet() || event.button !== 0) return
    const startX = event.clientX
    const startY = event.clientY
    const origin = motion.current.x
    const history: { x: number; t: number }[] = []
    let decided = false

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!decided) {
        if (Math.hypot(dx, dy) < 10) return
        if (Math.abs(dy) > Math.abs(dx)) {
          end()
          return
        }
        decided = true
        motion.current.dragging = true
        cancelAnimationFrame(frame.current)
        asideRef.current?.setPointerCapture(ev.pointerId)
      }
      let next = origin + dx
      if (next < 0) next = -rubberband(-next, sheetWidth)
      if (next > sheetWidth) next = sheetWidth + rubberband(next - sheetWidth, sheetWidth)
      motion.current.x = next
      history.push({ x: next, t: performance.now() })
      if (history.length > 6) history.shift()
      paint()
    }

    const up = () => {
      end()
      if (!decided) return
      motion.current.dragging = false
      const first = history[0]
      const last = history[history.length - 1]
      const dt = first && last ? (last.t - first.t) / 1000 : 0
      const velocity = dt > 0 && first && last ? (last.x - first.x) / dt : 0
      const projected = motion.current.x + project(velocity)
      const closing = projected > sheetWidth / 2
      motion.current.target = closing ? sheetWidth : 0
      motion.current.v = velocity
      momentum.current = true
      settle()
      setOpen(!closing)
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  if (!user) return null

  const items = [
    { to: '/map', label: 'الخريطة' },
    { to: '/reports', label: user.role === Role.ORGANIZATION ? 'البلاغات المعتمدة' : 'البلاغات' },
  ]
  if (user.role !== Role.ORGANIZATION) items.push({ to: '/reports/new', label: 'بلاغ جديد' })
  if (user.role === Role.SUPERVISOR || user.role === Role.ORGANIZATION) items.push({ to: '/stats', label: 'الإحصاء' })
  if (user.role === Role.ORGANIZATION || user.role === Role.SUPERVISOR) items.push({ to: '/aid', label: 'المساعدات' })
  if (user.role === Role.SUPERVISOR) {
    items.push({ to: '/admin/users', label: 'المستخدمون' }, { to: '/admin/organizations', label: 'المنظمات' })
  }

  return (
    <div className="min-h-screen">
      <div className="chrome sticky top-0 z-40 flex items-center justify-between px-4 py-3 md:hidden">
        <button className="rounded-xl px-3 py-2 text-sm font-semibold" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="app-nav">
          القائمة
        </button>
        <strong className="tracking-tight">سجل الأضرار</strong>
      </div>
      <button
        ref={scrimRef}
        className="scrim fixed inset-0 z-30 bg-black/35 opacity-0 md:hidden"
        style={{ pointerEvents: 'none' }}
        aria-label="إغلاق القائمة"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <aside
        id="app-nav"
        ref={asideRef}
        className="sidebar fixed inset-y-0 right-0 z-40 flex w-64 flex-col text-[#f3f0e8]"
        style={{ transform: 'translate3d(256px,0,0)' }}
        onPointerDown={onGrab}
      >
        <div className="px-5 pb-4 pt-7">
          <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-[#d7b56d]">توثيق ميداني</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white">سجل الأضرار</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link press" onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4">
          <div>
            <p className="font-semibold tracking-tight">{user.fullName}</p>
            <p className="text-xs leading-5 text-[#d7c7a4]">
              {roleLabel[user.role]}
              {user.organization ? ` · ${user.organization.name}` : ''}
            </p>
          </div>
          <button
            className="w-full rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium hover:bg-white/10"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="px-4 py-6 md:mr-64 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
