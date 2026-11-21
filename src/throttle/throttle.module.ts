import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { throttlePolicy } from '../config/policy.js';
import { ClientThrottlerGuard } from './client-throttler.guard.js';

/**
 * 전역 요청 횟수 제한 (#67). 값은 요청마다 설정값(throttlePolicy)을 읽는다.
 * 라우트별로 더 좁힐 때는 `@Throttle({ default: { limit, ttl } })`, 뺄 때는 `@SkipThrottle()`.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: () => throttlePolicy().windowSeconds * 1000,
          limit: () => throttlePolicy().defaultLimit,
        },
      ],
      skipIf: () => !throttlePolicy().enabled,
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientThrottlerGuard }],
})
export class ThrottleModule {}
