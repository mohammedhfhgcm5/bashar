import { createHash } from 'crypto'

export type CloudinaryAccount = {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export function parseCloudinaryUrl(value: string): CloudinaryAccount | null {
  if (!value.startsWith('cloudinary://')) return null
  let url: URL
  try {
    url = new URL(value.replace(/^cloudinary:/, 'https:'))
  } catch {
    return null
  }
  const cloudName = url.hostname
  const apiKey = decodeURIComponent(url.username)
  const apiSecret = decodeURIComponent(url.password)
  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName, apiKey, apiSecret }
}

export function signCloudinary(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex')
}

export function publicIdFromDeliveryUrl(deliveryUrl: string) {
  const match = deliveryUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/)
  return match?.[1] ?? null
}
