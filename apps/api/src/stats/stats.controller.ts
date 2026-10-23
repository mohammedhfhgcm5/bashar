import { Controller, Get } from '@nestjs/common'
import { Role } from '@damage/shared'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { Roles } from '../common/roles.decorator'
import { StatsService } from './stats.service'

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @Roles(Role.SUPERVISOR, Role.ORGANIZATION)
  overview(@CurrentUser() user: AuthUser) {
    return this.stats.overview(user)
  }
}
