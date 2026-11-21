import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { PARTICIPANT_TOKEN_SECURITY } from '../common/http-headers.js';
import { ApiErrorResponses } from '../common/swagger/api-response.decorators.js';
import { AuthErrors } from './auth.errors.js';
import { ParticipantGuard } from './participant.guard.js';

/**
 * 참가자 토큰이 필요한 API에 붙인다. 가드·Swagger Authorize·401/403 예시를 한 번에 단다.
 *   @Get(':sessionId')
 *   @ParticipantAuth()
 *   findOne(@CurrentParticipant() me: RequestParticipant) { ... }
 * 쓰는 모듈은 AuthModule을 import한다.
 */
export function ParticipantAuth() {
  return applyDecorators(
    UseGuards(ParticipantGuard),
    ApiSecurity(PARTICIPANT_TOKEN_SECURITY),
    ApiErrorResponses(
      AuthErrors.TOKEN_REQUIRED,
      AuthErrors.TOKEN_INVALID,
      AuthErrors.NOT_SESSION_PARTICIPANT,
    ),
  );
}
