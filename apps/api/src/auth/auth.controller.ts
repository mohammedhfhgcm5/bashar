import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { loginSchema, registerSchema } from '@damage/shared'
import type { Request, Response } from 'express'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { Public } from '../common/roles.decorator'
import { parseOrThrow } from '../common/parse'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseOrThrow(registerSchema, body)
    const result = await this.auth.register(input)
    this.auth.setRefreshCookie(res, result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseOrThrow(loginSchema, body)
    const result = await this.auth.login(input)
    this.auth.setRefreshCookie(res, result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.refresh_token)
    this.auth.setRefreshCookie(res, result.refreshToken)
    return { accessToken: result.accessToken, user: result.user }
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token)
    this.auth.clearRefreshCookie(res)
    return { ok: true }
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id)
  }
}
