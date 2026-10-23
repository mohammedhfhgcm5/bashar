import { SetMetadata } from '@nestjs/common'
import type { Role } from '@damage/shared'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

export const IS_PUBLIC = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC, true)
