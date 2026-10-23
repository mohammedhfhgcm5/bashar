import {
  DamageLevel,
  ReportStatus,
  ReviewAction,
  Role,
  type DamageSuggestion,
  type ReviewInput,
} from '@damage/shared'

export type Actor = {
  id: string
  role: Role
  organizationId: string | null
}

export class PolicyError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

const citizenRoles = new Set<Role>([Role.CITIZEN, Role.RESIDENT])

export function isCitizenRole(role: Role) {
  return citizenRoles.has(role)
}

export function canReadReport(
  actor: Actor,
  report: { submittedById: string; status: ReportStatus },
) {
  if (actor.role === Role.SUPERVISOR) return true
  if (isCitizenRole(actor.role)) return report.submittedById === actor.id
  if (actor.role === Role.ORGANIZATION) return report.status === ReportStatus.APPROVED
  return false
}

export type ListFilters = {
  status?: ReportStatus
  damageLevel?: DamageLevel
  propertyType?: string
  from?: string
  to?: string
  q?: string
}

export function listWhere(actor: Actor, query: ListFilters) {
  const where: Record<string, unknown> = {}
  if (isCitizenRole(actor.role)) where.submittedById = actor.id
  if (actor.role === Role.ORGANIZATION) where.status = ReportStatus.APPROVED
  else if (query.status) where.status = query.status
  if (query.damageLevel) where.damageLevel = query.damageLevel
  if (query.propertyType) where.property = { propertyType: query.propertyType }
  if (query.q) where.referenceCode = { contains: query.q, mode: 'insensitive' }
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000`) } : {}),
      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}),
    }
  }
  return where
}

const reviewable = new Set<ReportStatus>([ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW])

export function decideOpen(actor: Actor, status: ReportStatus): ReportStatus | null {
  if (actor.role === Role.SUPERVISOR && status === ReportStatus.SUBMITTED) {
    return ReportStatus.UNDER_REVIEW
  }
  return null
}

export function decideSubmit(actor: Actor, report: { submittedById: string; status: ReportStatus }) {
  const ownsReport = report.submittedById === actor.id
  const canSubmit = ownsReport && (isCitizenRole(actor.role) || actor.role === Role.SUPERVISOR)
  if (!canSubmit) {
    throw new PolicyError('لا يمكنك إرسال هذا البلاغ', 403)
  }
  if (report.status !== ReportStatus.DRAFT && report.status !== ReportStatus.REJECTED) {
    throw new PolicyError('لا يمكن إرسال البلاغ في حالته الحالية', 409)
  }
  return {
    status: ReportStatus.SUBMITTED,
    clearRejection: report.status === ReportStatus.REJECTED,
  }
}

export function decideOwnerUpdate(actor: Actor, report: { submittedById: string; status: ReportStatus }) {
  if (report.submittedById !== actor.id) throw new PolicyError('لا يمكنك تعديل هذا البلاغ', 403)
  if (report.status !== ReportStatus.DRAFT && report.status !== ReportStatus.REJECTED) {
    throw new PolicyError('التعديل متاح للمسودة أو بعد الرفض', 409)
  }
}

export type ReviewDecision = {
  status: ReportStatus
  damageLevel: DamageLevel
  description: string
  rejectionReason: string | null
  logAction: ReviewAction
  note: string
  reviewed: boolean
}

export function decideReview(
  actor: Actor,
  report: { status: ReportStatus; damageLevel: DamageLevel; description: string; rejectionReason: string | null },
  input: ReviewInput,
): ReviewDecision {
  if (actor.role !== Role.SUPERVISOR) throw new PolicyError('المراجعة للمشرف فقط', 403)
  if (!reviewable.has(report.status)) throw new PolicyError('البلاغ ليس قيد المراجعة', 409)

  if (input.action === ReviewAction.APPROVE) {
    return {
      status: ReportStatus.APPROVED,
      damageLevel: input.damageLevel ?? report.damageLevel,
      description: input.description ?? report.description,
      rejectionReason: null,
      logAction: ReviewAction.APPROVE,
      note: input.note ?? '',
      reviewed: true,
    }
  }

  if (input.action === ReviewAction.REJECT) {
    return {
      status: ReportStatus.REJECTED,
      damageLevel: input.damageLevel ?? report.damageLevel,
      description: input.description ?? report.description,
      rejectionReason: input.note ?? '',
      logAction: ReviewAction.REJECT,
      note: input.note ?? '',
      reviewed: true,
    }
  }

  return {
    status: ReportStatus.UNDER_REVIEW,
    damageLevel: input.damageLevel ?? report.damageLevel,
    description: input.description ?? report.description,
    rejectionReason: report.rejectionReason,
    logAction: ReviewAction.EDIT,
    note: input.note ?? '',
    reviewed: false,
  }
}

type Submitter = { id: string; fullName: string; email: string; phone: string; role: Role }
type ReviewLogRow = {
  id: string
  action: ReviewAction
  note: string
  before: unknown
  after: unknown
  createdAt: Date
  actor: { id: string; fullName: string }
}
type AidRow = {
  id: string
  organizationId: string
  aidType: string
  status: string
  notes: string
  scheduledAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  organization: { id: string; name: string }
}

export type ReportRecord = {
  id: string
  referenceCode: string
  description: string
  damageLevel: DamageLevel
  status: ReportStatus
  rejectionReason: string | null
  submittedAt: Date | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
  submittedById: string
  property: {
    id: string
    address: string
    lat: number
    lng: number
    propertyType: string
  }
  images: { id: string; originalName: string; mimeType: string; sizeBytes: number }[]
  submittedBy: Submitter
  reviewedBy: { id: string; fullName: string } | null
  reviewLogs: ReviewLogRow[]
  aidRecords: AidRow[]
  assessment: {
    status: 'READY' | 'UNAVAILABLE' | 'FAILED'
    modelName: string
    suggestedLevel: DamageLevel | null
    confidence: number | null
    summary: string
    findings: unknown
  } | null
}

export function presentReport(actor: Actor, report: ReportRecord) {
  const showContact = actor.role === Role.SUPERVISOR || report.submittedById === actor.id
  const submittedBy = showContact
    ? {
        id: report.submittedBy.id,
        fullName: report.submittedBy.fullName,
        email: report.submittedBy.email,
        phone: report.submittedBy.phone,
        role: report.submittedBy.role,
      }
    : {
        id: report.submittedBy.id,
        fullName: report.submittedBy.fullName,
        role: report.submittedBy.role,
      }

  const aidRecords = isCitizenRole(actor.role)
    ? undefined
    : report.aidRecords
        .filter((row) => actor.role !== Role.ORGANIZATION || row.organizationId === actor.organizationId)
        .map((row) => ({
          id: row.id,
          aidType: row.aidType,
          status: row.status,
          notes: row.notes,
          scheduledAt: row.scheduledAt,
          deliveredAt: row.deliveredAt,
          createdAt: row.createdAt,
          organization: row.organization,
        }))

  return {
    id: report.id,
    referenceCode: report.referenceCode,
    description: report.description,
    damageLevel: report.damageLevel,
    status: report.status,
    rejectionReason: report.rejectionReason,
    submittedAt: report.submittedAt,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    property: report.property,
    images: report.images.map((image) => ({
      id: image.id,
      originalName: image.originalName,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      url: `/api/reports/${report.id}/images/${image.id}`,
    })),
    submittedBy,
    reviewedBy: report.reviewedBy,
    reviewLogs: report.reviewLogs.map((log) => ({
      id: log.id,
      action: log.action,
      note: log.note,
      createdAt: log.createdAt,
      actor: log.actor,
      ...(actor.role === Role.SUPERVISOR ? { before: log.before, after: log.after } : {}),
    })),
    aidRecords,
    assessment: presentAssessment(report.assessment),
  }
}

function presentAssessment(assessment: ReportRecord['assessment']) {
  if (!assessment) return null
  const findings = readFindings(assessment.findings)
  return {
    status: assessment.status,
    modelName: assessment.modelName,
    suggestedLevel: assessment.suggestedLevel,
    confidence: assessment.confidence,
    coverageRatio: findings.coverageRatio,
    summary: assessment.summary,
    totals: findings.totals,
    images: findings.images,
  }
}

function readFindings(value: unknown): Pick<DamageSuggestion, 'totals' | 'images' | 'coverageRatio'> {
  if (!value || typeof value !== 'object') return { totals: [], images: [], coverageRatio: null }
  const record = value as { totals?: unknown; images?: unknown; coverageRatio?: unknown }
  const coverageRatio =
    typeof record.coverageRatio === 'number' && Number.isFinite(record.coverageRatio)
      ? record.coverageRatio
      : null
  return {
    totals: Array.isArray(record.totals) ? (record.totals as DamageSuggestion['totals']) : [],
    images: Array.isArray(record.images) ? (record.images as DamageSuggestion['images']) : [],
    coverageRatio,
  }
}

export function assertAidCreate(actor: Actor, reportStatus: ReportStatus) {
  if (actor.role !== Role.ORGANIZATION || !actor.organizationId) {
    throw new PolicyError('توزيع المساعدة للمنظمة فقط', 403)
  }
  if (reportStatus !== ReportStatus.APPROVED) {
    throw new PolicyError('المساعدة تُربط ببلاغ معتمد', 409)
  }
}

export function assertAidUpdate(actor: Actor, organizationId: string) {
  if (actor.role !== Role.ORGANIZATION || actor.organizationId !== organizationId) {
    throw new PolicyError('لا يمكنك تعديل هذا التوزيع', 403)
  }
}

export function assertStats(actor: Actor) {
  if (actor.role !== Role.SUPERVISOR && actor.role !== Role.ORGANIZATION) {
    throw new PolicyError('الإحصاء غير متاح لهذا الدور', 403)
  }
}
