import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { ApiResponseBody, successBody } from './api-response.js';
import { RAW_RESPONSE_KEY } from './raw-response.decorator.js';

// @Sse() 핸들러에 Nest가 붙이는 메타데이터 키. SSE 이벤트는 감싸지 않는다.
const SSE_METADATA_KEY = '__sse__';

/**
 * 컨트롤러 반환값을 공통 응답 형식 { success, code, message, data }로 감싼다.
 * 상태 코드는 Nest 기본값을 따른다 (@Post 201, 그 외 200).
 * 예외 응답은 GlobalExceptionFilter가 만든다.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseBody<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseBody<T> | T> {
    if (context.getType() !== 'http' || this.shouldSkip(context)) {
      return next.handle();
    }
    return next.handle().pipe(map((data) => successBody(data)));
  }

  private shouldSkip(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const raw = this.reflector.getAllAndOverride<boolean>(
      RAW_RESPONSE_KEY,
      targets,
    );
    const sse = this.reflector.get<boolean>(
      SSE_METADATA_KEY,
      context.getHandler(),
    );
    return Boolean(raw || sse);
  }
}
