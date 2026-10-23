import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../common/current-user.decorator'
import type { Role } from '@damage/shared'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    })
  }

  async validate(payload: { sub?: string }): Promise<AuthUser> {
    if (!payload.sub) throw new UnauthorizedException('انتهت الجلسة')
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) throw new UnauthorizedException('انتهت الجلسة')
    return {
      id: user.id,
      role: user.role as Role,
      organizationId: user.organizationId,
      email: user.email,
      fullName: user.fullName,
    }
  }
}
