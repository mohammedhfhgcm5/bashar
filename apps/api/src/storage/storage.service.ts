import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { MAX_IMAGE_BYTES } from '@damage/shared'
import { sniffImage } from '../common/image-sniff'
import { resolveInside } from '../common/storage-path'
import {
  parseCloudinaryUrl,
  publicIdFromDeliveryUrl,
  signCloudinary,
  type CloudinaryAccount,
} from './cloudinary'

export type UploadedImage = {
  buffer: Buffer
  originalname: string
  size: number
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(private readonly config: ConfigService) {
    if (this.account()) this.logger.log('الصور تُرفع إلى Cloudinary')
    else this.logger.warn('Cloudinary غير مضبوط، الصور تُحفظ على قرص الحاوية')
  }

  private root() {
    return this.config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads')
  }

  private account(): CloudinaryAccount | null {
    const packed = this.config.get<string>('CLOUDINARY_URL')
    if (packed) return parseCloudinaryUrl(packed)
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')
    if (!cloudName || !apiKey || !apiSecret) return null
    return { cloudName, apiKey, apiSecret }
  }

  async save(reportId: string, file: UploadedImage) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('حجم الصورة يتجاوز 8 ميغابايت')
    }
    const sniffed = sniffImage(file.buffer)
    if (!sniffed) throw new BadRequestException('الصور المقبولة: JPG و PNG و WEBP')
    const originalName =
      path.basename(file.originalname).replace(/[^\w.\-\u0600-\u06FF ]/g, '').slice(0, 180) ||
      `image.${sniffed.ext}`
    const account = this.account()
    if (account) {
      const storageKey = await this.uploadCloudinary(account, reportId, file.buffer, sniffed)
      return { storageKey, mimeType: sniffed.mime, sizeBytes: file.size, originalName }
    }
    const key = `${reportId}/${randomUUID()}.${sniffed.ext}`
    const full = resolveInside(this.root(), key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, file.buffer)
    return { storageKey: key, mimeType: sniffed.mime, sizeBytes: file.size, originalName }
  }

  remoteUrl(storageKey: string) {
    return storageKey.startsWith('https://') ? storageKey : null
  }

  open(storageKey: string) {
    return createReadStream(this.absolutePath(storageKey))
  }

  async read(storageKey: string) {
    const remote = this.remoteUrl(storageKey)
    if (!remote) return readFile(this.absolutePath(storageKey))
    const response = await fetch(remote)
    if (!response.ok) throw new BadRequestException('تعذر قراءة الصورة من Cloudinary')
    return Buffer.from(await response.arrayBuffer())
  }

  absolutePath(storageKey: string) {
    return resolveInside(this.root(), storageKey)
  }

  async remove(storageKey: string) {
    const account = this.account()
    const publicId = storageKey.startsWith('https://') ? publicIdFromDeliveryUrl(storageKey) : null
    if (account && publicId) {
      await this.destroyCloudinary(account, publicId)
      return
    }
    try {
      await unlink(resolveInside(this.root(), storageKey))
    } catch {
      return
    }
  }

  private async uploadCloudinary(
    account: CloudinaryAccount,
    reportId: string,
    buffer: Buffer,
    sniffed: { mime: string; ext: string },
  ) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const publicId = `damage/${reportId}/${randomUUID()}`
    const params = { public_id: publicId, timestamp }
    const body = new FormData()
    body.append('file', new Blob([new Uint8Array(buffer)], { type: sniffed.mime }), `image.${sniffed.ext}`)
    body.append('api_key', account.apiKey)
    body.append('timestamp', timestamp)
    body.append('signature', signCloudinary(params, account.apiSecret))
    body.append('public_id', publicId)
    const response = await fetch(`https://api.cloudinary.com/v1_1/${account.cloudName}/image/upload`, {
      method: 'POST',
      body,
    })
    const payload = (await response.json()) as { secure_url?: string; error?: { message?: string } }
    if (!response.ok || !payload.secure_url) {
      this.logger.error(payload.error?.message ?? 'cloudinary upload failed')
      throw new BadRequestException('تعذر رفع الصورة إلى Cloudinary')
    }
    return payload.secure_url
  }

  private async destroyCloudinary(account: CloudinaryAccount, publicId: string) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const params = { public_id: publicId, timestamp }
    const body = new FormData()
    body.append('public_id', publicId)
    body.append('api_key', account.apiKey)
    body.append('timestamp', timestamp)
    body.append('signature', signCloudinary(params, account.apiSecret))
    const response = await fetch(`https://api.cloudinary.com/v1_1/${account.cloudName}/image/destroy`, {
      method: 'POST',
      body,
    })
    if (!response.ok) this.logger.warn(`تعذر حذف الصورة من Cloudinary: ${publicId}`)
  }
}
