import { BadRequestException } from '@nestjs/common'
import type { ZodTypeAny, output } from 'zod'

export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('، ')
    throw new BadRequestException(message || 'البيانات غير صالحة')
  }
  return result.data
}
