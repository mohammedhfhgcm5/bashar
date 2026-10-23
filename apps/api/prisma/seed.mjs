/**
 * Demo seed: organization, org user, citizen, and a handful of reports with PECCD photos.
 * Safe to re-run: refreshes demo passwords and creates missing sample reports.
 *
 * Run from repo root: npm run db:seed
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { copyFile, mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
  : path.join(root, 'apps/api/uploads')
const imageDir = path.join(root, 'ml/datasets/peccd/images/train')
const password = process.env.SEED_PASSWORD || 'Demo1234!'

const samples = [
  {
    address: 'المزة، دمشق',
    lat: 33.5035,
    lng: 36.2582,
    propertyType: 'APARTMENT',
    description: 'تشققات ظاهرة على الواجهة وتفتت سطحي قرب الشرفة بعد الزلزال.',
    damageLevel: 'HIGH',
    status: 'SUBMITTED',
  },
  {
    address: 'كفرسوسة، دمشق',
    lat: 33.4951,
    lng: 36.2714,
    propertyType: 'HOUSE',
    description: 'ثقوب في الجدار الحامل وشقوق متفرعة على السقف الداخلي.',
    damageLevel: 'CRITICAL',
    status: 'APPROVED',
  },
  {
    address: 'أبو رمانة، دمشق',
    lat: 33.5218,
    lng: 36.2789,
    propertyType: 'BUILDING',
    description: 'شقوق بسيطة على الجدار الخارجي دون سقوط عناصر.',
    damageLevel: 'LOW',
    status: 'UNDER_REVIEW',
  },
  {
    address: 'المهاجرين، دمشق',
    lat: 33.5156,
    lng: 36.2681,
    propertyType: 'COMMERCIAL',
    description: 'تقشر خرسانة على الأعمدة الأمامية مع شق عميق في أحدها.',
    damageLevel: 'CRITICAL',
    status: 'APPROVED',
  },
  {
    address: 'ركن الدين، دمشق',
    lat: 33.5382,
    lng: 36.2915,
    propertyType: 'HOUSE',
    description: 'مسودة بلاغ لمنزل يحتاج صوراً إضافية قبل الإرسال.',
    damageLevel: 'MEDIUM',
    status: 'DRAFT',
  },
]

async function pickImages(count) {
  let names = []
  try {
    names = (await readdir(imageDir)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  } catch {
    names = []
  }
  if (names.length === 0) {
    console.log('No seed photos found. Demo reports will be created without images.')
    return []
  }
  const chosen = []
  for (let i = 0; i < count; i += 1) {
    chosen.push(names[i % names.length])
  }
  return chosen
}

async function attachImages(reportId, fileNames) {
  const stored = []
  for (const name of fileNames) {
    const id = randomUUID()
    const ext = path.extname(name).slice(1).toLowerCase() || 'jpg'
    const key = `${reportId}/${id}.${ext}`
    const dest = path.join(uploadRoot, key)
    await mkdir(path.dirname(dest), { recursive: true })
    await copyFile(path.join(imageDir, name), dest)
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    stored.push({
      storageKey: key,
      originalName: name,
      mimeType: mime,
      sizeBytes: 1,
    })
  }
  return stored
}

async function upsertUser(data) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
        organizationId: data.organizationId ?? null,
        isActive: true,
      },
    })
  }
  return prisma.user.create({ data })
}

async function main() {
  const existingCitizen = await prisma.user.findUnique({ where: { email: 'citizen@damage.local' } })
  if (existingCitizen) {
    const reports = await prisma.report.count({ where: { submittedById: existingCitizen.id } })
    if (reports >= samples.length) {
      console.log('Seed already applied, skipping.')
      return
    }
  }

  const hash = await bcrypt.hash(password, 12)
  let org = await prisma.organization.findFirst({ where: { contactEmail: 'org@damage.local' } })
  if (org) {
    org = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'منظمة الإغاثة التجريبية',
        description: 'جهة تجريبية لتوزيع المساعدات على البلاغات المعتمدة.',
        contactPhone: '0933000000',
        isActive: true,
      },
    })
  } else {
    org = await prisma.organization.create({
      data: {
        name: 'منظمة الإغاثة التجريبية',
        description: 'جهة تجريبية لتوزيع المساعدات على البلاغات المعتمدة.',
        contactEmail: 'org@damage.local',
        contactPhone: '0933000000',
      },
    })
  }

  const supervisorEmail = (process.env.BOOTSTRAP_SUPERVISOR_EMAIL || 'supervisor@damage.local').toLowerCase()
  let supervisor = await prisma.user.findUnique({ where: { email: supervisorEmail } })
  if (!supervisor) {
    supervisor = await prisma.user.create({
      data: {
        fullName: process.env.BOOTSTRAP_SUPERVISOR_NAME || 'مشرف النظام',
        email: supervisorEmail,
        phone: process.env.BOOTSTRAP_SUPERVISOR_PHONE || '0900000000',
        passwordHash: await bcrypt.hash(process.env.BOOTSTRAP_SUPERVISOR_PASSWORD || password, 12),
        role: 'SUPERVISOR',
      },
    })
  }

  const citizen = await upsertUser({
    fullName: 'مواطن تجريبي',
    email: 'citizen@damage.local',
    phone: '0944000000',
    passwordHash: hash,
    role: 'CITIZEN',
  })

  const orgUser = await upsertUser({
    fullName: 'منسق المنظمة',
    email: 'org@damage.local',
    phone: '0955000000',
    passwordHash: hash,
    role: 'ORGANIZATION',
    organizationId: org.id,
  })

  const existingReports = await prisma.report.count({ where: { submittedById: citizen.id } })
  if (existingReports < samples.length) {
    const year = new Date().getFullYear()
    let counter = await prisma.reportCounter.findUnique({ where: { year } })
    if (!counter) counter = await prisma.reportCounter.create({ data: { year, last: 0 } })

    const imagePool = await pickImages(samples.length * 2)
    let imageCursor = 0
    const toCreate = samples.slice(existingReports)

    for (const sample of toCreate) {
      counter = await prisma.reportCounter.update({
        where: { year },
        data: { last: { increment: 1 } },
      })
      const reportId = randomUUID()
      const photoNames = imagePool.length
        ? [imagePool[imageCursor++], imagePool[imageCursor++]].filter(Boolean)
        : []
      const files = await attachImages(reportId, photoNames)
      const property = await prisma.property.create({
        data: {
          address: sample.address,
          lat: sample.lat,
          lng: sample.lng,
          propertyType: sample.propertyType,
        },
      })
      const submitted = sample.status !== 'DRAFT'
      const approved = sample.status === 'APPROVED'
      await prisma.report.create({
        data: {
          id: reportId,
          referenceCode: `RPT-${year}-${String(counter.last).padStart(5, '0')}`,
          propertyId: property.id,
          submittedById: citizen.id,
          description: sample.description,
          damageLevel: sample.damageLevel,
          status: sample.status,
          submittedAt: submitted ? new Date() : null,
          reviewedAt: approved ? new Date() : null,
          reviewedById: approved ? supervisor.id : null,
          images: { create: files },
        },
      })
    }
  }

  const approved = await prisma.report.findFirst({
    where: { status: 'APPROVED', submittedById: citizen.id },
    orderBy: { createdAt: 'asc' },
  })
  if (approved) {
    const aidCount = await prisma.aidDistribution.count({
      where: { reportId: approved.id, organizationId: org.id },
    })
    if (aidCount === 0) {
      await prisma.aidDistribution.create({
        data: {
          reportId: approved.id,
          organizationId: org.id,
          createdById: orgUser.id,
          aidType: 'SHELTER',
          status: 'PLANNED',
          notes: 'توزيع إيواء تجريبي مرتبط بأول بلاغ معتمد.',
          scheduledAt: new Date(),
        },
      })
    }
  }

  console.log('Seed ready.')
  console.log(`  supervisor: ${supervisorEmail} / (BOOTSTRAP_SUPERVISOR_PASSWORD)`)
  console.log(`  citizen:    citizen@damage.local / ${password}`)
  console.log(`  org user:   org@damage.local / ${password}`)
  console.log('Open each seeded report and press «تقييم الصور» if assessment is empty.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
