import { DamageLevel, ReportStatus, ReviewAction, Role } from '@damage/shared'
import {
  assertAidCreate,
  canReadReport,
  decideOpen,
  decideOwnerUpdate,
  decideReview,
  decideSubmit,
  listWhere,
  PolicyError,
  presentReport,
  type ReportRecord,
} from './report-policy'

const citizen = { id: 'c1', role: Role.CITIZEN, organizationId: null }
const resident = { id: 'r1', role: Role.RESIDENT, organizationId: null }
const supervisor = { id: 's1', role: Role.SUPERVISOR, organizationId: null }
const org = { id: 'o1', role: Role.ORGANIZATION, organizationId: 'org-1' }

describe('canReadReport', () => {
  const own = { submittedById: 'c1', status: ReportStatus.SUBMITTED }
  const other = { submittedById: 'c2', status: ReportStatus.SUBMITTED }
  const approved = { submittedById: 'c2', status: ReportStatus.APPROVED }

  it('limits a citizen to their own reports', () => {
    expect(canReadReport(citizen, own)).toBe(true)
    expect(canReadReport(citizen, other)).toBe(false)
    expect(canReadReport(resident, { submittedById: 'r1', status: ReportStatus.DRAFT })).toBe(true)
  })

  it('lets a supervisor read every report', () => {
    expect(canReadReport(supervisor, other)).toBe(true)
  })

  it('lets an organization read approved reports only', () => {
    expect(canReadReport(org, approved)).toBe(true)
    expect(canReadReport(org, other)).toBe(false)
  })
})

describe('listWhere', () => {
  it('scopes citizens to their id and organizations to approved reports', () => {
    expect(listWhere(citizen, { status: ReportStatus.DRAFT })).toMatchObject({
      submittedById: 'c1',
      status: ReportStatus.DRAFT,
    })
    expect(listWhere(org, { status: ReportStatus.REJECTED }).status).toBe(ReportStatus.APPROVED)
    expect(listWhere(supervisor, { q: 'RPT-2026' })).toMatchObject({
      referenceCode: { contains: 'RPT-2026', mode: 'insensitive' },
    })
  })
})

describe('transitions', () => {
  const base = {
    status: ReportStatus.SUBMITTED,
    damageLevel: DamageLevel.LOW,
    description: 'تشقق في الجدار الخارجي',
    rejectionReason: null,
  }

  it('opens a submitted report when a supervisor views it', () => {
    expect(decideOpen(supervisor, ReportStatus.SUBMITTED)).toBe(ReportStatus.UNDER_REVIEW)
    expect(decideOpen(citizen, ReportStatus.SUBMITTED)).toBeNull()
    expect(decideOpen(supervisor, ReportStatus.APPROVED)).toBeNull()
  })

  it('submits a draft or a rejected report for the owner', () => {
    expect(
      decideSubmit(citizen, { submittedById: 'c1', status: ReportStatus.DRAFT }).clearRejection,
    ).toBe(false)
    expect(
      decideSubmit(citizen, { submittedById: 'c1', status: ReportStatus.REJECTED }).clearRejection,
    ).toBe(true)
    expect(() => decideSubmit(citizen, { submittedById: 'c2', status: ReportStatus.DRAFT })).toThrow(PolicyError)
    expect(() =>
      decideSubmit(citizen, { submittedById: 'c1', status: ReportStatus.APPROVED }),
    ).toThrow(PolicyError)
  })

  it('approves, rejects with a reason, and edits damage level', () => {
    const approved = decideReview(supervisor, base, { action: ReviewAction.APPROVE, damageLevel: DamageLevel.HIGH })
    expect(approved.status).toBe(ReportStatus.APPROVED)
    expect(approved.damageLevel).toBe(DamageLevel.HIGH)
    expect(approved.rejectionReason).toBeNull()

    const rejected = decideReview(supervisor, base, { action: ReviewAction.REJECT, note: 'الصور غير واضحة' })
    expect(rejected.status).toBe(ReportStatus.REJECTED)
    expect(rejected.rejectionReason).toBe('الصور غير واضحة')

    const edited = decideReview(supervisor, base, { action: ReviewAction.EDIT, damageLevel: DamageLevel.CRITICAL })
    expect(edited.status).toBe(ReportStatus.UNDER_REVIEW)
    expect(edited.logAction).toBe(ReviewAction.EDIT)
    expect(edited.damageLevel).toBe(DamageLevel.CRITICAL)
  })

  it('blocks review outside the queue and from other roles', () => {
    expect(() =>
      decideReview(citizen, base, { action: ReviewAction.APPROVE }),
    ).toThrow(PolicyError)
    expect(() =>
      decideReview(supervisor, { ...base, status: ReportStatus.APPROVED }, { action: ReviewAction.EDIT, damageLevel: DamageLevel.LOW }),
    ).toThrow(PolicyError)
    expect(() =>
      decideReview(supervisor, { ...base, status: ReportStatus.DRAFT }, { action: ReviewAction.APPROVE }),
    ).toThrow(PolicyError)
  })

  it('lets the owner edit a draft or a rejected report only', () => {
    expect(() => decideOwnerUpdate(citizen, { submittedById: 'c1', status: ReportStatus.DRAFT })).not.toThrow()
    expect(() => decideOwnerUpdate(citizen, { submittedById: 'c1', status: ReportStatus.REJECTED })).not.toThrow()
    expect(() => decideOwnerUpdate(citizen, { submittedById: 'c1', status: ReportStatus.SUBMITTED })).toThrow(PolicyError)
  })
})

describe('presentReport', () => {
  const report: ReportRecord = {
    id: 'rep',
    referenceCode: 'RPT-2026-00001',
    description: 'سقف منهارة أجزاء منه',
    damageLevel: DamageLevel.HIGH,
    status: ReportStatus.APPROVED,
    rejectionReason: null,
    submittedAt: new Date('2026-01-01'),
    reviewedAt: new Date('2026-01-02'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    submittedById: 'c1',
    property: { id: 'p', address: 'شارع 1', lat: 33.5, lng: 36.2, propertyType: 'HOUSE' },
    images: [{ id: 'img', originalName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10 }],
    submittedBy: { id: 'c1', fullName: 'أحمد', email: 'a@b.c', phone: '0999999999', role: Role.CITIZEN },
    reviewedBy: { id: 's1', fullName: 'مشرف' },
    reviewLogs: [
      {
        id: 'log',
        action: ReviewAction.APPROVE,
        note: '',
        before: { damageLevel: DamageLevel.LOW },
        after: { damageLevel: DamageLevel.HIGH },
        createdAt: new Date('2026-01-02'),
        actor: { id: 's1', fullName: 'مشرف' },
      },
    ],
    assessment: null,
    aidRecords: [
      {
        id: 'aid',
        organizationId: 'org-1',
        aidType: 'FOOD',
        status: 'PLANNED',
        notes: '',
        scheduledAt: null,
        deliveredAt: null,
        createdAt: new Date('2026-01-03'),
        organization: { id: 'org-1', name: 'الهلال' },
      },
      {
        id: 'aid-2',
        organizationId: 'org-2',
        aidType: 'CASH',
        status: 'PLANNED',
        notes: '',
        scheduledAt: null,
        deliveredAt: null,
        createdAt: new Date('2026-01-03'),
        organization: { id: 'org-2', name: 'أخرى' },
      },
    ],
  }

  it('hides contact details and other organizations from an organization user', () => {
    const view = presentReport(org, report)
    expect(view.submittedBy).not.toHaveProperty('email')
    expect(view.submittedBy).not.toHaveProperty('phone')
    expect(view.aidRecords).toHaveLength(1)
    expect(view.reviewLogs[0]).not.toHaveProperty('before')
  })

  it('shows contact and the audit snapshot to the supervisor', () => {
    const view = presentReport(supervisor, report)
    expect(view.submittedBy).toMatchObject({ email: 'a@b.c', phone: '0999999999' })
    expect(view.reviewLogs[0]).toHaveProperty('before')
    expect(view.aidRecords).toHaveLength(2)
  })

  it('hides aid records from the citizen', () => {
    const view = presentReport(citizen, report)
    expect(view.aidRecords).toBeUndefined()
    expect(view.submittedBy).toMatchObject({ email: 'a@b.c' })
  })
})

describe('aid policy', () => {
  it('requires an approved report and the owning organization', () => {
    expect(() => assertAidCreate(org, ReportStatus.APPROVED)).not.toThrow()
    expect(() => assertAidCreate(org, ReportStatus.SUBMITTED)).toThrow(PolicyError)
    expect(() => assertAidCreate(supervisor, ReportStatus.APPROVED)).toThrow(PolicyError)
  })
})
