import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Participant } from '../sessions/entities/participant.entity.js';
import { PresenceService } from './presence.service.js';
import {
  elapsedSeconds,
  remainingSeconds,
  restoration,
  sessionStatus,
} from './session-clock.js';

// #76 끊김 판정·복원도·단계 계산을 한곳에서 (F-005, F-009, AC-040)
const START = new Date('2026-11-22T03:00:00.000Z');
const sec = (s: number) => new Date(START.getTime() + s * 1000);
const timer = { startedAt: START, goalSeconds: 600 };

type Row = Pick<
  Participant,
  'id' | 'lastHeartbeatAt' | 'disconnectedAt' | 'finalRestoration'
>;

function repoOf(row: Row) {
  return {
    update: vi.fn(async (where: Record<string, unknown>, set: Partial<Row>) => {
      const sameHeartbeat =
        !('lastHeartbeatAt' in where) ||
        (where.lastHeartbeatAt as Date).getTime() ===
          row.lastHeartbeatAt?.getTime();
      if (row.disconnectedAt === null && sameHeartbeat) {
        Object.assign(row, set);
        return { affected: 1 };
      }
      return { affected: 0 };
    }),
    findOneBy: vi.fn(async () => ({ ...row })),
  } as unknown as Repository<Participant>;
}

describe('PresenceService (#76)', () => {
  it('조각 이미지도 진행판처럼 끊김을 판정해 고정하고, 고정된 시각까지만 복원도를 센다', async () => {
    const row: Row = {
      id: 1,
      lastHeartbeatAt: sec(60),
      disconnectedAt: null,
      finalRestoration: null,
    };
    const presence = new PresenceService(repoOf(row));

    // 마지막 확인 60초, 지금 300초 → 90초 넘게 끊김 → 60초에서 고정
    const value = await presence.restorationOf({ ...row }, timer, sec(300));
    expect(row.disconnectedAt).toEqual(sec(60));
    expect(value).toBeCloseTo(60 / 600);
  });

  it('조립을 열 때 확정한 최종 복원도가 있으면 그 값을 쓴다', async () => {
    const row: Row = {
      id: 1,
      lastHeartbeatAt: sec(60),
      disconnectedAt: null,
      finalRestoration: 0.42,
    };
    const presence = new PresenceService(repoOf(row));
    expect(await presence.restorationOf(row, timer, sec(300))).toBe(0.42);
  });

  it('연결 중이면 고정하지 않고 지금 시각으로 센다', async () => {
    const row: Row = {
      id: 1,
      lastHeartbeatAt: sec(290),
      disconnectedAt: null,
      finalRestoration: null,
    };
    const presence = new PresenceService(repoOf(row));
    expect(await presence.restorationOf(row, timer, sec(300))).toBeCloseTo(
      300 / 600,
    );
    expect(row.disconnectedAt).toBeNull();
  });
});

describe('sessionStatus (#76)', () => {
  it('COMPLETED는 저장된 값, 나머지는 서버 시각으로 계산', () => {
    expect(sessionStatus({ ...timer, status: 'COMPLETED' }, sec(10))).toBe(
      'COMPLETED',
    );
    expect(sessionStatus({ ...timer, status: 'FOCUSING' }, sec(10))).toBe(
      'FOCUSING',
    );
    // DB는 아직 FOCUSING이어도 종료 시각이 지나면 ASSEMBLING
    expect(sessionStatus({ ...timer, status: 'FOCUSING' }, sec(600))).toBe(
      'ASSEMBLING',
    );
    expect(
      sessionStatus(
        { startedAt: null, goalSeconds: 600, status: 'WAITING' },
        sec(0),
      ),
    ).toBe('WAITING');
  });
});

describe('조기 종료 시계 (#78)', () => {
  // 50분 목표, 20분에 방장이 종료
  const early = { ...timer, goalSeconds: 3000, endsAt: sec(1200) };

  it('끝난 시각부터는 ASSEMBLING, 남은 시간 0, 경과는 종료 시각에서 멈춘다', () => {
    expect(sessionStatus({ ...early, status: 'FOCUSING' }, sec(1199))).toBe(
      'FOCUSING',
    );
    expect(sessionStatus({ ...early, status: 'FOCUSING' }, sec(1200))).toBe(
      'ASSEMBLING',
    );
    expect(remainingSeconds(early, sec(1500))).toBe(0);
    expect(remainingSeconds(early, sec(600))).toBe(600);
    expect(elapsedSeconds(early, sec(1500))).toBe(1200);
  });

  it('복원도는 원래 목표 기준 (20분 / 50분 = 40%)', () => {
    expect(restoration(early, null, sec(1500))).toBeCloseTo(0.4);
  });
});
