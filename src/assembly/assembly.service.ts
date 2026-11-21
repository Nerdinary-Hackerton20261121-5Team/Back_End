import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not } from 'typeorm';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { CommonErrors } from '../common/exception/error-code.js';
import { heartbeatPolicy } from '../config/policy.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import {
  buildPuzzleLayout,
  type AssemblyPieceLayout,
} from '../puzzle/puzzle-splitter.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { SessionErrors } from '../sessions/sessions.errors.js';
import { nextFrozenAt, restoration } from '../study/session-clock.js';
import { AssemblyErrors } from './assembly.errors.js';
import type {
  AssemblyBoardResponseDto,
  AssemblySlotDto,
  PlacePieceResponseDto,
} from './dto/assembly.dto.js';
import { AssemblyPiece } from './entities/assembly-piece.entity.js';

/** 원조각 하나를 2×2로 나누므로 조립판은 4열, 행은 원조각 행의 2배 */
const BOARD_COLS = 4;

/**
 * 공동 조립 (F-006).
 * - 집중 종료 후 첫 조립 요청에서 한 번만: ASSEMBLING 전환, 최종 복원도 확정, 부재자 조각 자동 배치
 * - 조각 놓기: 자기 원조각에서 나온 조각만, 정답 칸이면 저장, 아니면 저장하지 않음(직전 위치로 복귀)
 * - 모든 조각이 정답 칸이면 COMPLETED (팀 통과). 복원도는 판정에 쓰지 않는다
 */
@Injectable()
export class AssemblyService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async board(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<AssemblyBoardResponseDto> {
    const now = new Date();
    await this.openAssembly(sessionId, now);

    const manager = this.dataSource.manager;
    const session = await this.findSession(manager, sessionId);
    this.assertOpen(session);

    const [sources, pieces, participants] = await Promise.all([
      manager.find(SourcePiece, { where: { sessionId } }),
      manager.find(AssemblyPiece, {
        where: { sessionId },
        order: { id: 'ASC' },
      }),
      manager.find(Participant, { where: { sessionId } }),
    ]);
    const boardRows = (session.gridRows ?? 0) * 2;
    // 시작 API가 조립 조각을 더 만들지 않으므로 조각이 없는 판이면 칸도 비운다
    const slotOf = pieces.length
      ? this.slotGeometry(buildPuzzleLayout(sources.length).pieces, boardRows)
      : new Map<number, AssemblySlotDto>();
    const ownerOf = new Map(sources.map((s) => [s.id, s.participantId]));
    const finalOf = new Map(
      participants.map((p) => [p.id, p.finalRestoration ?? 0]),
    );

    const placedCount = pieces.filter((p) => p.placedAt).length;
    return {
      status: session.status,
      boardRows,
      boardCols: BOARD_COLS,
      totalPieces: pieces.length,
      placedCount,
      completed: session.status === 'COMPLETED',
      slots: [...slotOf.values()],
      pieces: pieces.map((piece) => {
        const owner = ownerOf.get(piece.sourcePieceId);
        return {
          pieceId: piece.id,
          isMine: owner === me.participantId,
          colSpan: slotOf.get(piece.position)?.colSpan ?? 1,
          restoration: owner === undefined ? 0 : (finalOf.get(owner) ?? 0),
          placed: piece.placedAt !== null,
          // 정답 위치는 놓이기 전까지 알려주지 않는다
          position: piece.placedAt ? piece.position : null,
          autoPlaced: piece.autoPlaced,
        };
      }),
      serverNow: now,
    };
  }

  async place(
    sessionId: number,
    pieceId: number,
    targetPosition: number,
    me: RequestParticipant,
  ): Promise<PlacePieceResponseDto> {
    const now = new Date();
    await this.openAssembly(sessionId, now);

    return this.dataSource.transaction(async (manager) => {
      // 조각 이동·팀 통과 판정을 세션 단위로 한 줄로 세운다
      const session = await this.findSession(manager, sessionId, true);
      this.assertOpen(session);

      const piece = await manager.findOne(AssemblyPiece, {
        where: { id: pieceId, sessionId },
      });
      if (!piece) throw new BusinessException(AssemblyErrors.PIECE_NOT_FOUND);
      const source = await manager.findOneByOrFail(SourcePiece, {
        id: piece.sourcePieceId,
      });
      if (source.participantId !== me.participantId) {
        throw new BusinessException(AssemblyErrors.NOT_PIECE_OWNER);
      }

      const totalPieces = await manager.count(AssemblyPiece, {
        where: { sessionId },
      });
      if (targetPosition > totalPieces) {
        throw new BusinessException(
          CommonErrors.INVALID_INPUT,
          `targetPosition은 1~${totalPieces} 사이여야 합니다.`,
        );
      }

      let correct = targetPosition === piece.position;
      let reason: PlacePieceResponseDto['reason'] = null;
      let placed = piece.placedAt !== null;

      if (correct && !placed) {
        await manager.update(
          AssemblyPiece,
          { id: piece.id, placedAt: IsNull() },
          { placedAt: now },
        );
        placed = true;
      } else if (!correct) {
        // 틀린 칸·이미 찬 칸은 저장하지 않는다 (클라이언트가 직전 위치로 되돌림)
        const occupied = await manager.exists(AssemblyPiece, {
          where: {
            sessionId,
            position: targetPosition,
            placedAt: Not(IsNull()),
          },
        });
        reason = occupied ? 'OCCUPIED' : 'WRONG_POSITION';
        correct = false;
      }

      const placedCount = await manager.count(AssemblyPiece, {
        where: { sessionId, placedAt: Not(IsNull()) },
      });
      let completed = session.status === 'COMPLETED';
      if (!completed && placedCount === totalPieces) {
        await manager.update(
          Session,
          { id: sessionId },
          { status: 'COMPLETED', completedAt: now },
        );
        completed = true;
      }

      return {
        pieceId: piece.id,
        correct,
        reason,
        placed,
        placedCount,
        totalPieces,
        completed,
      };
    });
  }

  /**
   * 집중 시간이 끝났으면 조립을 연다. 세션 행을 잠그고 상태가 FOCUSING일 때만 하므로 한 번만 실행된다.
   * - 최종 단절 판정 후 참가자별 최종 복원도 저장 (AC-040: 모든 기기 같은 값)
   * - 집중 종료 시 접속해 있지 않은 사람의 조각은 정답 칸에 자동 배치 (AC-053, AC-054)
   */
  private async openAssembly(sessionId: number, now: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const session = await this.findSession(manager, sessionId, true);
      if (
        session.status !== 'FOCUSING' ||
        !session.startedAt ||
        !session.endsAt ||
        now < session.endsAt
      ) {
        return;
      }

      const timer = {
        startedAt: session.startedAt,
        goalSeconds: session.goalSeconds,
      };
      const { disconnectTimeoutSeconds } = heartbeatPolicy();
      const participants = await manager.find(Participant, {
        where: { sessionId },
      });

      const absent: number[] = [];
      for (const p of participants) {
        const disconnectedAt =
          p.disconnectedAt ??
          (p.lastHeartbeatAt
            ? nextFrozenAt(
                timer,
                { lastHeartbeatAt: p.lastHeartbeatAt, frozenAt: null },
                now,
                disconnectTimeoutSeconds,
              )
            : null);
        const finalRestoration =
          Math.round(restoration(timer, disconnectedAt, now) * 10_000) / 10_000;
        await manager.update(
          Participant,
          { id: p.id },
          { disconnectedAt, finalRestoration },
        );
        if (disconnectedAt) absent.push(p.id);
      }

      if (absent.length) {
        const sources = await manager.find(SourcePiece, {
          where: { sessionId, participantId: In(absent) },
          select: { id: true },
        });
        if (sources.length) {
          await manager.update(
            AssemblyPiece,
            {
              sessionId,
              sourcePieceId: In(sources.map((s) => s.id)),
              placedAt: IsNull(),
            },
            { placedAt: now, autoPlaced: true },
          );
        }
      }

      const remaining = await manager.count(AssemblyPiece, {
        where: { sessionId, placedAt: IsNull() },
      });
      await manager.update(
        Session,
        { id: sessionId },
        remaining
          ? { status: 'ASSEMBLING', assemblyStartedAt: now }
          : {
              status: 'COMPLETED',
              assemblyStartedAt: now,
              completedAt: now,
            },
      );
    });
  }

  /** 조립판 칸 위치. 정규화 좌표를 4열 × (원조각 행 × 2) 격자로 바꾼다 */
  private slotGeometry(
    pieces: AssemblyPieceLayout[],
    boardRows: number,
  ): Map<number, AssemblySlotDto> {
    return new Map(
      pieces.map((p) => [
        p.position,
        {
          position: p.position,
          row: Math.round(p.rect.y * boardRows),
          col: Math.round(p.rect.x * BOARD_COLS),
          colSpan: Math.round(p.rect.w * BOARD_COLS),
        },
      ]),
    );
  }

  private async findSession(
    manager: EntityManager,
    sessionId: number,
    lock = false,
  ): Promise<Session> {
    const session = await manager.findOne(Session, {
      where: { id: sessionId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!session) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    return session;
  }

  private assertOpen(session: Session): void {
    if (session.status !== 'ASSEMBLING' && session.status !== 'COMPLETED') {
      throw new BusinessException(AssemblyErrors.ASSEMBLY_NOT_OPEN);
    }
  }
}
