import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { Role, organizationSchema, updateOrganizationSchema } from '@damage/shared'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { parseOrThrow } from '../common/parse'
import { OrganizationsService } from './organizations.service'

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Roles(Role.SUPERVISOR, Role.ORGANIZATION)
  list(@CurrentUser() user: AuthUser) {
    return this.organizations.list(user)
  }

  @Post()
  @Roles(Role.SUPERVISOR)
  create(@Body() body: unknown) {
    return this.organizations.create(parseOrThrow(organizationSchema, body))
  }

  @Patch(':id')
  @Roles(Role.SUPERVISOR)
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.organizations.update(id, parseOrThrow(updateOrganizationSchema, body))
  }
}
