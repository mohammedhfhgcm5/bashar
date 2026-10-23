import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { ensureSupervisor } from './bootstrap'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { PrismaService } from './prisma/prisma.service'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
  app.useGlobalFilters(new HttpExceptionFilter())
  const prisma = app.get(PrismaService)
  await ensureSupervisor(prisma)
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
