import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, VisionStatus } from '@prisma/client'
import { DefectClass, VISION_MIN_CONFIDENCE, aggregateDamage, type DamageSuggestion } from '@damage/shared'
import { existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { YOLO_INPUT, decodeYoloOutput, letterbox } from './yolo'

const MODEL_NAME = 'yolov8n-peccd'

type Session = import('onnxruntime-node').InferenceSession

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name)
  private session: Promise<Session | null> | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private modelPath() {
    const configured = this.config.get<string>('VISION_MODEL_PATH')
    if (configured) return path.resolve(configured)
    const candidates = [
      path.resolve(process.cwd(), '../../ml/weights/peccd-yolov8n.onnx'),
      path.resolve(process.cwd(), 'ml/weights/peccd-yolov8n.onnx'),
      path.resolve(__dirname, '../../../../ml/weights/peccd-yolov8n.onnx'),
    ]
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!
  }

  private loadSession() {
    this.session ??= this.openSession()
    return this.session
  }

  private async openSession() {
    const modelPath = this.modelPath()
    if (!existsSync(modelPath)) {
      this.logger.warn(`نموذج الرؤية غير موجود: ${modelPath}`)
      return null
    }
    this.logger.log(`تحميل نموذج الرؤية: ${modelPath}`)
    const ort = await import('onnxruntime-node')
    return ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    })
  }

  async preview(buffers: Buffer[]): Promise<DamageSuggestion & { status: VisionStatus }> {
    if (buffers.length === 0) {
      return {
        status: VisionStatus.UNAVAILABLE,
        suggestedLevel: null,
        confidence: null,
        coverageRatio: null,
        summary: 'أرفق صورة واحدة على الأقل حتى يقيّم النموذج الضرر.',
        totals: [],
        images: [],
      }
    }
    const session = await this.loadSession()
    if (!session) {
      return {
        status: VisionStatus.UNAVAILABLE,
        suggestedLevel: null,
        confidence: null,
        coverageRatio: null,
        summary: 'نموذج YOLOv8 غير جاهز بعد. بعد انتهاء التدريب أعد تقييم الصور.',
        totals: [],
        images: [],
      }
    }
    const perImage = []
    for (const [index, buffer] of buffers.entries()) {
      perImage.push({ imageId: String(index), detections: await this.detect(session, buffer) })
    }
    return { status: VisionStatus.READY, ...aggregateDamage(perImage) }
  }

  async refresh(reportId: string) {
    const images = await this.prisma.image.findMany({
      where: { reportId },
      orderBy: { createdAt: 'asc' },
    })
    try {
      const row = await this.evaluate(images)
      await this.prisma.visionAssessment.upsert({
        where: { reportId },
        create: { reportId, ...row },
        update: row,
      })
    } catch (error) {
      this.logger.error(`vision failed for ${reportId}`, error instanceof Error ? error.stack : String(error))
      const failed = {
        status: VisionStatus.FAILED,
        modelName: MODEL_NAME,
        suggestedLevel: null,
        confidence: null,
        summary: 'تعذر تشغيل نموذج التقييم. أعد المحاولة لاحقاً.',
        findings: { totals: [], images: [], coverageRatio: null } satisfies Prisma.InputJsonObject,
      }
      await this.prisma.visionAssessment.upsert({
        where: { reportId },
        create: { reportId, ...failed },
        update: failed,
      })
    }
  }

  private async evaluate(images: { id: string; storageKey: string }[]) {
    const empty = { totals: [], images: [], coverageRatio: null } satisfies Prisma.InputJsonObject
    if (images.length === 0) {
      return {
        status: VisionStatus.UNAVAILABLE,
        modelName: MODEL_NAME,
        suggestedLevel: null,
        confidence: null,
        summary: 'أرفق صورة واحدة على الأقل حتى يقيّم النموذج الضرر.',
        findings: empty,
      }
    }
    const session = await this.loadSession()
    if (!session) {
      return {
        status: VisionStatus.UNAVAILABLE,
        modelName: MODEL_NAME,
        suggestedLevel: null,
        confidence: null,
        summary: 'نموذج YOLOv8 غير جاهز بعد. بعد انتهاء التدريب أعد تقييم الصور.',
        findings: empty,
      }
    }
    const perImage = []
    for (const image of images) {
      const buffer = await this.storage.read(image.storageKey)
      perImage.push({ imageId: image.id, detections: await this.detect(session, buffer) })
    }
    const suggestion = aggregateDamage(perImage)
    return {
      status: VisionStatus.READY,
      modelName: MODEL_NAME,
      suggestedLevel: suggestion.suggestedLevel,
      confidence: suggestion.confidence,
      summary: suggestion.summary,
      findings: {
        totals: suggestion.totals,
        images: suggestion.images,
        coverageRatio: suggestion.coverageRatio,
      } satisfies Prisma.InputJsonObject,
    }
  }

  private async detect(session: Session, buffer: Buffer) {
    const ort = await import('onnxruntime-node')
    const prepared = await this.tensor(buffer)
    const inputName = session.inputNames[0]
    const outputName = session.outputNames[0]
    if (!inputName || !outputName) throw new Error('النموذج بلا مدخل أو مخرج')
    const tensor = new ort.Tensor('float32', prepared.data, [1, 3, YOLO_INPUT, YOLO_INPUT])
    const outputs = await session.run({ [inputName]: tensor })
    const output = outputs[outputName]
    if (!output) throw new Error('النموذج لم يُرجع كشفاً')
    return decodeYoloOutput({
      data: output.data as Float32Array,
      dims: output.dims,
      classCount: DefectClass.length,
      meta: prepared.meta,
      width: prepared.width,
      height: prepared.height,
      minConfidence: VISION_MIN_CONFIDENCE,
    })
  }

  private async tensor(buffer: Buffer) {
    const source = sharp(buffer).rotate()
    const info = await source.metadata()
    const width = info.width ?? 0
    const height = info.height ?? 0
    if (width < 2 || height < 2) throw new Error('الصورة أصغر من أن تُقيَّم')
    const box = letterbox(width, height)
    const resized = await source
      .clone()
      .resize(box.resizedW, box.resizedH, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer()
    const plane = YOLO_INPUT * YOLO_INPUT
    const data = new Float32Array(3 * plane)
    data.fill(114 / 255)
    for (let y = 0; y < box.resizedH; y += 1) {
      for (let x = 0; x < box.resizedW; x += 1) {
        const dx = box.padX + x
        const dy = box.padY + y
        if (dx < 0 || dy < 0 || dx >= YOLO_INPUT || dy >= YOLO_INPUT) continue
        const src = (y * box.resizedW + x) * 3
        const dst = dy * YOLO_INPUT + dx
        data[dst] = (resized[src] ?? 0) / 255
        data[plane + dst] = (resized[src + 1] ?? 0) / 255
        data[2 * plane + dst] = (resized[src + 2] ?? 0) / 255
      }
    }
    return { data, meta: box, width, height }
  }
}
