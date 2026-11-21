import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import type { Participant } from '../sessions/entities/participant.entity.js';
import type { Session } from '../sessions/entities/session.entity.js';
import { PresenceService } from './presence.service.js';
import { StudyService } from './study.service.js';

/**
 * #52 heartbeat·진행판 동시 요청 경합 (F-005, AC-015, AC-016).
 * 저장소는 메모리로 흉내 낸다. update는 where 조건(IsNull·값 일치)이 맞을 때만 반영한다.
 */

const START = new Date('2026-11-22T03:00:00.000Z');
const sec = (s: number) => new Date(START.getTime() + s * 1000);

type Row = Pick<
  Participant,
  'id' | 'sessionId' | 'lastHeartbeatAt' | 'disconnectedAt'
>;

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key as keyof Row];
    // typeorm IsNull() 연산자
    if (
      expected !== null &&
      typeof expected === 'object' &&
      '_type' in expected &&
      (expected as { _type: string })._type === 'isNull'
    ) {
      return actual === null;
    }
    if (expected instanceof Date) {
      return actual instanceof Date && actual.getTime() === expected.getTime();
    }
    return actual === expected;
  });
}

function setup(rows: Row[]) {
  const session = {
    id: 1,
    status: 'FOCUSING',
    startedAt: START,
    goalSeconds: 600,
    gridRows: 2,
    gridCols: 2,
  } as Session;
  const participants = {
    findOneByOrFail: vi.fn(async ({ id }: { id: number }) => ({
      ...rows.find((r) => r.id === id)!,
    })),
    findOneBy: vi.fn(async ({ id }: { id: number }) => ({
      ...rows.find((r) => r.id === id)!,
    })),
    find: vi.fn(async () => rows.map((r) => ({ ...r }))),
    update: vi.fn(async (where: Record<string, unknown>, set: Partial<Row>) => {
      let affected = 0;
      for (const row of rows) {
        if (matches(row, where)) {
          Object.assign(row, set);
          affected++;
        }
      }
      return { affected };
    }),
  };
  const service = new StudyService(
    { findOneBy: vi.fn(async () => session) } as unknown as Repository<Session>,
    participants as unknown as Repository<Participant>,
    { find: vi.fn(async () => []) } as unknown as Repository<SourcePiece>,
    new PresenceService(participants as unknown as Repository<Participant>),
  );
  return { service, participants };
}

describe('StudyService 끊김 고정 경합 (#52)', () => {
  it('진행판이 오래된 시각을 읽은 사이 heartbeat가 갱신했으면 고정하지 않는다', async () => {
    const rows: Row[] = [
      { id: 1, sessionId: 1, lastHeartbeatAt: sec(0), disconnectedAt: null },
      { id: 2, sessionId: 1, lastHeartbeatAt: sec(95), disconnectedAt: null },
    ];
    const { service, participants } = setup(rows);

    // 진행판 조회가 갱신 전 값(0초)을 읽어 둔 상태에서, heartbeat가 먼저 반영된다
    const stale = rows.map((r) => ({ ...r }));
    participants.find.mockResolvedValueOnce(stale);
    rows[0].lastHeartbeatAt = sec(89);

    vi.useFakeTimers({ now: sec(95) });
    try {
      await service.board(1, {
        participantId: 2,
        sessionId: 1,
        isCreator: true,
      });
    } finally {
      vi.useRealTimers();
    }

    expect(rows[0].disconnectedAt).toBeNull();
    expect(rows[0].lastHeartbeatAt).toEqual(sec(89));
  });

  it('읽은 시각이 그대로면 그 시각으로 고정한다', async () => {
    const rows: Row[] = [
      { id: 1, sessionId: 1, lastHeartbeatAt: sec(0), disconnectedAt: null },
    ];
    const { service } = setup(rows);

    vi.useFakeTimers({ now: sec(95) });
    try {
      await service.board(1, {
        participantId: 1,
        sessionId: 1,
        isCreator: true,
      });
    } finally {
      vi.useRealTimers();
    }

    expect(rows[0].disconnectedAt).toEqual(sec(0));
  });

  it('heartbeat 갱신 직전에 다른 요청이 고정했으면 고정 기준으로 응답한다', async () => {
    const rows: Row[] = [
      { id: 1, sessionId: 1, lastHeartbeatAt: sec(10), disconnectedAt: null },
    ];
    const { service, participants } = setup(rows);

    // heartbeat가 참가자를 읽은 뒤, 갱신하기 전에 다른 요청이 10초로 고정했다
    participants.findOneByOrFail.mockImplementationOnce(async () => {
      const snapshot = { ...rows[0] };
      rows[0].disconnectedAt = sec(10);
      return snapshot as Participant;
    });

    vi.useFakeTimers({ now: sec(60) });
    try {
      const res = await service.heartbeat(1, {
        participantId: 1,
        sessionId: 1,
        isCreator: false,
      });
      expect(res.disconnected).toBe(true);
      expect(res.myRestoration).toBeCloseTo(10 / 600);
    } finally {
      vi.useRealTimers();
    }
    expect(rows[0].lastHeartbeatAt).toEqual(sec(10));
  });
});
