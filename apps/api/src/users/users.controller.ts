import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role, createUserSchema, updateUserSchema } from '@damage/shared'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { parseOrThrow } from '../common/parse'
import { UsersService } from './users.service'

@Controller('users')
@Roles(Role.SUPERVISOR)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list()
  }

  @Post()
  create(@Body() body: unknown) {
    return this.users.create(parseOrThrow(createUserSchema, body))
  }

  @Patch(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.users.update(actor, id, parseOrThrow(updateUserSchema, body))
  }
}
