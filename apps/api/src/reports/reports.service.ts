import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  ReportStatus,
  ReviewAction,
  Role,
  type ListQuery,
  type MapQuery,
  type ReportFields,
  type ReviewInput,
} from '@damage/shared'
import type { AuthUser } from '../common/current-user.decorator'
import { sniffImage } from '../common/image-sniff'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService, type UploadedImage } from '../storage/storage.service'
import { VisionService } from '../vision/vision.service'
import {
  canReadReport,
  decideOpen,
  decideOwnerUpdate,
  decideReview,
  decideSubmit,
  listWhere,
  PolicyError,
  presentReport,
  type Actor,
} from './report-policy'

const reportInclude = {
  property: true,
  images: { orderBy: { createdAt: 'asc' as const } },
  submittedBy: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  reviewLogs: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { id: true, fullName: true } } },
  },
  aidRecords: {
    orderBy: { createdAt: 'desc' as const },
    include: { organization: { select: { id: true, name: true } } },
  },
  assessment: true,
} satisfies Prisma.ReportInclude

function asActor(user: AuthUser): Actor {
  return { id: user.id, role: user.role, organizationId: user.organizationId }
}

function rethrow(error: unknown): never {
  if (error instanceof PolicyError) throw new HttpException(error.message, error.statusCode)
  throw error
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vision: VisionService,
  ) {}

  async create(user: AuthUser, fields: ReportFields, files: UploadedImage[]) {
    if (user.role === Role.ORGANIZATION) {
      throw new HttpException('المنظمة لا ترفع بلاغات', 403)
    }
    if (files.length > MAX_IMAGES) throw new BadRequestException('الحد عشر صور لكل بلاغ')
    if (fields.intent === ReportStatus.SUBMITTED && files.length === 0) {
      throw new BadRequestException('أرفق صورة واحدة على الأقل')
    }

    const reportId = randomUUID()
    const stored: { storageKey: string; mimeType: string; sizeBytes: number; originalName: string }[] = []
    try {
      for (const file of files) stored.push(await this.storage.save(reportId, file))
      const created = await this.prisma.$transaction(async (tx) => {
        const year = new Date().getFullYear()
        const counter = await tx.reportCounter.upsert({
          where: { year },
          create: { year, last: 1 },
          update: { last: { increment: 1 } },
        })
        const referenceCode = `RPT-${year}-${String(counter.last).padStart(5, '0')}`
        const property = await tx.property.create({
          data: {
            address: fields.address,
            lat: fields.lat,
            lng: fields.lng,
            propertyType: fields.propertyType,
          },
        })
        return tx.report.create({
          data: {
            id: reportId,
            referenceCode,
            propertyId: property.id,
            submittedById: user.id,
            description: fields.description,
            damageLevel: fields.damageLevel,
            status: fields.intent,
            submittedAt: fields.intent === ReportStatus.SUBMITTED ? new Date() : null,
            images: { create: stored },
          },
          include: reportInclude,
        })
      })
      await this.vision.refresh(created.id)
      return presentReport(asActor(user), await this.applyModelLevel(created.id))
    } catch (error) {
      await Promise.all(stored.map((file) => this.storage.remove(file.storageKey)))
      throw error
    }
  }

  async preview(user: AuthUser, files: UploadedImage[]) {
    if (user.role === Role.ORGANIZATION) {
      throw new HttpException('المنظمة لا ترفع بلاغات', 403)
    }
    if (files.length === 0) throw new BadRequestException('أرفق صورة واحدة على الأقل')
    if (files.length > MAX_IMAGES) throw new BadRequestException('الحد عشر صور لكل بلاغ')
    for (const file of files) {
      if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('حجم الصورة يتجاوز 8 ميغابايت')
      if (!sniffImage(file.buffer)) throw new BadRequestException('الصور المقبولة: JPG و PNG و WEBP')
    }
    try {
      const suggestion = await this.vision.preview(files.map((file) => file.buffer))
      return {
        status: suggestion.status,
        suggestedLevel: suggestion.suggestedLevel,
        confidence: suggestion.confidence,
        coverageRatio: suggestion.coverageRatio,
        summary: suggestion.summary,
        totals: suggestion.totals,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تقييم الصور'
      throw new BadRequestException(message || 'تعذر تقييم الصور')
    }
  }

  async list(user: AuthUser, query: ListQuery) {
    const where = listWhere(asActor(user), query) as Prisma.ReportWhereInput
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          property: true,
          submittedBy: { select: { id: true, fullName: true, role: true } },
          _count: { select: { images: true } },
        },
      }),
    ])
    return {
      items: rows.map((row) => ({
        id: row.id,
        referenceCode: row.referenceCode,
        description: row.description,
        damageLevel: row.damageLevel,
        status: row.status,
        createdAt: row.createdAt,
        submittedAt: row.submittedAt,
        imageCount: row._count.images,
        property: {
          address: row.property.address,
          lat: row.property.lat,
          lng: row.property.lng,
          propertyType: row.property.propertyType,
        },
        submittedBy: { id: row.submittedBy.id, fullName: row.submittedBy.fullName, role: row.submittedBy.role },
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async map(user: AuthUser, query: MapQuery) {
    const actor = asActor(user)
    if (this.prisma.postgis) return this.mapWithPostgis(actor, query)
    const where = listWhere(actor, {
      status: query.status,
      damageLevel: query.damageLevel,
      propertyType: query.propertyType,
    }) as Prisma.ReportWhereInput
    const propertyFilter = (where.property ?? {}) as Prisma.PropertyWhereInput
    where.property = {
      ...propertyFilter,
      lat: { gte: query.south, lte: query.north },
      lng: { gte: query.west, lte: query.east },
    }
    const rows = await this.prisma.report.findMany({
      where,
      take: 2000,
      select: {
        id: true,
        referenceCode: true,
        damageLevel: true,
        status: true,
        property: { select: { lat: true, lng: true } },
      },
    })
    return this.toGeoJson(
      rows.map((row) => ({
        id: row.id,
        referenceCode: row.referenceCode,
        damageLevel: row.damageLevel,
        status: row.status,
        lat: row.property.lat,
        lng: row.property.lng,
      })),
    )
  }

  async getById(user: AuthUser, id: string) {
    const report = await this.findReadable(user, id)
    const next = decideOpen(asActor(user), report.status)
    if (!next) return presentReport(asActor(user), report)
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: next },
      include: reportInclude,
    })
    return presentReport(asActor(user), updated)
  }

  async update(
    user: AuthUser,
    id: string,
    input: {
      address?: string
      lat?: number
      lng?: number
      propertyType?: ReportFields['propertyType']
      description?: string
      damageLevel?: ReportFields['damageLevel']
    },
  ) {
    const report = await this.findReadable(user, id)
    const actor = asActor(user)
    const reviewable = report.status === ReportStatus.SUBMITTED || report.status === ReportStatus.UNDER_REVIEW
    if (user.role === Role.SUPERVISOR && reviewable) {
      let decision
      try {
        decision =
          input.damageLevel || input.description
            ? decideReview(actor, report, {
                action: ReviewAction.EDIT,
                damageLevel: input.damageLevel,
                description: input.description,
                note: '',
              })
            : {
                status: report.status === ReportStatus.SUBMITTED ? ReportStatus.UNDER_REVIEW : report.status,
                damageLevel: report.damageLevel,
                description: report.description,
                rejectionReason: report.rejectionReason,
              }
      } catch (error) {
        rethrow(error)
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.applyProperty(tx, report.propertyId, input)
        await tx.reviewLog.create({
          data: {
            reportId: id,
            actorId: user.id,
            action: ReviewAction.EDIT,
            note: '',
            before: this.snapshot(report),
            after: {
              status: decision.status,
              damageLevel: decision.damageLevel,
              description: decision.description,
              rejectionReason: decision.rejectionReason,
            },
          },
        })
        return tx.report.update({
          where: { id },
          data: {
            status: decision.status,
            damageLevel: decision.damageLevel,
            description: decision.description,
          },
          include: reportInclude,
        })
      })
      return presentReport(actor, updated)
    }

    try {
      decideOwnerUpdate(actor, report)
    } catch (error) {
      rethrow(error)
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.applyProperty(tx, report.propertyId, input)
      return tx.report.update({
        where: { id },
        data: {
          ...(input.description ? { description: input.description } : {}),
          ...(input.damageLevel ? { damageLevel: input.damageLevel } : {}),
        },
        include: reportInclude,
      })
    })
    return presentReport(actor, updated)
  }

  async submit(user: AuthUser, id: string) {
    const report = await this.findReadable(user, id)
    let decision
    try {
      decision = decideSubmit(asActor(user), report)
    } catch (error) {
      rethrow(error)
    }
    if (report.images.length === 0) throw new BadRequestException('أرفق صورة واحدة على الأقل')
    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: decision.status,
        submittedAt: new Date(),
        rejectionReason: decision.clearRejection ? null : report.rejectionReason,
        reviewedAt: decision.clearRejection ? null : report.reviewedAt,
        reviewedById: decision.clearRejection ? null : report.reviewedById,
      },
      include: reportInclude,
    })
    return presentReport(asActor(user), updated)
  }

  async review(user: AuthUser, id: string, input: ReviewInput) {
    const report = await this.findReadable(user, id)
    let decision
    try {
      decision = decideReview(asActor(user), report, input)
    } catch (error) {
      rethrow(error)
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewLog.create({
        data: {
          reportId: id,
          actorId: user.id,
          action: decision.logAction,
          note: decision.note,
          before: this.snapshot(report),
          after: {
            status: decision.status,
            damageLevel: decision.damageLevel,
            description: decision.description,
            rejectionReason: decision.rejectionReason,
          },
        },
      })
      return tx.report.update({
        where: { id },
        data: {
          status: decision.status,
          damageLevel: decision.damageLevel,
          description: decision.description,
          rejectionReason: decision.rejectionReason,
          ...(decision.reviewed
            ? { reviewedById: user.id, reviewedAt: new Date() }
            : {}),
        },
        include: reportInclude,
      })
    })
    return presentReport(asActor(user), updated)
  }

  async addImages(user: AuthUser, id: string, files: UploadedImage[]) {
    const report = await this.findReadable(user, id)
    try {
      decideOwnerUpdate(asActor(user), report)
    } catch (error) {
      rethrow(error)
    }
    if (files.length === 0) throw new BadRequestException('اختر صورة')
    if (report.images.length + files.length > MAX_IMAGES) {
      throw new BadRequestException('الحد عشر صور لكل بلاغ')
    }
    const stored: { storageKey: string; mimeType: string; sizeBytes: number; originalName: string }[] = []
    try {
      for (const file of files) stored.push(await this.storage.save(id, file))
      await this.prisma.report.update({
        where: { id },
        data: { images: { create: stored } },
      })
      await this.vision.refresh(id)
      return presentReport(asActor(user), await this.reload(id))
    } catch (error) {
      await Promise.all(stored.map((file) => this.storage.remove(file.storageKey)))
      throw error
    }
  }

  async removeImage(user: AuthUser, reportId: string, imageId: string) {
    const report = await this.findReadable(user, reportId)
    try {
      decideOwnerUpdate(asActor(user), report)
    } catch (error) {
      rethrow(error)
    }
    const image = report.images.find((item) => item.id === imageId)
    if (!image) throw new NotFoundException('الصورة غير موجودة')
    await this.prisma.image.delete({ where: { id: imageId } })
    await this.storage.remove(image.storageKey)
    await this.vision.refresh(reportId)
    return { ok: true }
  }

  async reassess(user: AuthUser, id: string) {
    const report = await this.findReadable(user, id)
    await this.vision.refresh(report.id)
    return presentReport(asActor(user), await this.reload(id))
  }

  async openImage(
    user: AuthUser,
    reportId: string,
    imageId: string,
  ): Promise<
    | { url: string; mimeType: string; name: string }
    | { stream: ReturnType<StorageService['open']>; mimeType: string; name: string }
  > {
    const report = await this.findReadable(user, reportId)
    const image = report.images.find((item) => item.id === imageId)
    if (!image) throw new NotFoundException('الصورة غير موجودة')
    const url = this.storage.remoteUrl(image.storageKey)
    if (url) return { url, mimeType: image.mimeType, name: image.originalName }
    return { stream: this.storage.open(image.storageKey), mimeType: image.mimeType, name: image.originalName }
  }

  private async applyModelLevel(id: string) {
    const report = await this.reload(id)
    const suggested = report.assessment?.suggestedLevel
    if (!suggested || suggested === report.damageLevel) return report
    await this.prisma.report.update({ where: { id }, data: { damageLevel: suggested } })
    return this.reload(id)
  }

  private async reload(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: reportInclude })
    if (!report) throw new NotFoundException('البلاغ غير موجود')
    return report
  }

  private async findReadable(user: AuthUser, id: string) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: reportInclude })
    if (!report || !canReadReport(asActor(user), report)) throw new NotFoundException('البلاغ غير موجود')
    return report
  }

  private async applyProperty(
    tx: Prisma.TransactionClient,
    propertyId: string,
    input: { address?: string; lat?: number; lng?: number; propertyType?: ReportFields['propertyType'] },
  ) {
    const data: Prisma.PropertyUpdateInput = {}
    if (input.address) data.address = input.address
    if (typeof input.lat === 'number') data.lat = input.lat
    if (typeof input.lng === 'number') data.lng = input.lng
    if (input.propertyType) data.propertyType = input.propertyType
    if (Object.keys(data).length === 0) return
    await tx.property.update({ where: { id: propertyId }, data })
  }

  private snapshot(report: {
    status: string
    damageLevel: string
    description: string
    rejectionReason: string | null
  }) {
    return {
      status: report.status,
      damageLevel: report.damageLevel,
      description: report.description,
      rejectionReason: report.rejectionReason,
    }
  }

  private async mapWithPostgis(actor: Actor, query: MapQuery) {
    const scoped = listWhere(actor, {
      status: query.status,
      damageLevel: query.damageLevel,
      propertyType: query.propertyType,
    })
    const ownerId = typeof scoped.submittedById === 'string' ? scoped.submittedById : null
    const status = typeof scoped.status === 'string' ? scoped.status : null
    const damageLevel = typeof scoped.damageLevel === 'string' ? scoped.damageLevel : null
    const propertyType =
      scoped.property && typeof scoped.property === 'object' && 'propertyType' in scoped.property
        ? String(scoped.property.propertyType)
        : null
    const rows = await this.prisma.$queryRaw<
      { id: string; referenceCode: string; damageLevel: string; status: string; lat: number; lng: number }[]
    >`
      SELECT r.id, r."referenceCode", r."damageLevel"::text AS "damageLevel", r.status::text AS status, p.lat, p.lng
      FROM "Report" r
      JOIN "Property" p ON p.id = r."propertyId"
      WHERE p.location IS NOT NULL
        AND ST_Intersects(
          p.location,
          ST_MakeEnvelope(${query.west}, ${query.south}, ${query.east}, ${query.north}, 4326)::geography
        )
        AND (${ownerId}::text IS NULL OR r."submittedById" = ${ownerId})
        AND (${status}::text IS NULL OR r.status::text = ${status})
        AND (${damageLevel}::text IS NULL OR r."damageLevel"::text = ${damageLevel})
        AND (${propertyType}::text IS NULL OR p."propertyType"::text = ${propertyType})
      LIMIT 2000
    `
    return this.toGeoJson(rows)
  }

  private toGeoJson(
    rows: { id: string; referenceCode: string; damageLevel: string; status: string; lat: number; lng: number }[],
  ) {
    return {
      type: 'FeatureCollection' as const,
      features: rows.map((row) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [row.lng, row.lat] },
        properties: {
          id: row.id,
          referenceCode: row.referenceCode,
          damageLevel: row.damageLevel,
          status: row.status,
        },
      })),
    }
  }
}
