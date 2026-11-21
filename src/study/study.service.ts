import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { heartbeatPolicy } from '../config/policy.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import { PIECE_PAD_RATIO, pieceEdges } from '../puzzle/piece-shape.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import {
  Session,
  type SessionStatus,
} from '../sessions/entities/session.entity.js';
import { SessionErrors } from '../sessions/sessions.errors.js';
import type {
  BoardResponseDto,
  HeartbeatResponseDto,
} from './dto/study-response.dto.js';
import { PresenceService } from './presence.service.js';
import {
  elapsedSeconds,
  remainingSeconds,
  restoration,
  sessionStatus,
  type SessionTimer,
} from './session-clock.js';

/**
 * 공부 중 연결 확인과 진행판 (F-005, F-009).
 * 단절 판정·고정은 PresenceService가 한다 (조회 시점 판정, 스케줄러 없음).
 */
@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
    @InjectRepository(SourcePiece)
    private readonly sourcePieces: Repository<SourcePiece>,
    private readonly presence: PresenceService,
  ) {}

  async heartbeat(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<HeartbeatResponseDto> {
    const session = await this.findSession(sessionId);
    const participant = await this.participants.findOneByOrFail({
      id: me.participantId,
    });
    const now = new Date();
    const timer = this.timer(session);
    const status = this.status(session, now);
    const { intervalSeconds } = heartbeatPolicy();

    let disconnectedAt = participant.disconnectedAt;
    if (status === 'FOCUSING' && !disconnectedAt) {
      // 너무 늦게 온 heartbeat면 이미 끊긴 것으로 보고 마지막 확인 시각으로 고정한다 (AC-016).
      // 연결 중이면 확인 시각을 갱신하되, 그사이 다른 요청이 고정했으면 그 값을 따른다 (#52)
      disconnectedAt =
        (await this.presence.settle(participant, timer, now)) ??
        (await this.presence.touch(participant.id, now));
    }

    return {
      status,
      disconnected: disconnectedAt !== null,
      myRestoration: restoration(timer, disconnectedAt, now),
      remainingSeconds: remainingSeconds(timer, now),
      heartbeatIntervalSeconds: intervalSeconds,
      serverNow: now,
    };
  }

  async board(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<BoardResponseDto> {
    const session = await this.findSession(sessionId);
    const now = new Date();
    const timer = this.timer(session);
    const status = this.status(session, now);

    const [participants, sources] = await Promise.all([
      this.participants.find({ where: { sessionId } }),
      this.sourcePieces.find({ where: { sessionId } }),
    ]);

    // 조회 시점에 끊긴 참가자를 판정해 고정한다
    const disconnectedAtById = new Map<number, Date | null>();
    for (const p of participants) {
      disconnectedAtById.set(
        p.id,
        status === 'WAITING'
          ? p.disconnectedAt
          : await this.presence.settle(p, timer, now),
      );
    }

    const revealAll = status === 'ASSEMBLING' || status === 'COMPLETED';

    const pieces = sources
      .sort((a, b) => a.position - b.position)
      .map((source) => {
        const isMine = source.participantId === me.participantId;
        return {
          position: source.position,
          edges: pieceEdges(
            sessionId,
            source.position,
            session.gridRows ?? 0,
            session.gridCols ?? 0,
          ),
          imagePath: session.imageId
            ? `/api/sessions/${sessionId}/pieces/${source.position}/image`
            : null,
          displaySlot: source.displaySlot,
          // 조각 격자는 모든 칸이 한 칸 크기다 (참가자당 한 행)
          colSpan: 1,
          isMine,
          // 집중 중 남의 조각은 블러로 보이도록 값을 내려주지 않는다 (실제 값은 서버가 계산 가능)
          restoration:
            isMine || revealAll
              ? restoration(
                  timer,
                  disconnectedAtById.get(source.participantId) ?? null,
                  now,
                )
              : null,
        };
      });

    return {
      status,
      goalSeconds: session.goalSeconds,
      elapsedSeconds: elapsedSeconds(timer, now),
      remainingSeconds: remainingSeconds(timer, now),
      gridRows: session.gridRows ?? 0,
      gridCols: session.gridCols ?? 0,
      hasImage: session.imageId !== null,
      padRatio: PIECE_PAD_RATIO,
      myDisconnected:
        (disconnectedAtById.get(me.participantId) ?? null) !== null,
      pieces,
      serverNow: now,
    };
  }

  private async findSession(sessionId: number): Promise<Session> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    return session;
  }

  private timer(session: Session): SessionTimer {
    return {
      startedAt: session.startedAt,
      goalSeconds: session.goalSeconds,
      endsAt: session.endsAt,
    };
  }

  private status(session: Session, now: Date): SessionStatus {
    return sessionStatus(session, now);
  }
}
