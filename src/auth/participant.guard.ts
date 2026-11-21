import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { PARTICIPANT_TOKEN_HEADER } from '../common/http-headers.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import { AuthErrors } from './auth.errors.js';
import { hashParticipantToken } from './participant-token.js';

/** 경로에 이 이름의 파라미터가 있으면 토큰의 세션과 같은지 확인한다 (예: /sessions/:sessionId/...) */
export const SESSION_ID_PARAM = 'sessionId';

type AuthRequest = Request & { participant?: RequestParticipant };

/**
 * X-Participant-Token 헤더로 참가자를 확인한다 (POL-003, AC-006).
 * - 헤더 없음 → 401 TOKEN_REQUIRED
 * - 일치하는 참가자 없음(잘못된 토큰, 폐기된 세션) → 401 TOKEN_INVALID
 * - 경로의 :sessionId가 토큰의 세션과 다름 → 403 NOT_SESSION_PARTICIPANT
 * 통과하면 request.participant를 채운다 → @CurrentParticipant()로 받는다.
 */
@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers[PARTICIPANT_TOKEN_HEADER.toLowerCase()];
    const token = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!token) {
      throw new BusinessException(AuthErrors.TOKEN_REQUIRED);
    }

    const participant = await this.participants.findOne({
      where: { tokenHash: hashParticipantToken(token) },
      select: { id: true, sessionId: true, isCreator: true },
    });
    if (!participant) {
      throw new BusinessException(AuthErrors.TOKEN_INVALID);
    }

    const pathSessionId = request.params?.[SESSION_ID_PARAM];
    if (
      pathSessionId !== undefined &&
      Number(pathSessionId) !== participant.sessionId
    ) {
      throw new BusinessException(AuthErrors.NOT_SESSION_PARTICIPANT);
    }

    request.participant = {
      participantId: participant.id,
      sessionId: participant.sessionId,
      isCreator: participant.isCreator,
    };
    return true;
  }
}
