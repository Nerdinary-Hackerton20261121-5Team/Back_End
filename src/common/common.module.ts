import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionFilter } from './exception/global-exception.filter.js';
import { ResponseInterceptor } from './response/response.interceptor.js';

/**
 * 전역 요청 검증·응답 형식·예외 처리를 등록한다.
 * main.ts가 아니라 모듈 provider로 등록해서, 테스트 앱(Test.createTestingModule)도 같은 동작을 한다.
 */
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // DTO에 없는 필드는
        forbidNonWhitelisted: true, // 400으로 거절
        transform: true, // 경로·쿼리 값을 DTO 타입으로 변환
      }),
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class CommonModule {}
