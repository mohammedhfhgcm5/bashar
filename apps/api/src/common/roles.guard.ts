import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Role } from '@damage/shared'
import { ROLES_KEY } from './roles.decorator'
import type { AuthUser } from './current-user.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!roles || roles.length === 0) return true
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ForbiddenException('ليست لديك صلاحية لهذا الإجراء')
    }
    return true
  }
}
