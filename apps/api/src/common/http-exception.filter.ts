import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { MulterError } from 'multer'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>()
    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'حجم الصورة يتجاوز 8 ميغابايت'
          : exception.code === 'LIMIT_FILE_COUNT'
            ? 'الحد عشر صور لكل بلاغ'
            : 'تعذر استلام الملفات'
      response.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message })
      return
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' && payload && 'message' in payload
            ? (payload as { message: string | string[] }).message
            : exception.message
      response.status(status).json({ statusCode: status, message })
      return
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'حدث خطأ غير متوقع',
    })
  }
}
