import { Injectable, NotFoundException } from '@nestjs/common'
import { Role } from '@damage/shared'
import type { AuthUser } from '../common/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    if (user.role === Role.ORGANIZATION) {
      if (!user.organizationId) return []
      const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId } })
      return org ? [org] : []
    }
    return this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' } })
  }

  create(input: { name: string; description?: string; contactEmail: string; contactPhone: string }) {
    return this.prisma.organization.create({
      data: {
        name: input.name,
        description: input.description ?? '',
        contactEmail: input.contactEmail.toLowerCase(),
        contactPhone: input.contactPhone,
      },
    })
  }

  async update(
    id: string,
    input: {
      name?: string
      description?: string
      contactEmail?: string
      contactPhone?: string
      isActive?: boolean
    },
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id } })
    if (!org) throw new NotFoundException('المنظمة غير موجودة')
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.contactEmail ? { contactEmail: input.contactEmail.toLowerCase() } : {}),
        ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
        ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
      },
    })
  }
}
