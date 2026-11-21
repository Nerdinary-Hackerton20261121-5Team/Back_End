import { HttpException } from '@nestjs/common';
import type { ErrorDefinition } from './error-code.js';

/**
 * 서비스에서 규칙 위반을 알릴 때 던지는 예외.
 *   throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
 *   throw new BusinessException(CommonErrors.INVALID_INPUT, '목표 시간은 0보다 커야 합니다.');
 * GlobalExceptionFilter가 { success: false, code, message, data: null }로 바꾼다.
 */
export class BusinessException extends HttpException {
  readonly error: ErrorDefinition;

  constructor(error: ErrorDefinition, message?: string) {
    const resolved = { ...error, message: message ?? error.message };
    super({ code: resolved.code, message: resolved.message }, resolved.status);
    this.error = resolved;
  }
}
