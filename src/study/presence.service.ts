import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { heartbeatPolicy } from '../config/policy.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import {
  nextFrozenAt,
  restoration,
  type SessionTimer,
} from './session-clock.js';

type PresenceRow = Pick<
  Participant,
  'id' | 'lastHeartbeatAt' | 'disconnectedAt'
>;

/**
 * 연결 끊김 판정과 복원도 계산을 한곳에서 한다 (F-005, F-009, AC-015, AC-016, AC-040, #76).
 * heartbeat·진행판·조각 이미지·조립 열기가 모두 이 서비스를 쓰므로 어디서 조회해도 같은 값이 나온다.
 * 스케줄러 없이 조회 시점에 판정하고, 고정은 조건부 갱신이라 동시 요청에도 안전하다 (#52).
 * 트랜잭션 안에서 부를 때는 그 트랜잭션의 Participant 저장소를 repo로 넘긴다.
 */
@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
  ) {}

  /**
   * 끊김 시각. 이미 고정됐으면 그 값, 지금 끊긴 것으로 판정되면 마지막 연결 확인 시각으로 고정해 돌려준다.
   * 연결 중이면 null.
   */
  async settle(
    p: PresenceRow,
    timer: SessionTimer,
    now: Date,
    repo: Repository<Participant> = this.participants,
  ): Promise<Date | null> {
    if (p.disconnectedAt) return p.disconnectedAt;
    if (!p.lastHeartbeatAt) return null;
    const frozenAt = nextFrozenAt(
      timer,
      { lastHeartbeatAt: p.lastHeartbeatAt, frozenAt: null },
      now,
      heartbeatPolicy().disconnectTimeoutSeconds,
    );
    return frozenAt ? this.freeze(p.id, frozenAt, repo) : null;
  }

  /**
   * 연결 확인(heartbeat) 기록. 고정되지 않은 참가자만 갱신한다 (AC-015, AC-019: 고정값은 덮어쓰지 않음).
   * 그사이 다른 요청이 고정했으면 그 고정 시각을, 아니면 null을 돌려준다.
   */
  async touch(
    participantId: number,
    now: Date,
    repo: Repository<Participant> = this.participants,
  ): Promise<Date | null> {
    const result = await repo.update(
      { id: participantId, disconnectedAt: IsNull() },
      { lastHeartbeatAt: now },
    );
    return result.affected ? null : this.current(participantId, repo);
  }

  /** 복원도 0~1. 조립을 열 때 확정한 최종값이 있으면 그 값, 아니면 끊김을 판정해 지금 시각으로 계산한다. */
  async restorationOf(
    p: PresenceRow & Pick<Participant, 'finalRestoration'>,
    timer: SessionTimer,
    now: Date,
  ): Promise<number> {
    if (p.finalRestoration !== null) return p.finalRestoration;
    if (!timer.startedAt) return 0;
    return restoration(timer, await this.settle(p, timer, now), now);
  }

  /**
   * 끊김 고정. 아직 고정되지 않았고 마지막 연결 확인 시각이 판정 때 읽은 값 그대로일 때만 기록한다.
   * 그사이 heartbeat가 들어와 시각이 바뀌었으면 고정하지 않는다 (#52).
   */
  private async freeze(
    participantId: number,
    frozenAt: Date,
    repo: Repository<Participant>,
  ): Promise<Date | null> {
    const result = await repo.update(
      {
        id: participantId,
        disconnectedAt: IsNull(),
        lastHeartbeatAt: frozenAt,
      },
      { disconnectedAt: frozenAt },
    );
    return result.affected ? frozenAt : this.current(participantId, repo);
  }

  private async current(
    participantId: number,
    repo: Repository<Participant>,
  ): Promise<Date | null> {
    const row = await repo.findOneBy({ id: participantId });
    return row?.disconnectedAt ?? null;
  }
}
