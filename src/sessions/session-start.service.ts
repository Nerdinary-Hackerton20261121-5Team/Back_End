import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { MIN_START_PARTICIPANTS } from '../config/policy.js';
import {
  PIECES_PER_PARTICIPANT,
  SourcePiece,
} from '../puzzle/entities/source-piece.entity.js';
import { buildPieceLayout, type PieceGrid } from '../puzzle/piece-layout.js';
import { endsAt } from '../study/session-clock.js';
import type { StartSessionResponseDto } from './dto/start-session-response.dto.js';
import { Participant } from './entities/participant.entity.js';
import { Session } from './entities/session.entity.js';
import { SessionErrors } from './sessions.errors.js';

/**
 * 세션 시작 (F-002, F-003, F-008).
 * 세션 행을 잠근 채로 명단 고정 → 시작·종료 시각 확정 → 조각 생성을 한 트랜잭션에서 한다.
 * 조각은 참가자당 2개이고, 공부 중 배치 칸(display_slot)을 서로 겹치지 않게 랜덤으로 정한다.
 * 조립도 이 조각을 그대로 쓰므로(source_piece.placed_at) 따로 만드는 조각은 없다.
 * 입장(join)도 같은 행을 잠그므로, 시작과 입장이 동시에 와도 시작 시점 명단이 기준이 된다 (AC-005).
 */
@Injectable()
export class SessionStartService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async start(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<StartSessionResponseDto> {
    if (!me.isCreator) {
      throw new BusinessException(SessionErrors.NOT_CREATOR);
    }

    return this.dataSource.transaction(async (manager) => {
      const session = await manager.findOne(Session, {
        where: { id: sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) {
        throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
      }

      // AC-010 중복 시작: 처음 시작한 기준을 그대로 돌려준다
      if (session.status !== 'WAITING' && session.startedAt && session.endsAt) {
        const pieceCount = await manager.count(SourcePiece, {
          where: { sessionId },
        });
        return this.response(session, pieceCount, true);
      }

      // 명단 고정: 시작 시점에 입장해 있는 참가자, 입장 순서대로 격자의 행을 배정한다
      const roster = await manager.find(Participant, {
        where: { sessionId },
        order: { joinedAt: 'ASC', id: 'ASC' },
        select: { id: true },
      });
      if (roster.length < MIN_START_PARTICIPANTS) {
        throw new BusinessException(SessionErrors.NOT_ENOUGH_PARTICIPANTS);
      }

      const startedAt = new Date();
      const finishAt = endsAt({ startedAt, goalSeconds: session.goalSeconds });
      if (!finishAt) throw new Error('종료 시각을 계산하지 못했습니다.');
      const layout = buildPieceLayout(roster.length);

      const changes = {
        status: 'FOCUSING' as const,
        startedAt,
        endsAt: finishAt,
        gridRows: layout.gridRows,
        gridCols: layout.gridCols,
      };
      await manager.update(Session, { id: sessionId }, changes);
      // 단절 판정 기준점: 시작 시각을 마지막 연결 확인 시각으로 둔다
      await manager.update(
        Participant,
        { sessionId },
        { lastHeartbeatAt: startedAt },
      );
      await this.createPieces(manager, sessionId, roster, layout);

      Object.assign(session, changes);
      return this.response(session, layout.pieces.length, false);
    });
  }

  private async createPieces(
    manager: EntityManager,
    sessionId: number,
    roster: Pick<Participant, 'id'>[],
    layout: PieceGrid,
  ): Promise<void> {
    await manager.insert(
      SourcePiece,
      layout.pieces.map((piece) => ({
        sessionId,
        participantId: roster[piece.ownerIndex].id,
        position: piece.position,
        displaySlot: piece.displaySlot,
      })),
    );
  }

  private response(
    session: Pick<
      Session,
      | 'id'
      | 'status'
      | 'startedAt'
      | 'endsAt'
      | 'goalSeconds'
      | 'splitCount'
      | 'gridRows'
      | 'gridCols'
    >,
    pieceCount: number,
    alreadyStarted: boolean,
  ): StartSessionResponseDto {
    return {
      sessionId: session.id,
      status: session.status,
      startedAt: session.startedAt!,
      endsAt: session.endsAt!,
      goalSeconds: session.goalSeconds,
      participantCount: pieceCount / PIECES_PER_PARTICIPANT,
      gridRows: session.gridRows ?? 0,
      gridCols: session.gridCols ?? 0,
      splitCount: session.splitCount,
      pieceCount,
      assemblyPieceCount: 0,
      alreadyStarted,
      serverNow: new Date(),
    };
  }
}
