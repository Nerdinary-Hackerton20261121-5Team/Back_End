import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HealthResponse {
  status: 'ok';
  /** 배포된 커밋 sha. 이미지 빌드 때 GIT_SHA로 주입되며, 없으면 'unknown'. */
  commit: string;
}

/**
 * 클러스터 readiness/liveness probe와 외부 헬스체크가 부르는 엔드포인트.
 * 전역 접두사 'api'가 붙어 GET /api/health 가 된다.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      commit: this.config.get<string>('GIT_SHA') || 'unknown',
    };
  }
}
