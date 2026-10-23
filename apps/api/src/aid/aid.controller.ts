import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role, aidCreateSchema, aidUpdateSchema } from '@damage/shared'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { parseOrThrow } from '../common/parse'
import { AidService } from './aid.service'

@Controller('aid')
export class AidController {
  constructor(private readonly aid: AidService) {}

  @Get()
  @Roles(Role.SUPERVISOR, Role.ORGANIZATION)
  list(@CurrentUser() user: AuthUser) {
    return this.aid.list(user)
  }

  @Post()
  @Roles(Role.ORGANIZATION)
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.aid.create(user, parseOrThrow(aidCreateSchema, body))
  }

  @Patch(':id')
  @Roles(Role.ORGANIZATION)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.aid.update(user, id, parseOrThrow(aidUpdateSchema, body))
  }
}
