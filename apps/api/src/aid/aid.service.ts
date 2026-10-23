import { HttpException, Injectable, NotFoundException } from '@nestjs/common'
import { AidStatus, Role, type AidCreateInput } from '@damage/shared'
import type { AuthUser } from '../common/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { assertAidCreate, assertAidUpdate, PolicyError } from '../reports/report-policy'

function parseDate(value?: string | null) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

@Injectable()
export class AidService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.aidDistribution.findMany({
      where: user.role === Role.ORGANIZATION ? { organizationId: user.organizationId ?? '__none__' } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        report: {
          select: {
            id: true,
            referenceCode: true,
            damageLevel: true,
            status: true,
            property: { select: { address: true } },
          },
        },
      },
    })
  }

  async create(user: AuthUser, input: AidCreateInput) {
    const report = await this.prisma.report.findUnique({ where: { id: input.reportId } })
    if (!report) throw new NotFoundException('البلاغ غير موجود')
    try {
      assertAidCreate(
        { id: user.id, role: user.role, organizationId: user.organizationId },
        report.status,
      )
    } catch (error) {
      if (error instanceof PolicyError) throw new HttpException(error.message, error.statusCode)
      throw error
    }
    return this.prisma.aidDistribution.create({
      data: {
        reportId: report.id,
        organizationId: user.organizationId!,
        createdById: user.id,
        aidType: input.aidType,
        notes: input.notes,
        scheduledAt: parseDate(input.scheduledAt) ?? null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        report: { select: { id: true, referenceCode: true, damageLevel: true, status: true } },
      },
    })
  }

  async update(
    user: AuthUser,
    id: string,
    input: {
      status?: AidStatus
      notes?: string
      aidType?: AidCreateInput['aidType']
      scheduledAt?: string | null
      deliveredAt?: string | null
    },
  ) {
    const row = await this.prisma.aidDistribution.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('التوزيع غير موجود')
    try {
      assertAidUpdate({ id: user.id, role: user.role, organizationId: user.organizationId }, row.organizationId)
    } catch (error) {
      if (error instanceof PolicyError) throw new HttpException(error.message, error.statusCode)
      throw error
    }
    const deliveredAt = parseDate(input.deliveredAt)
    const status = input.status ?? row.status
    return this.prisma.aidDistribution.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.aidType ? { aidType: input.aidType } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: parseDate(input.scheduledAt) } : {}),
        ...(status === AidStatus.DELIVERED
          ? { deliveredAt: deliveredAt ?? row.deliveredAt ?? new Date() }
          : input.deliveredAt !== undefined
            ? { deliveredAt }
            : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        report: { select: { id: true, referenceCode: true, damageLevel: true, status: true } },
      },
    })
  }
}
