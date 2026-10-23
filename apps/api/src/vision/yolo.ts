export const YOLO_INPUT = 640

export type Letterbox = {
  scale: number
  resizedW: number
  resizedH: number
  padX: number
  padY: number
  size: number
}

export type YoloDetection = {
  classId: number
  confidence: number
  box: [number, number, number, number]
}

type RawBox = {
  classId: number
  confidence: number
  cx: number
  cy: number
  w: number
  h: number
}

export function letterbox(width: number, height: number, size = YOLO_INPUT): Letterbox {
  const scale = Math.min(size / height, size / width)
  const resizedW = Math.round(width * scale)
  const resizedH = Math.round(height * scale)
  const padX = (size - resizedW) / 2
  const padY = (size - resizedH) / 2
  return { scale, resizedW, resizedH, padX: Math.round(padX - 0.1), padY: Math.round(padY - 0.1), size }
}

function iou(left: RawBox, right: RawBox) {
  const leftX1 = left.cx - left.w / 2
  const leftY1 = left.cy - left.h / 2
  const leftX2 = left.cx + left.w / 2
  const leftY2 = left.cy + left.h / 2
  const rightX1 = right.cx - right.w / 2
  const rightY1 = right.cy - right.h / 2
  const rightX2 = right.cx + right.w / 2
  const rightY2 = right.cy + right.h / 2
  const overlapW = Math.max(0, Math.min(leftX2, rightX2) - Math.max(leftX1, rightX1))
  const overlapH = Math.max(0, Math.min(leftY2, rightY2) - Math.max(leftY1, rightY1))
  const intersection = overlapW * overlapH
  const union = left.w * left.h + right.w * right.h - intersection
  return union <= 0 ? 0 : intersection / union
}

function suppress(boxes: RawBox[], iouThreshold: number) {
  const ordered = [...boxes].sort((left, right) => right.confidence - left.confidence)
  const kept: RawBox[] = []
  for (const box of ordered) {
    const overlaps = kept.some((chosen) => chosen.classId === box.classId && iou(chosen, box) > iouThreshold)
    if (!overlaps) kept.push(box)
  }
  return kept
}

export function decodeYoloOutput(args: {
  data: Float32Array
  dims: readonly number[]
  classCount: number
  meta: Letterbox
  width: number
  height: number
  minConfidence: number
  iouThreshold?: number
  limit?: number
}): YoloDetection[] {
  const [batch, first, second] = args.dims
  if (batch !== 1 || first === undefined || second === undefined) {
    throw new Error('مخرجات النموذج غير متوقعة')
  }
  const expected = 4 + args.classCount
  const channelsFirst = first === expected
  const channels = channelsFirst ? first : second
  const boxCount = channelsFirst ? second : first
  if (channels !== expected) {
    throw new Error('عدد أصناف النموذج لا يطابق مجموعة التدريب')
  }
  const at = (channel: number, index: number) =>
    args.data[channelsFirst ? channel * boxCount + index : index * channels + channel]

  const raw: RawBox[] = []
  for (let index = 0; index < boxCount; index += 1) {
    let confidence = 0
    let classId = 0
    for (let id = 0; id < args.classCount; id += 1) {
      const score = at(4 + id, index)
      if (score > confidence) {
        confidence = score
        classId = id
      }
    }
    if (confidence < args.minConfidence) continue
    raw.push({
      classId,
      confidence,
      cx: at(0, index),
      cy: at(1, index),
      w: at(2, index),
      h: at(3, index),
    })
  }

  return suppress(raw, args.iouThreshold ?? 0.45)
    .slice(0, args.limit ?? 30)
    .flatMap((box) => {
      const x = (box.cx - box.w / 2 - args.meta.padX) / args.meta.scale
      const y = (box.cy - box.h / 2 - args.meta.padY) / args.meta.scale
      const width = box.w / args.meta.scale
      const height = box.h / args.meta.scale
      if (width < 2 || height < 2) return []
      const nx = Math.min(1, Math.max(0, x / args.width))
      const ny = Math.min(1, Math.max(0, y / args.height))
      const nw = Math.min(1 - nx, Math.max(0, width / args.width))
      const nh = Math.min(1 - ny, Math.max(0, height / args.height))
      return [{ classId: box.classId, confidence: box.confidence, box: [nx, ny, nw, nh] as [number, number, number, number] }]
    })
}
