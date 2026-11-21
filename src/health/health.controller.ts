import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { RawResponse } from '../common/response/raw-response.decorator.js';

export interface HealthResponse {
  status: 'ok';
  /** 배포된 커밋 sha. 이미지 빌드 때 GIT_SHA로 주입되며, 없으면 'unknown'. */
  commit: string;
}

/**
 * 클러스터 readiness/liveness probe와 외부 헬스체크가 부르는 엔드포인트.
 * 전역 접두사 'api'가 붙어 GET /api/health 가 된다.
 * probe와 약속한 응답 모양 { status, commit }을 지키려고 공통 응답 형식으로 감싸지 않는다.
 */
@RawResponse()
// 클러스터 probe가 주기적으로 부르므로 요청 횟수 제한에서 뺀다 (#67)
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: '서버 상태 확인',
    description:
      '서버가 떠 있는지와 배포된 커밋을 돌려준다. 공통 응답 형식으로 감싸지 않는다.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        commit: '6bf4bc427b0f97e320051ea9a11d7172ce48f661',
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      commit: this.config.get<string>('GIT_SHA') || 'unknown',
    };
  }
}
