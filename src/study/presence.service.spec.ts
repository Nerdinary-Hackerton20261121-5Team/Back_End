import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { Participant } from '../sessions/entities/participant.entity.js';
import { PresenceService } from './presence.service.js';
import {
  elapsedSeconds,
  remainingSeconds,
  sessionStatus,
} from './session-clock.js';

// #76 상태·누적·복원도·단계 계산을 한곳에서 (F-005, F-009, AC-040)
const START = new Date('2026-11-22T03:00:00.000Z');
const sec = (s: number) => new Date(START.getTime() + s * 1000);
const timer = { startedAt: START, goalSeconds: 600 };

const participant = (over: Partial<Participant> = {}): Participant =>
  ({
    id: 1,
    lastHeartbeatAt: START,
    disconnectedAt: null,
    finalRestoration: null,
    focusedMs: 0,
    presence: 'FOCUSING',
    ...over,
  }) as Participant;

function repoOf(row: Participant) {
  const update = vi.fn(
    async (where: { lastHeartbeatAt: Date }, set: Partial<Participant>) => {
      if (where.lastHeartbeatAt.getTime() !== row.lastHeartbeatAt?.getTime()) {
        return { affected: 0 };
      }
      Object.assign(row, set);
      return { affected: 1 };
    },
  );
  const repo = {
    update,
    findOneByOrFail: vi.fn(async () => Object.assign({}, row)),
  } as unknown as Repository<Participant>;
  return { repo, update };
}

describe('PresenceService (#76)', () => {
  it('조회는 저장하지 않고, 마지막 heartbeat 이후 FOCUSING 구간을 더해 계산한다', () => {
    const row = participant({ focusedMs: 100_000, lastHeartbeatAt: sec(290) });
    const { repo, update } = repoOf(row);
    const presence = new PresenceService(repo);
    expect(presence.restorationOf(row, timer, sec(300))).toBeCloseTo(110 / 600);
    expect(update).not.toHaveBeenCalled();
  });

  it('조립을 열 때 확정한 최종 복원도가 있으면 그 값을 쓴다', () => {
    const presence = new PresenceService(repoOf(participant()).repo);
    expect(
      presence.restorationOf(
        participant({ finalRestoration: 0.42 }),
        timer,
        sec(300),
      ),
    ).toBe(0.42);
  });

  it('report: 누적하고 이번 상태를 저장한다', async () => {
    const row = participant({ focusedMs: 0, lastHeartbeatAt: sec(0) });
    const presence = new PresenceService(repoOf(row).repo);
    const after = await presence.report(
      Object.assign({}, row),
      'PAUSED',
      timer,
      sec(10),
    );
    expect(after).toMatchObject({ focusedMs: 10_000, presence: 'PAUSED' });
    expect(row).toMatchObject({ focusedMs: 10_000, presence: 'PAUSED' });
  });

  it('finalize: 종료 시각까지 더해 확정하고, 끊긴 사람은 마지막 확인 시각을 남긴다', () => {
    const presence = new PresenceService(repoOf(participant()).repo);
    expect(
      presence.finalize(
        participant({ focusedMs: 590_000, lastHeartbeatAt: sec(595) }),
        timer,
        sec(900),
      ),
    ).toEqual({
      disconnectedAt: null,
      focusedMs: 595_000,
      finalRestoration: 0.9917,
    });
    expect(
      presence.finalize(
        participant({ focusedMs: 60_000, lastHeartbeatAt: sec(60) }),
        timer,
        sec(900),
      ),
    ).toEqual({
      disconnectedAt: sec(60),
      focusedMs: 60_000,
      finalRestoration: 0.1,
    });
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

  it('복원도는 원래 목표 기준, 누적은 앞당긴 종료 시각에서 멈춘다 (20분 / 50분 = 40%)', () => {
    const presence = new PresenceService(repoOf(participant()).repo);
    const row = participant({
      focusedMs: 1190_000,
      lastHeartbeatAt: sec(1190),
    });
    expect(presence.restorationOf(row, early, sec(1500))).toBeCloseTo(0.4);
  });
});
