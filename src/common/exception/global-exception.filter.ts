import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorBody } from '../response/api-response.js';
import { BusinessException } from './business.exception.js';
import { CommonErrors, type ErrorDefinition } from './error-code.js';

const ERROR_BY_STATUS = new Map<number, ErrorDefinition>(
  Object.values(CommonErrors).map((error) => [error.status, error]),
);

/**
 * 모든 예외를 공통 응답 형식 { success: false, code, message, data: null }으로 바꾼다.
 * - BusinessException: 정의된 code·status·message 그대로
 * - HttpException(ValidationPipe 400, ParseIntPipe 400, JSON 파싱 400, 없는 경로 404, 가드 401/403 등):
 *   상태 코드로 공통 코드를 찾는다. 400은 검증 실패 내용을 message에 덧붙인다.
 * - 그 밖의 예외: 500 INTERNAL_ERROR. 로그에만 남기고 내부 메시지는 응답에 넣지 않는다.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const error = this.resolve(exception);
    if (error.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : exception,
      );
    }
    response.status(error.status).json(errorBody(error.code, error.message));
  }

  private resolve(exception: unknown): ErrorDefinition {
    if (exception instanceof BusinessException) {
      return exception.error;
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    return CommonErrors.INTERNAL_ERROR;
  }

  private fromHttpException(exception: HttpException): ErrorDefinition {
    const status = exception.getStatus();
    const known = ERROR_BY_STATUS.get(status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { ...CommonErrors.INTERNAL_ERROR, status };
    }
    if (status === HttpStatus.BAD_REQUEST) {
      const details = this.details(exception);
      const base = CommonErrors.INVALID_INPUT;
      return details
        ? { ...base, message: `${base.message} (${details})` }
        : base;
    }
    if (known) {
      return known;
    }
    // 공통 코드에 없는 4xx (예: 410, 422)
    return { code: `HTTP_${status}`, status, message: exception.message };
  }

  /** ValidationPipe의 message 배열 등 400의 상세 사유를 한 줄로 만든다. */
  private details(exception: HttpException): string | undefined {
    const body = exception.getResponse();
    const message =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] }).message;
    const text = [message ?? []].flat().join(', ');
    return text && text !== 'Bad Request' ? text : undefined;
  }
}
