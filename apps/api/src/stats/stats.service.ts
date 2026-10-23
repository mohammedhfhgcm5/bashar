import { HttpException, Injectable } from '@nestjs/common'
import { ReportStatus, Role } from '@damage/shared'
import type { AuthUser } from '../common/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { assertStats, PolicyError } from '../reports/report-policy'

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser) {
    try {
      assertStats({ id: user.id, role: user.role, organizationId: user.organizationId })
    } catch (error) {
      if (error instanceof PolicyError) throw new HttpException(error.message, error.statusCode)
      throw error
    }

    const reportWhere = user.role === Role.ORGANIZATION ? { status: ReportStatus.APPROVED } : {}
    const aidWhere = user.role === Role.ORGANIZATION ? { organizationId: user.organizationId ?? '__none__' } : {}

    const [byStatus, byDamage, byType, pendingReview, series, aidByStatus] = await Promise.all([
      this.prisma.report.groupBy({ by: ['status'], where: reportWhere, _count: { _all: true } }),
      this.prisma.report.groupBy({ by: ['damageLevel'], where: reportWhere, _count: { _all: true } }),
      this.prisma.$queryRaw<{ propertyType: string; count: number }[]>`
        SELECT p."propertyType"::text AS "propertyType", COUNT(*)::int AS count
        FROM "Report" r
        JOIN "Property" p ON p.id = r."propertyId"
        WHERE (${user.role}::text <> 'ORGANIZATION' OR r.status::text = 'APPROVED')
        GROUP BY p."propertyType"
      `,
      this.prisma.report.count({
        where: { status: { in: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW] } },
      }),
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('day', COALESCE(r."submittedAt", r."createdAt")), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "Report" r
        WHERE COALESCE(r."submittedAt", r."createdAt") >= NOW() - INTERVAL '30 days'
          AND (${user.role}::text <> 'ORGANIZATION' OR r.status::text = 'APPROVED')
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.aidDistribution.groupBy({ by: ['status'], where: aidWhere, _count: { _all: true } }),
    ])

    return {
      reportsByStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      reportsByDamage: byDamage.map((row) => ({ damageLevel: row.damageLevel, count: row._count._all })),
      reportsByPropertyType: byType,
      pendingReview: user.role === Role.SUPERVISOR ? pendingReview : 0,
      series,
      aidByStatus: aidByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    }
  }
}
