import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import { MAX_IMAGE_BYTES, MAX_IMAGES, listQuerySchema, mapQuerySchema, reportFieldsSchema, reviewSchema, updateReportSchema } from '@damage/shared'
import type { Response } from 'express'
import { CurrentUser, type AuthUser } from '../common/current-user.decorator'
import { parseOrThrow } from '../common/parse'
import { ReportsService } from './reports.service'
import type { UploadedImage } from '../storage/storage.service'

const imageInterceptor = FilesInterceptor('images', MAX_IMAGES, {
  limits: { fileSize: MAX_IMAGE_BYTES },
})

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('map')
  map(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.map(user, parseOrThrow(mapQuerySchema, query))
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.list(user, parseOrThrow(listQuerySchema, query))
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(imageInterceptor)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, string>,
    @UploadedFiles() files: UploadedImage[] = [],
  ) {
    return this.reports.create(user, parseOrThrow(reportFieldsSchema, body), files ?? [])
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('preview')
  @UseInterceptors(imageInterceptor)
  preview(@CurrentUser() user: AuthUser, @UploadedFiles() files: UploadedImage[] = []) {
    return this.reports.preview(user, files ?? [])
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getById(user, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.reports.update(user, id, parseOrThrow(updateReportSchema, body))
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.submit(user, id)
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/assess')
  assess(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.reassess(user, id)
  }

  @Post(':id/review')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.reports.review(user, id, parseOrThrow(reviewSchema, body))
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/images')
  @UseInterceptors(imageInterceptor)
  addImages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: UploadedImage[] = [],
  ) {
    return this.reports.addImages(user, id, files ?? [])
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.reports.removeImage(user, id, imageId)
  }

  @Get(':id/images/:imageId')
  async image(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Res() res: Response,
  ) {
    const file = await this.reports.openImage(user, id, imageId)
    if ('url' in file) {
      res.redirect(file.url)
      return
    }
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`)
    file.stream.pipe(res)
  }
}
