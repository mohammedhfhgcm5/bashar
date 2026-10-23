import bcrypt from 'bcryptjs'
import { PrismaService } from './prisma/prisma.service'

export async function ensureSupervisor(prisma: PrismaService) {
  const email = process.env.BOOTSTRAP_SUPERVISOR_EMAIL?.toLowerCase()
  const password = process.env.BOOTSTRAP_SUPERVISOR_PASSWORD
  if (!email || !password) return
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return
  await prisma.user.create({
    data: {
      email,
      fullName: process.env.BOOTSTRAP_SUPERVISOR_NAME || 'مشرف النظام',
      phone: process.env.BOOTSTRAP_SUPERVISOR_PHONE || '0900000000',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'SUPERVISOR',
    },
  })
}
