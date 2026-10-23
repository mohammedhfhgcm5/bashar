import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { MAX_IMAGE_BYTES } from '@damage/shared'
import { sniffImage } from '../common/image-sniff'
import { resolveInside } from '../common/storage-path'
import { BadRequestException } from '@nestjs/common'

export type UploadedImage = {
  buffer: Buffer
  originalname: string
  size: number
}

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  private root() {
    return this.config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads')
  }

  async save(reportId: string, file: UploadedImage) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('حجم الصورة يتجاوز 8 ميغابايت')
    }
    const sniffed = sniffImage(file.buffer)
    if (!sniffed) throw new BadRequestException('الصور المقبولة: JPG و PNG و WEBP')
    const key = `${reportId}/${randomUUID()}.${sniffed.ext}`
    const full = resolveInside(this.root(), key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, file.buffer)
    const originalName = path.basename(file.originalname).replace(/[^\w.\-\u0600-\u06FF ]/g, '').slice(0, 180) || `image.${sniffed.ext}`
    return { storageKey: key, mimeType: sniffed.mime, sizeBytes: file.size, originalName }
  }

  open(storageKey: string) {
    return createReadStream(this.absolutePath(storageKey))
  }

  absolutePath(storageKey: string) {
    return resolveInside(this.root(), storageKey)
  }

  async remove(storageKey: string) {
    try {
      await unlink(resolveInside(this.root(), storageKey))
    } catch {
      return
    }
  }
}
