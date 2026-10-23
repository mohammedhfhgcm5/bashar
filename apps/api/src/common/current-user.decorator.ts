import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Role } from '@damage/shared'

export type AuthUser = {
  id: string
  role: Role
  organizationId: string | null
  email: string
  fullName: string
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user
})
