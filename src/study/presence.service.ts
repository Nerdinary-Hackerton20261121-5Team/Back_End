import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { heartbeatPolicy } from '../config/policy.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import {
  clampFocusMs,
  focusSnapshot,
  pendingFocusMs,
  roundRestoration,
  type FocusRecord,
  type FocusSnapshot,
  type PresenceState,
} from './focus-time.js';
import type { SessionTimer } from './session-clock.js';

/** 같은 참가자의 heartbeat가 겹쳤을 때 다시 시도하는 횟수 */
const HEARTBEAT_RETRIES = 3;

/**
 * 참가자 상태·집중 시간 누적·복원도를 한곳에서 한다 (F-005, F-009, AC-040, #76).
 * heartbeat·진행판·결과·조각 이미지·조립 열기가 모두 이 서비스를 쓰므로 어디서 조회해도 같은 값이 나온다.
 * 저장은 heartbeat(report)와 조립 열기(finalize)만 한다. 조회는 계산만 하고 쓰지 않는다.
 */
@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(Participant)
    private readonly participants: Repository<Participant>,
  ) {}

  /** 지금 시각 기준 상태·누적 집중 시간·복원도 (저장하지 않음) */
  snapshot(p: FocusRecord, timer: SessionTimer, now: Date): FocusSnapshot {
    return focusSnapshot(
      timer,
      p,
      now,
      heartbeatPolicy().disconnectTimeoutSeconds,
    );
  }

  /** 복원도 0~1 = 누적 집중 시간 / 목표 시간. 조립을 열 때 확정한 값이 있으면 그 값 */
  restorationOf(p: FocusRecord, timer: SessionTimer, now: Date): number {
    return this.snapshot(p, timer, now).restoration;
  }

  /**
   * heartbeat 기록. 직전 상태가 FOCUSING이었던 구간을 누적하고 이번 상태를 저장한다.
   * 읽은 마지막 확인 시각이 그대로일 때만 쓰므로 겹친 요청이 같은 구간을 두 번 더하지 않는다 (#52).
   * 반환값은 반영 후 참가자 행.
   */
  async report(
    participant: Participant,
    presence: PresenceState,
    timer: SessionTimer,
    now: Date,
    repo: Repository<Participant> = this.participants,
  ): Promise<Participant> {
    const { disconnectTimeoutSeconds } = heartbeatPolicy();
    let row = participant;
    for (let attempt = 0; attempt < HEARTBEAT_RETRIES; attempt++) {
      const focusedMs = clampFocusMs(
        timer,
        row.focusedMs +
          pendingFocusMs(timer, row, now, disconnectTimeoutSeconds),
      );
      const result = await repo.update(
        { id: row.id, lastHeartbeatAt: row.lastHeartbeatAt ?? IsNull() },
        { focusedMs, presence, lastHeartbeatAt: now },
      );
      if (result.affected) {
        return Object.assign(row, {
          focusedMs,
          presence,
          lastHeartbeatAt: now,
        });
      }
      row = await repo.findOneByOrFail({ id: row.id });
      // 더 늦은 heartbeat가 이미 반영됐으면 그 값을 따른다
      if (
        row.lastHeartbeatAt &&
        row.lastHeartbeatAt.getTime() >= now.getTime()
      ) {
        return row;
      }
    }
    return row;
  }

  /**
   * 조립을 열 때 저장할 최종값. 종료 시각 기준으로 마지막 heartbeat 이후 구간까지 더해 확정한다.
   * 종료 때 끊겨 있던 사람은 disconnectedAt(마지막 확인 시각)을 남긴다 (부재자 조각 자동 배치에 씀).
   */
  finalize(
    p: Participant,
    timer: SessionTimer,
    now: Date,
  ): Pick<Participant, 'disconnectedAt' | 'focusedMs' | 'finalRestoration'> {
    const snap = this.snapshot(
      {
        focusedMs: p.focusedMs,
        presence: p.presence,
        lastHeartbeatAt: p.lastHeartbeatAt,
        disconnectedAt: p.disconnectedAt,
        finalRestoration: null,
      },
      timer,
      now,
    );
    return {
      disconnectedAt: snap.state === 'DISCONNECTED' ? p.lastHeartbeatAt : null,
      focusedMs: Math.round(snap.focusedMs),
      finalRestoration: roundRestoration(snap.restoration),
    };
  }
}
