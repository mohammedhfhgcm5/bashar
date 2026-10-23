import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { Role, type CreateUserInput } from '@damage/shared'
import type { AuthUser } from '../common/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  organizationId: true,
  isActive: true,
  createdAt: true,
  organization: { select: { id: true, name: true } },
} as const

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: userSelect })
  }

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException('البريد مستخدم')
    if (input.role === Role.ORGANIZATION) {
      const org = await this.prisma.organization.findUnique({ where: { id: input.organizationId } })
      if (!org || !org.isActive) throw new NotFoundException('المنظمة غير موجودة')
    }
    return this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role,
        organizationId: input.role === Role.ORGANIZATION ? input.organizationId : null,
      },
      select: userSelect,
    })
  }

  async update(
    actor: AuthUser,
    id: string,
    input: { fullName?: string; phone?: string; isActive?: boolean; organizationId?: string | null },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('المستخدم غير موجود')
    if (actor.id === id && input.isActive === false) {
      throw new ForbiddenException('لا يمكنك تعطيل حسابك')
    }
    if (input.organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: input.organizationId } })
      if (!org) throw new NotFoundException('المنظمة غير موجودة')
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
        ...(input.organizationId !== undefined && user.role === Role.ORGANIZATION
          ? { organizationId: input.organizationId }
          : {}),
      },
      select: userSelect,
    })
  }
}
