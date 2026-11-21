import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { heartbeatPolicy } from '../config/policy.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
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
import {
  elapsedSeconds,
  nextFrozenAt,
  remainingSeconds,
  restoration,
  sessionPhase,
  type SessionTimer,
} from './session-clock.js';

/**
 * 공부 중 연결 확인과 진행판 (F-005, F-009).
 * 단절은 스케줄러 없이 heartbeat·진행판 조회 시점에 판정한다.
 */
@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
    @InjectRepository(SourcePiece)
    private readonly sourcePieces: Repository<SourcePiece>,
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
    const { intervalSeconds, disconnectTimeoutSeconds } = heartbeatPolicy();

    let disconnectedAt = participant.disconnectedAt;
    if (status === 'FOCUSING' && !disconnectedAt) {
      const frozenAt = participant.lastHeartbeatAt
        ? nextFrozenAt(
            timer,
            {
              lastHeartbeatAt: participant.lastHeartbeatAt,
              frozenAt: null,
            },
            now,
            disconnectTimeoutSeconds,
          )
        : null;
      if (frozenAt) {
        // 너무 늦게 온 heartbeat: 이미 끊긴 것으로 보고 마지막 확인 시각으로 고정 (AC-016)
        disconnectedAt = await this.freeze(participant.id, frozenAt);
      } else {
        // 고정되지 않은 참가자만 갱신한다. 고정값은 덮어쓰지 않는다 (AC-015, AC-019)
        const result = await this.participants.update(
          { id: participant.id, disconnectedAt: IsNull() },
          { lastHeartbeatAt: now },
        );
        // 그사이 다른 요청이 고정했으면 고정된 값 기준으로 응답한다 (#52)
        if (!result.affected) {
          disconnectedAt = await this.currentDisconnectedAt(participant.id);
        }
      }
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
    const { disconnectTimeoutSeconds } = heartbeatPolicy();
    const disconnectedAtById = new Map<number, Date | null>();
    for (const p of participants) {
      let disconnectedAt = p.disconnectedAt;
      if (status !== 'WAITING' && !disconnectedAt && p.lastHeartbeatAt) {
        const frozenAt = nextFrozenAt(
          timer,
          { lastHeartbeatAt: p.lastHeartbeatAt, frozenAt: null },
          now,
          disconnectTimeoutSeconds,
        );
        if (frozenAt) disconnectedAt = await this.freeze(p.id, frozenAt);
      }
      disconnectedAtById.set(p.id, disconnectedAt);
    }

    const revealAll = status === 'ASSEMBLING' || status === 'COMPLETED';

    const pieces = sources
      .sort((a, b) => a.position - b.position)
      .map((source) => {
        const isMine = source.participantId === me.participantId;
        return {
          position: source.position,
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
      myDisconnected:
        (disconnectedAtById.get(me.participantId) ?? null) !== null,
      pieces,
      serverNow: now,
    };
  }

  /**
   * 끊김 고정. 고정 시각은 판정에 쓴 마지막 연결 확인 시각(frozenAt)이다.
   * 아직 고정되지 않았고, 마지막 연결 확인 시각이 판정 때 읽은 값 그대로일 때만 기록한다.
   * 그사이 heartbeat가 들어와 시각이 바뀌었으면 고정하지 않는다 (#52, AC-015·AC-016).
   * 반환값은 실제 저장된 고정 시각(이미 고정돼 있었으면 그 값), 고정되지 않았으면 null.
   */
  private async freeze(
    participantId: number,
    frozenAt: Date,
  ): Promise<Date | null> {
    const result = await this.participants.update(
      {
        id: participantId,
        disconnectedAt: IsNull(),
        lastHeartbeatAt: frozenAt,
      },
      { disconnectedAt: frozenAt },
    );
    if (result.affected) return frozenAt;
    return this.currentDisconnectedAt(participantId);
  }

  private async currentDisconnectedAt(
    participantId: number,
  ): Promise<Date | null> {
    const current = await this.participants.findOneByOrFail({
      id: participantId,
    });
    return current.disconnectedAt;
  }

  private async findSession(sessionId: number): Promise<Session> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    return session;
  }

  private timer(session: Session): SessionTimer {
    return { startedAt: session.startedAt, goalSeconds: session.goalSeconds };
  }

  private status(session: Session, now: Date): SessionStatus {
    return session.status === 'COMPLETED'
      ? 'COMPLETED'
      : sessionPhase(this.timer(session), now);
  }
}
