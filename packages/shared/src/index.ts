import { z } from 'zod'
import { DamageLevel, damageLevelLabel } from './levels'

export { DamageLevel, damageLevelLabel }

export const Role = {
  CITIZEN: 'CITIZEN',
  RESIDENT: 'RESIDENT',
  SUPERVISOR: 'SUPERVISOR',
  ORGANIZATION: 'ORGANIZATION',
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const PropertyType = {
  HOUSE: 'HOUSE',
  APARTMENT: 'APARTMENT',
  BUILDING: 'BUILDING',
  COMMERCIAL: 'COMMERCIAL',
  OTHER: 'OTHER',
} as const
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType]

export const ReportStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus]

export const ReviewAction = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  EDIT: 'EDIT',
} as const
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction]

export const AidType = {
  FOOD: 'FOOD',
  SHELTER: 'SHELTER',
  MEDICAL: 'MEDICAL',
  CASH: 'CASH',
  RECONSTRUCTION: 'RECONSTRUCTION',
  OTHER: 'OTHER',
} as const
export type AidType = (typeof AidType)[keyof typeof AidType]

export const AidStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const
export type AidStatus = (typeof AidStatus)[keyof typeof AidStatus]

export const MAX_IMAGES = 10
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export const roleLabel: Record<Role, string> = {
  CITIZEN: 'مواطن',
  RESIDENT: 'مقيم',
  SUPERVISOR: 'مشرف',
  ORGANIZATION: 'منظمة',
}

export const propertyTypeLabel: Record<PropertyType, string> = {
  HOUSE: 'منزل',
  APARTMENT: 'شقة',
  BUILDING: 'مبنى',
  COMMERCIAL: 'تجاري',
  OTHER: 'أخرى',
}

export const reportStatusLabel: Record<ReportStatus, string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'مُرسل',
  UNDER_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
}

export const reviewActionLabel: Record<ReviewAction, string> = {
  APPROVE: 'اعتماد',
  REJECT: 'رفض',
  EDIT: 'تعديل',
}

export const aidTypeLabel: Record<AidType, string> = {
  FOOD: 'غذائية',
  SHELTER: 'إيواء',
  MEDICAL: 'طبية',
  CASH: 'نقدية',
  RECONSTRUCTION: 'إعادة إعمار',
  OTHER: 'أخرى',
}

export const aidStatusLabel: Record<AidStatus, string> = {
  PLANNED: 'مخططة',
  IN_PROGRESS: 'قيد التنفيذ',
  DELIVERED: 'تم التسليم',
  CANCELLED: 'ملغاة',
}

const damageLevelSchema = z.enum([
  DamageLevel.LOW,
  DamageLevel.MEDIUM,
  DamageLevel.HIGH,
  DamageLevel.CRITICAL,
])

const propertyTypeSchema = z.enum([
  PropertyType.HOUSE,
  PropertyType.APARTMENT,
  PropertyType.BUILDING,
  PropertyType.COMMERCIAL,
  PropertyType.OTHER,
])

const reportStatusSchema = z.enum([
  ReportStatus.DRAFT,
  ReportStatus.SUBMITTED,
  ReportStatus.UNDER_REVIEW,
  ReportStatus.APPROVED,
  ReportStatus.REJECTED,
])

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'الاسم ثلاثة أحرف على الأقل').max(120),
  email: z.string().trim().email('البريد غير صالح').max(180),
  phone: z.string().trim().min(8, 'رقم الهاتف قصير').max(20),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل').max(72),
  role: z.enum([Role.CITIZEN, Role.RESIDENT]),
})

export const loginSchema = z.object({
  email: z.string().trim().email('البريد غير صالح'),
  password: z.string().min(1, 'أدخل كلمة المرور'),
})

export const createUserSchema = z
  .object({
    fullName: z.string().trim().min(3, 'الاسم ثلاثة أحرف على الأقل').max(120),
    email: z.string().trim().email('البريد غير صالح').max(180),
    phone: z.string().trim().min(8, 'رقم الهاتف قصير').max(20),
    password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل').max(72),
    role: z.enum([Role.SUPERVISOR, Role.ORGANIZATION]),
    organizationId: z.string().uuid('المنظمة غير محددة').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === Role.ORGANIZATION && !value.organizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'مستخدم المنظمة يحتاج منظمة',
        path: ['organizationId'],
      })
    }
  })

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(3, 'الاسم ثلاثة أحرف على الأقل').max(120).optional(),
    phone: z.string().trim().min(8, 'رقم الهاتف قصير').max(20).optional(),
    isActive: z.boolean().optional(),
    organizationId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'لا يوجد تعديل')

export const organizationSchema = z.object({
  name: z.string().trim().min(2, 'اسم المنظمة قصير').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  contactEmail: z.string().trim().email('البريد غير صالح'),
  contactPhone: z.string().trim().min(8, 'رقم الهاتف قصير').max(20),
})

export const updateOrganizationSchema = organizationSchema.partial().extend({
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'لا يوجد تعديل')

export const reportFieldsSchema = z.object({
  address: z.string().trim().min(3, 'العنوان قصير').max(300),
  lat: z.coerce.number().gte(-90, 'خط العرض غير صالح').lte(90, 'خط العرض غير صالح'),
  lng: z.coerce.number().gte(-180, 'خط الطول غير صالح').lte(180, 'خط الطول غير صالح'),
  propertyType: propertyTypeSchema,
  description: z.string().trim().min(10, 'صف الضرر بما لا يقل عن 10 أحرف').max(4000),
  damageLevel: damageLevelSchema,
  intent: z.enum([ReportStatus.DRAFT, ReportStatus.SUBMITTED]).default(ReportStatus.SUBMITTED),
})

export const updateReportSchema = z
  .object({
    address: z.string().trim().min(3, 'العنوان قصير').max(300).optional(),
    lat: z.coerce.number().gte(-90).lte(90).optional(),
    lng: z.coerce.number().gte(-180).lte(180).optional(),
    propertyType: propertyTypeSchema.optional(),
    description: z.string().trim().min(10, 'الوصف قصير').max(4000).optional(),
    damageLevel: damageLevelSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'لا يوجد تعديل')

export const reviewSchema = z
  .object({
    action: z.enum([ReviewAction.APPROVE, ReviewAction.REJECT, ReviewAction.EDIT]),
    damageLevel: damageLevelSchema.optional(),
    description: z.string().trim().min(10, 'الوصف قصير').max(4000).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === ReviewAction.REJECT && (!value.note || value.note.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'سبب الرفض مطلوب',
        path: ['note'],
      })
    }
    if (value.action === ReviewAction.EDIT && !value.damageLevel && !value.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدد مستوى الضرر أو الوصف',
        path: ['damageLevel'],
      })
    }
  })

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: reportStatusSchema.optional(),
  damageLevel: damageLevelSchema.optional(),
  propertyType: propertyTypeSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ غير صالح').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'التاريخ غير صالح').optional(),
  q: z.string().trim().max(40).optional(),
})

export const mapQuerySchema = z
  .object({
    west: z.coerce.number().gte(-180).lte(180),
    south: z.coerce.number().gte(-90).lte(90),
    east: z.coerce.number().gte(-180).lte(180),
    north: z.coerce.number().gte(-90).lte(90),
    status: reportStatusSchema.optional(),
    damageLevel: damageLevelSchema.optional(),
    propertyType: propertyTypeSchema.optional(),
  })
  .refine((value) => value.west < value.east, 'إطار الخريطة غير صالح')
  .refine((value) => value.south < value.north, 'إطار الخريطة غير صالح')

const aidTypeSchema = z.enum([
  AidType.FOOD,
  AidType.SHELTER,
  AidType.MEDICAL,
  AidType.CASH,
  AidType.RECONSTRUCTION,
  AidType.OTHER,
])

const aidStatusSchema = z.enum([
  AidStatus.PLANNED,
  AidStatus.IN_PROGRESS,
  AidStatus.DELIVERED,
  AidStatus.CANCELLED,
])

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'التاريخ غير صالح')
  .optional()

export const aidCreateSchema = z.object({
  reportId: z.string().uuid('البلاغ غير محدد'),
  aidType: aidTypeSchema,
  notes: z.string().trim().max(2000).optional().default(''),
  scheduledAt: optionalDate,
})

export const aidUpdateSchema = z
  .object({
    status: aidStatusSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
    aidType: aidTypeSchema.optional(),
    scheduledAt: optionalDate.nullable(),
    deliveredAt: optionalDate.nullable(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), 'لا يوجد تعديل')

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type ReportFields = z.infer<typeof reportFieldsSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type ListQuery = z.infer<typeof listQuerySchema>
export type MapQuery = z.infer<typeof mapQuerySchema>
export type AidCreateInput = z.infer<typeof aidCreateSchema>
export type OrganizationInput = z.infer<typeof organizationSchema>

export {
  DefectClass,
  VISION_MIN_CONFIDENCE,
  aggregateDamage,
  boxCoverage,
  type DamageSuggestion,
  type Detection,
  type ImageDetections,
  type VisionDetectionView,
  type VisionTotal,
} from './defects'
