import { DamageLevel, damageLevelLabel } from './levels'

/**
 * PECCD class order follows the published defect list
 * (Mayya et al., Mendeley Data, 2025): deep crack, simple crack,
 * multi-branched crack, spalling, scaling, holes.
 * The dataset folder has no classes file; ids 0–5 match that order.
 */
export const DefectClass = [
  { id: 0, key: 'deep_crack', label: 'شق عميق', level: DamageLevel.CRITICAL },
  { id: 1, key: 'simple_crack', label: 'شق بسيط', level: DamageLevel.LOW },
  { id: 2, key: 'multi_branched_crack', label: 'شق متفرع', level: DamageLevel.HIGH },
  { id: 3, key: 'spalling', label: 'تقشر الخرسانة', level: DamageLevel.HIGH },
  { id: 4, key: 'scaling', label: 'تفتت سطحي', level: DamageLevel.MEDIUM },
  { id: 5, key: 'holes', label: 'ثقوب', level: DamageLevel.CRITICAL },
] as const

export const VISION_MIN_CONFIDENCE = 0.35

const severityRank: Record<DamageLevel, number> = {
  [DamageLevel.LOW]: 1,
  [DamageLevel.MEDIUM]: 2,
  [DamageLevel.HIGH]: 3,
  [DamageLevel.CRITICAL]: 4,
}

export type Detection = {
  classId: number
  confidence: number
  box: [number, number, number, number]
}

export type ImageDetections = {
  imageId: string
  detections: Detection[]
}

export type VisionDetectionView = {
  classId: number
  label: string
  level: DamageLevel
  confidence: number
  box: [number, number, number, number]
}

export type VisionTotal = {
  classId: number
  key: string
  label: string
  level: DamageLevel
  count: number
  maxConfidence: number
  imageCount: number
}

export type DamageSuggestion = {
  suggestedLevel: DamageLevel | null
  confidence: number | null
  /** Average fraction of image area covered by detected boxes (0–1). */
  coverageRatio: number | null
  summary: string
  totals: VisionTotal[]
  images: { imageId: string; detections: VisionDetectionView[] }[]
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function photoWord(count: number) {
  return count === 1 ? 'صورة' : 'صور'
}

/** Approximate union coverage of normalized boxes [x, y, w, h] on a unit square. */
export function boxCoverage(boxes: Array<[number, number, number, number]>, grid = 64) {
  if (boxes.length === 0) return 0
  const cells = new Uint8Array(grid * grid)
  for (const [x, y, w, h] of boxes) {
    const x0 = Math.max(0, Math.floor(x * grid))
    const y0 = Math.max(0, Math.floor(y * grid))
    const x1 = Math.min(grid, Math.ceil((x + w) * grid))
    const y1 = Math.min(grid, Math.ceil((y + h) * grid))
    for (let row = y0; row < y1; row += 1) {
      for (let col = x0; col < x1; col += 1) {
        cells[row * grid + col] = 1
      }
    }
  }
  let covered = 0
  for (const cell of cells) covered += cell
  return covered / (grid * grid)
}

export function aggregateDamage(images: ImageDetections[]): DamageSuggestion {
  const byId = new Map<number, (typeof DefectClass)[number]>(DefectClass.map((defect) => [defect.id, defect]))
  const kept = images.map((image) => ({
    imageId: image.imageId,
    detections: image.detections.flatMap((detection) => {
      const defect = byId.get(detection.classId)
      if (!defect || detection.confidence < VISION_MIN_CONFIDENCE) return []
      return [{ ...detection, defect }]
    }),
  }))

  const buckets = new Map<number, { count: number; maxConfidence: number; images: Set<string> }>()
  for (const image of kept) {
    for (const detection of image.detections) {
      const bucket = buckets.get(detection.classId) ?? { count: 0, maxConfidence: 0, images: new Set<string>() }
      bucket.count += 1
      bucket.maxConfidence = Math.max(bucket.maxConfidence, detection.confidence)
      bucket.images.add(image.imageId)
      buckets.set(detection.classId, bucket)
    }
  }

  const totals = [...buckets.entries()]
    .map(([classId, bucket]) => {
      const defect = byId.get(classId)!
      return {
        classId,
        key: defect.key,
        label: defect.label,
        level: defect.level,
        count: bucket.count,
        maxConfidence: round2(bucket.maxConfidence),
        imageCount: bucket.images.size,
      }
    })
    .sort((left, right) => severityRank[right.level] - severityRank[left.level] || right.count - left.count)

  const views = kept.map((image) => ({
    imageId: image.imageId,
    detections: image.detections.map((detection) => ({
      classId: detection.classId,
      label: detection.defect.label,
      level: detection.defect.level,
      confidence: round2(detection.confidence),
      box: detection.box.map((value) => round2(value)) as [number, number, number, number],
    })),
  }))

  const perImageCoverage = kept.map((image) => boxCoverage(image.detections.map((detection) => detection.box)))
  const coverageRatio =
    images.length === 0
      ? null
      : round2(perImageCoverage.reduce((sum, value) => sum + value, 0) / images.length)

  if (totals.length === 0) {
    return {
      suggestedLevel: null,
      confidence: null,
      coverageRatio: coverageRatio === 0 ? null : coverageRatio,
      summary:
        images.length === 0
          ? 'لا توجد صور للتقييم.'
          : `فُحصت ${images.length} ${photoWord(images.length)} ولم يُرصد عيب من أصناف النموذج.`,
      totals: [],
      images: views,
    }
  }

  const suggestedLevel = totals.reduce<DamageLevel>(
    (best, row) => (severityRank[row.level] > severityRank[best] ? row.level : best),
    DamageLevel.LOW,
  )
  const supporting = totals.filter((row) => row.level === suggestedLevel)
  const maxConfidence = Math.max(...supporting.map((row) => row.maxConfidence))
  const agreeing = new Set(
    kept
      .filter((image) => image.detections.some((detection) => detection.defect.level === suggestedLevel))
      .map((image) => image.imageId),
  )
  const confidence = round2(Math.min(0.99, maxConfidence + Math.min(0.08, 0.04 * Math.max(0, agreeing.size - 1))))
  const parts = totals.map((row) => `${row.label} (${row.count})`).join('، ')
  const coveragePercent = Math.round((coverageRatio ?? 0) * 100)

  return {
    suggestedLevel,
    confidence,
    coverageRatio,
    summary: `بناءً على ${images.length} ${photoWord(images.length)}: ${parts}. المستوى المقترح ${damageLevelLabel[suggestedLevel]}. تغطية العيوب حوالي ${coveragePercent}٪.`,
    totals,
    images: views,
  }
}
