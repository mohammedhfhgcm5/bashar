import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import type { Response } from 'express'
import type { LoginInput, RegisterInput, Role } from '@damage/shared'
import { PrismaService } from '../prisma/prisma.service'

const refreshTtlMs = 7 * 24 * 60 * 60 * 1000

type Account = {
  id: string
  fullName: string
  email: string
  phone: string
  role: Role
  organizationId: string | null
  isActive: boolean
  passwordHash: string
  organization?: { id: string; name: string } | null
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
    if (existing) throw new ConflictException('البريد مستخدم')
    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role,
      },
      include: { organization: { select: { id: true, name: true } } },
    })
    return this.startSession(user)
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { organization: { select: { id: true, name: true } } },
    })
    const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false
    if (!user || !valid || !user.isActive) {
      throw new UnauthorizedException('البريد أو كلمة المرور غير صحيحة')
    }
    return this.startSession(user)
  }

  async refresh(rawCookie?: string) {
    const session = await this.readSession(rawCookie)
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!user || !user.isActive) throw new UnauthorizedException('انتهت الجلسة')
    await this.prisma.refreshSession.delete({ where: { id: session.id } })
    return this.startSession(user)
  }

  async logout(rawCookie?: string) {
    if (!rawCookie) return
    const parsed = this.parseCookie(rawCookie)
    if (!parsed) return
    await this.prisma.refreshSession.deleteMany({ where: { id: parsed.id } })
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!user || !user.isActive) throw new UnauthorizedException('انتهت الجلسة')
    return this.toPublic(user)
  }

  setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, this.cookieOptions())
  }

  clearRefreshCookie(res: Response) {
    const { maxAge: _maxAge, ...options } = this.cookieOptions()
    res.clearCookie('refresh_token', options)
  }

  private cookieOptions() {
    const secure =
      process.env.COOKIE_SECURE === undefined
        ? process.env.NODE_ENV === 'production'
        : process.env.COOKIE_SECURE === 'true'
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/api/auth',
      maxAge: refreshTtlMs,
    }
  }

  private async startSession(user: Account) {
    const secret = randomBytes(32).toString('base64url')
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(secret),
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    })
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    })
    return {
      accessToken,
      refreshToken: `${session.id}.${secret}`,
      user: this.toPublic(user),
    }
  }

  private async readSession(rawCookie?: string) {
    const parsed = this.parseCookie(rawCookie)
    if (!parsed) throw new UnauthorizedException('انتهت الجلسة')
    const session = await this.prisma.refreshSession.findUnique({ where: { id: parsed.id } })
    if (!session || session.expiresAt.getTime() < Date.now() || session.tokenHash !== this.hash(parsed.secret)) {
      throw new UnauthorizedException('انتهت الجلسة')
    }
    return session
  }

  private parseCookie(rawCookie?: string) {
    if (!rawCookie) return null
    const dot = rawCookie.indexOf('.')
    if (dot <= 0) return null
    return { id: rawCookie.slice(0, dot), secret: rawCookie.slice(dot + 1) }
  }

  private hash(secret: string) {
    const pepper = this.config.get<string>('JWT_REFRESH_PEPPER') || 'dev-pepper'
    return createHash('sha256').update(`${pepper}:${secret}`).digest('hex')
  }

  private toPublic(user: Account) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      isActive: user.isActive,
      organization: user.organization ?? null,
    }
  }
}
