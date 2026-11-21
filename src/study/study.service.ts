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
  BoardMemberDto,
  BoardResponseDto,
  HeartbeatResponseDto,
  ResultResponseDto,
} from './dto/study-response.dto.js';
import type { FocusSnapshot, PresenceState } from './focus-time.js';
import { PresenceService } from './presence.service.js';
import {
  elapsedSeconds,
  remainingSeconds,
  sessionStatus,
  type SessionTimer,
} from './session-clock.js';
import { StudyErrors } from './study.errors.js';

const toSeconds = (ms: number) => Math.floor(ms / 1000);

/**
 * 공부 중 연결 확인과 진행판, 결과 (F-005, F-009).
 * 상태·누적·복원도는 PresenceService가 계산한다. 저장은 heartbeat만 하고 조회는 계산만 한다.
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
    presence: PresenceState = 'FOCUSING',
  ): Promise<HeartbeatResponseDto> {
    const session = await this.findSession(sessionId);
    const now = new Date();
    const timer = this.timer(session);
    const status = this.status(session, now);
    const { intervalSeconds } = heartbeatPolicy();

    let participant = await this.participants.findOneByOrFail({
      id: me.participantId,
    });
    // 공부 중에만 누적한다. 끝난 뒤 마지막 구간은 조회·조립 확정 때 계산에 들어간다
    if (status === 'FOCUSING') {
      participant = await this.presence.report(
        participant,
        presence,
        timer,
        now,
      );
    }
    const snap = this.presence.snapshot(participant, timer, now);
    return {
      status,
      state: snap.state,
      focusedSeconds: toSeconds(snap.focusedMs),
      disconnected: snap.state === 'DISCONNECTED',
      myRestoration: snap.restoration,
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
      this.participants.find({
        where: { sessionId },
        order: { joinedAt: 'ASC', id: 'ASC' },
      }),
      this.sourcePieces.find({ where: { sessionId } }),
    ]);
    const snaps = this.snapshots(timer, participants, now);
    const members: BoardMemberDto[] = participants.map((p) => {
      const snap = snaps.get(p.id)!;
      return {
        participantId: p.id,
        nickname: p.nickname,
        isMe: p.id === me.participantId,
        state: snap.state,
        focusedSeconds: toSeconds(snap.focusedMs),
        restoration: snap.restoration,
      };
    });

    const pieces = sources
      .sort((a, b) => a.position - b.position)
      .map((source) => ({
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
        isMine: source.participantId === me.participantId,
        // 진행 링은 모두 공개한다. 남의 조각 이미지는 복원도에 따라 블러 처리된다
        restoration: snaps.get(source.participantId)?.restoration ?? 0,
      }));

    return {
      status,
      goalSeconds: session.goalSeconds,
      elapsedSeconds: elapsedSeconds(timer, now),
      remainingSeconds: remainingSeconds(timer, now),
      gridRows: session.gridRows ?? 0,
      gridCols: session.gridCols ?? 0,
      hasImage: session.imageId !== null,
      padRatio: PIECE_PAD_RATIO,
      myDisconnected: snaps.get(me.participantId)?.state === 'DISCONNECTED',
      members,
      pieces,
      serverNow: now,
    };
  }

  /** 공부가 끝난 뒤 참가자별 집중 시간·최종 복원도 */
  async result(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<ResultResponseDto> {
    const session = await this.findSession(sessionId);
    const now = new Date();
    const timer = this.timer(session);
    const status = this.status(session, now);
    if (status === 'WAITING' || status === 'FOCUSING') {
      throw new BusinessException(StudyErrors.STUDY_NOT_FINISHED);
    }

    const participants = await this.participants.find({
      where: { sessionId },
      order: { joinedAt: 'ASC', id: 'ASC' },
    });
    const snaps = this.snapshots(timer, participants, now);
    const members = participants.map((p) => {
      const snap = snaps.get(p.id)!;
      const focusedSeconds = toSeconds(snap.focusedMs);
      return {
        participantId: p.id,
        nickname: p.nickname,
        isMe: p.id === me.participantId,
        isCreator: p.isCreator,
        focusedSeconds,
        unfocusedSeconds: Math.max(session.goalSeconds - focusedSeconds, 0),
        restoration: snap.restoration,
        absent: snap.state === 'DISCONNECTED',
      };
    });
    const averageRestoration = members.length
      ? members.reduce((sum, m) => sum + m.restoration, 0) / members.length
      : 0;

    return {
      status,
      goalSeconds: session.goalSeconds,
      completed: status === 'COMPLETED',
      averageRestoration,
      members,
      serverNow: now,
    };
  }

  private snapshots(
    timer: SessionTimer,
    participants: Participant[],
    now: Date,
  ): Map<number, FocusSnapshot> {
    return new Map(
      participants.map((p) => [p.id, this.presence.snapshot(p, timer, now)]),
    );
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
