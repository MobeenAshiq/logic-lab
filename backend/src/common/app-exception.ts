import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, t } from './i18n/en';

/** Error with a stable `code` the frontend can switch on, plus a readable message. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: ErrorCode,
    extra: Record<string, unknown> = {},
  ) {
    super(
      { statusCode: status, code, message: t.errors[code], ...extra },
      status,
    );
  }
}
