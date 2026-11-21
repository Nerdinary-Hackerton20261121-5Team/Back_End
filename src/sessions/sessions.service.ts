import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { issueParticipantToken } from '../auth/participant-token.js';
import type { RequestParticipant } from '../common/decorators/current-participant.decorator.js';
import { BusinessException } from '../common/exception/business.exception.js';
import { CommonErrors } from '../common/exception/error-code.js';
import { goalSecondsRange, SPLIT_COUNT } from '../config/policy.js';
import {
  elapsedSeconds,
  remainingSeconds,
  sessionPhase,
} from '../study/session-clock.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type { JoinSessionDto } from './dto/join-session.dto.js';
import type {
  SessionDetailResponseDto,
  SessionEntryResponseDto,
} from './dto/session-response.dto.js';
import { Participant } from './entities/participant.entity.js';
import { Session, type SessionStatus } from './entities/session.entity.js';
import { generateInviteCode } from './invite-code.js';
import { SessionErrors } from './sessions.errors.js';

const CODE_RETRIES = 5;

/** MySQL UNIQUE 위반이면 위반한 키 이름이 들어 있는 메시지를, 아니면 null */
function duplicateKeyMessage(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driver = error.driverError as { code?: string; message?: string };
  return driver?.code === 'ER_DUP_ENTRY' ? (driver.message ?? '') : null;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
  ) {}

  /** 방 만들기 (F-001, F-007). 개설자도 참가자로 등록하고 토큰을 발급한다. */
  async create(dto: CreateSessionDto): Promise<SessionEntryResponseDto> {
    const { min, max } = goalSecondsRange();
    if (dto.goalSeconds < min || dto.goalSeconds > max) {
      throw new BusinessException(
        CommonErrors.INVALID_INPUT,
        `목표 시간은 ${min}~${max}초 사이여야 합니다.`,
      );
    }

    // AC-002 같은 생성 요청 재전송이면 방을 새로 만들지 않는다
    const existing = await this.sessions.findOne({
      where: { createRequestId: dto.clientRequestId },
    });
    if (existing) return this.restoreCreator(existing);

    for (let attempt = 0; attempt < CODE_RETRIES; attempt++) {
      try {
        return await this.dataSource.transaction((manager) =>
          this.insertSession(manager, dto),
        );
      } catch (error) {
        const duplicate = duplicateKeyMessage(error);
        if (duplicate?.includes('uk_session_create_request')) {
          // 같은 요청이 동시에 두 번 들어온 경우: 먼저 만든 방을 돌려준다
          const created = await this.sessions.findOneOrFail({
            where: { createRequestId: dto.clientRequestId },
          });
          return this.restoreCreator(created);
        }
        if (duplicate?.includes('uk_session_code')) continue; // 코드 충돌: 새 코드로 다시
        throw error;
      }
    }
    throw new Error('세션 코드를 만들지 못했습니다.');
  }

  /** 코드로 입장 (F-002, F-011). 세션 행을 잠가 시작·정원과의 경합을 막는다 (AC-005). */
  async join(dto: JoinSessionDto): Promise<SessionEntryResponseDto> {
    const found = await this.sessions.findOne({
      where: { sessionCode: dto.sessionCode },
      select: { id: true },
    });
    if (!found) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);

    return this.dataSource.transaction(async (manager) => {
      const session = await manager.findOne(Session, {
        where: { id: found.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session)
        throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);

      const again = await manager.findOne(Participant, {
        where: { sessionId: session.id, joinRequestId: dto.clientRequestId },
      });
      if (again) return this.reissueToken(manager, session, again);

      if (session.status !== 'WAITING') {
        throw new BusinessException(SessionErrors.SESSION_ALREADY_STARTED);
      }
      const count = await manager.count(Participant, {
        where: { sessionId: session.id },
      });
      if (
        session.maxParticipants !== null &&
        count >= session.maxParticipants
      ) {
        throw new BusinessException(SessionErrors.SESSION_FULL);
      }

      const { token, tokenHash } = issueParticipantToken();
      const participant = await manager.save(
        manager.create(Participant, {
          sessionId: session.id,
          tokenHash,
          joinRequestId: dto.clientRequestId,
          isCreator: false,
          joinedAt: new Date(),
        }),
      );
      return this.entry(session, participant, token, false);
    });
  }

  /** 세션 조회. 단계·남은 시간은 서버 시각으로 계산한다 (F-003, F-004). */
  async findOne(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<SessionDetailResponseDto> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    const participantCount = await this.participants.count({
      where: { sessionId },
    });

    const now = new Date();
    const timer = {
      startedAt: session.startedAt,
      goalSeconds: session.goalSeconds,
    };
    const status: SessionStatus =
      session.status === 'COMPLETED' ? 'COMPLETED' : sessionPhase(timer, now);

    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      status,
      goalSeconds: session.goalSeconds,
      maxParticipants: session.maxParticipants,
      participantCount,
      allowRandom: session.allowRandom,
      splitCount: session.splitCount,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      elapsedSeconds: elapsedSeconds(timer, now),
      remainingSeconds: remainingSeconds(timer, now),
      serverNow: now,
      me: { participantId: me.participantId, isCreator: me.isCreator },
    };
  }

  /**
   * 방 종료·폐기 (F-006, POL-010, AC-020). 개설자만.
   * 세션을 지우면 참가자·원조각·조립 조각이 ON DELETE CASCADE로 함께 지워지고,
   * 참가자 토큰도 사라져 이후 이 방의 요청은 401로 거절된다.
   * TODO(POL-010): 업로드 사진(images.image_key)의 저장소 객체 삭제는 storage 담당과 연결
   */
  async remove(
    sessionId: number,
    me: RequestParticipant,
  ): Promise<{ sessionId: number; deleted: true }> {
    if (!me.isCreator) {
      throw new BusinessException(SessionErrors.NOT_CREATOR);
    }
    const result = await this.sessions.delete({ id: sessionId });
    if (!result.affected) {
      throw new BusinessException(SessionErrors.SESSION_NOT_FOUND);
    }
    return { sessionId, deleted: true };
  }

  private async insertSession(
    manager: EntityManager,
    dto: CreateSessionDto,
  ): Promise<SessionEntryResponseDto> {
    const session = await manager.save(
      manager.create(Session, {
        sessionCode: generateInviteCode(),
        createRequestId: dto.clientRequestId,
        maxParticipants: dto.maxParticipants,
        goalSeconds: dto.goalSeconds,
        splitCount: SPLIT_COUNT,
        allowRandom: dto.allowRandom ?? false,
        status: 'WAITING',
      }),
    );
    const { token, tokenHash } = issueParticipantToken();
    const creator = await manager.save(
      manager.create(Participant, {
        sessionId: session.id,
        tokenHash,
        joinRequestId: dto.clientRequestId,
        isCreator: true,
        joinedAt: new Date(),
      }),
    );
    return this.entry(session, creator, token, false);
  }

  private async restoreCreator(
    session: Session,
  ): Promise<SessionEntryResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const creator = await manager.findOneOrFail(Participant, {
        where: { sessionId: session.id, isCreator: true },
      });
      return this.reissueToken(manager, session, creator);
    });
  }

  /**
   * 재전송이면 기존 참가자를 돌려준다. 평문 토큰은 저장하지 않으므로 새로 발급하고
   * 이전 토큰은 무효가 된다 (첫 응답을 받지 못해 다시 보낸 경우를 위한 동작).
   */
  private async reissueToken(
    manager: EntityManager,
    session: Session,
    participant: Participant,
  ): Promise<SessionEntryResponseDto> {
    const { token, tokenHash } = issueParticipantToken();
    await manager.update(Participant, { id: participant.id }, { tokenHash });
    return this.entry(session, participant, token, true);
  }

  private entry(
    session: Session,
    participant: Participant,
    token: string,
    restored: boolean,
  ): SessionEntryResponseDto {
    return {
      sessionId: session.id,
      sessionCode: session.sessionCode,
      participantId: participant.id,
      participantToken: token,
      isCreator: participant.isCreator,
      restored,
    };
  }
}
