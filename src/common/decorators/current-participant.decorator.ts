import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 인증을 통과한 요청의 참가자 정보.
 * auth 모듈의 가드가 토큰(익명 토큰 또는 로그인, #9)을 확인한 뒤 `request.participant`에 넣는다.
 * 필드가 더 필요하면 auth 담당과 맞춰 여기에 추가한다.
 */
export interface RequestParticipant {
  participantId: number;
  sessionId: number;
}

export function participantFromContext(
  context: ExecutionContext,
): RequestParticipant {
  const request = context
    .switchToHttp()
    .getRequest<{ participant?: RequestParticipant }>();
  if (!request.participant) {
    // 가드가 빠진 경로에서 쓰면 500 대신 401로 막는다
    throw new UnauthorizedException('참가자 인증이 필요합니다.');
  }
  return request.participant;
}

/**
 * 지금 요청한 참가자를 핸들러 인자로 받는다.
 *   @Get(':id') findOne(@CurrentParticipant() me: RequestParticipant) { ... }
 * auth 방식(#9)이 바뀌어도 이 데코레이터를 쓰는 모듈은 고칠 필요가 없다.
 */
export const CurrentParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    participantFromContext(context),
);
