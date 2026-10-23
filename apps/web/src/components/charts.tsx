import { useId, useState, type PointerEvent } from 'react'

export type ChartSlice = {
  key: string
  label: string
  count: number
  color: string
}

function totalOf(rows: { count: number }[]) {
  return rows.reduce((sum, row) => sum + row.count, 0)
}

function CountShare({ count, total }: { count: number; total: number }) {
  const percent = total ? Math.round((count / total) * 100) : 0
  return (
    <span className="inline-flex shrink-0 items-baseline gap-2 tabular-nums">
      <bdi className="font-medium text-ink">{count}</bdi>
      <bdi className="text-xs text-muted">{percent}٪</bdi>
    </span>
  )
}

export function DonutChart({ slices, caption }: { slices: ChartSlice[]; caption: string }) {
  const total = totalOf(slices)
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const active = slices.filter((slice) => slice.count > 0)
  const gap = active.length > 1 ? 2.5 : 0
  let cursor = 0

  return (
    <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36 shrink-0" role="img" aria-label={caption}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(28,25,21,0.08)" strokeWidth="14" />
        {total > 0
          ? active.map((slice) => {
              const share = (slice.count / total) * circumference
              const length = Math.max(share - gap, 0)
              const offset = cursor
              cursor += share
              return (
                <circle
                  key={slice.key}
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 64 64)"
                >
                  <title>{`${slice.label}: ${slice.count}`}</title>
                </circle>
              )
            })
          : null}
        <text x="64" y="60" textAnchor="middle" fill="#1c1915" fontSize="22" fontWeight="600">
          {total}
        </text>
        <text x="64" y="78" textAnchor="middle" fill="#5c564e" fontSize="11">
          المجموع
        </text>
      </svg>
      <ul className="grid w-full flex-1 gap-2">
        {slices.map((slice) => {
          return (
            <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <CountShare count={slice.count} total={total} />
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

export function BarChart({ rows }: { rows: ChartSlice[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  const total = totalOf(rows)
  if (total === 0) return <p className="text-sm text-muted">لا توجد بيانات بعد.</p>
  return (
    <ul className="space-y-3.5">
      {rows.map((row) => {
        return (
          <li key={row.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <CountShare count={row.count} total={total} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]" role="presentation">
              <div
                className="h-full rounded-full motion-reduce:transition-none"
                style={{
                  width: `${(row.count / max) * 100}%`,
                  background: row.color,
                  transition: 'width 420ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

type Point = { label: string; value: number }

function axis(value: number) {
  const max = Math.max(1, Math.ceil(value))
  const mid = Math.round(max / 2)
  const ticks = mid === 0 || mid === max ? [0, max] : [0, mid, max]
  return { max, ticks }
}

function curve(points: { x: number; y: number }[]) {
  const first = points[0]
  if (!first) return ''
  let path = `M${first.x},${first.y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]!
    const next = points[index + 1]!
    const mid = (current.x + next.x) / 2
    path += ` C${mid},${current.y} ${mid},${next.y} ${next.x},${next.y}`
  }
  return path
}

export function AreaChart({ points, caption }: { points: Point[]; caption: string }) {
  const [active, setActive] = useState<number | null>(null)
  const fillId = useId().replace(/:/g, '')
  const width = 640
  const height = 240
  const pad = { top: 28, right: 16, bottom: 32, left: 36 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const scale = axis(Math.max(0, ...points.map((point) => point.value)))
  const peak = scale.max
  const coords = points.map((point, index) => ({
    x: pad.left + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW),
    y: pad.top + plotH - (point.value / peak) * plotH,
  }))
  const baseline = pad.top + plotH
  const line = curve(coords)
  const first = coords[0]
  const last = coords[coords.length - 1]
  const area = first && last ? `${line} L${last.x},${baseline} L${first.x},${baseline} Z` : ''
  const ticks = scale.ticks
  const labelAt = new Set([0, Math.round((points.length - 1) / 2), points.length - 1])
  const selected = active == null ? null : points[active]

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    const cursor = svg.createSVGPoint()
    cursor.x = event.clientX
    cursor.y = event.clientY
    const local = cursor.matrixTransform(matrix.inverse())
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    coords.forEach((point, index) => {
      const gap = Math.abs(point.x - local.x)
      if (gap < distance) {
        distance = gap
        nearest = index
      }
    })
    setActive(nearest)
  }

  return (
    <div className="space-y-2">
      <div dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full"
        role="img"
        aria-label={caption}
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#27306b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#27306b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = pad.top + plotH - (tick / peak) * plotH
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(28,25,21,0.08)" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#5c564e" fontSize="11">
                {Math.round(tick)}
              </text>
            </g>
          )
        })}
        {area ? <path d={area} fill={`url(#${fillId})`} /> : null}
        {line ? <path d={line} fill="none" stroke="#27306b" strokeWidth="2.5" strokeLinejoin="round" /> : null}
        {coords.map((point, index) => {
          if (!labelAt.has(index)) return null
          const edge = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'
          return (
            <text key={points[index]!.label} x={point.x} y={height - 8} textAnchor={edge} fill="#5c564e" fontSize="11">
              {points[index]!.label}
            </text>
          )
        })}
        {active != null && coords[active] ? (
          <g>
            <line
              x1={coords[active].x}
              x2={coords[active].x}
              y1={pad.top}
              y2={baseline}
              stroke="#9a7433"
              strokeDasharray="3 4"
            />
            <circle cx={coords[active].x} cy={coords[active].y} r="4.5" fill="#fbf8f3" stroke="#9a7433" strokeWidth="2.5" />
          </g>
        ) : null}
      </svg>
      </div>
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {selected ? `${selected.label}: ${selected.value} بلاغ` : 'مرّر على المنحنى لرؤية عدد البلاغات في اليوم'}
      </p>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
