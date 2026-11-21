import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import type { Participant } from '../sessions/entities/participant.entity.js';
import type { Session } from '../sessions/entities/session.entity.js';
import { PresenceService } from './presence.service.js';
import { StudyService } from './study.service.js';

/**
 * heartbeat 누적 (F-005, F-009). 저장소는 메모리로 흉내 낸다.
 * update는 where 조건(IsNull·값 일치)이 맞을 때만 반영한다.
 */

const START = new Date('2026-11-22T03:00:00.000Z');
const sec = (s: number) => new Date(START.getTime() + s * 1000);
const me = { participantId: 1, sessionId: 1, isCreator: true };

type Row = Pick<
  Participant,
  | 'id'
  | 'sessionId'
  | 'nickname'
  | 'isCreator'
  | 'joinedAt'
  | 'lastHeartbeatAt'
  | 'disconnectedAt'
  | 'finalRestoration'
  | 'focusedMs'
  | 'presence'
>;

const row = (over: Partial<Row> = {}): Row => ({
  id: 1,
  sessionId: 1,
  nickname: null,
  isCreator: true,
  joinedAt: START,
  lastHeartbeatAt: START,
  disconnectedAt: null,
  finalRestoration: null,
  focusedMs: 0,
  presence: 'FOCUSING',
  ...over,
});

function matches(r: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = r[key as keyof Row];
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

function setup(rows: Row[], goalSeconds = 600) {
  const session = {
    id: 1,
    status: 'FOCUSING',
    startedAt: START,
    endsAt: new Date(START.getTime() + goalSeconds * 1000),
    goalSeconds,
    gridRows: 4,
    gridCols: 2,
    imageId: null,
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
      for (const r of rows) {
        if (matches(r, where)) {
          Object.assign(r, set);
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
  return { service, participants, session };
}

async function atTime<T>(t: Date, fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ now: t });
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}

describe('StudyService.heartbeat 시간 누적', () => {
  it('직전 상태가 FOCUSING인 구간만 쌓고, 이번 상태를 저장한다', async () => {
    const rows = [row()];
    const { service } = setup(rows);

    await atTime(sec(10), () => service.heartbeat(1, me, 'FOCUSING'));
    expect(rows[0]).toMatchObject({ focusedMs: 10_000, presence: 'FOCUSING' });

    // 10초에 일시정지를 눌렀다 → 10~20초는 쌓이지 않는다
    await atTime(sec(10), () => service.heartbeat(1, me, 'PAUSED'));
    const paused = await atTime(sec(20), () =>
      service.heartbeat(1, me, 'AWAY'),
    );
    expect(rows[0]).toMatchObject({ focusedMs: 10_000, presence: 'AWAY' });
    expect(paused).toMatchObject({ state: 'AWAY', focusedSeconds: 10 });

    // 얼굴이 다시 보인다 → 20~30초는 AWAY 구간이라 쌓이지 않고, 그 뒤부터 쌓인다
    await atTime(sec(30), () => service.heartbeat(1, me, 'FOCUSING'));
    const res = await atTime(sec(40), () => service.heartbeat(1, me));
    expect(res).toMatchObject({
      state: 'FOCUSING',
      focusedSeconds: 20,
      disconnected: false,
    });
    expect(res.myRestoration).toBeCloseTo(20 / 600);
  });

  it('단절 기준을 넘겨 끊긴 구간은 쌓지 않고, 다시 보내면 이어서 쌓는다', async () => {
    const rows = [row({ focusedMs: 30_000, lastHeartbeatAt: sec(30) })];
    const { service } = setup(rows);

    await atTime(sec(300), () => service.heartbeat(1, me));
    expect(rows[0].focusedMs).toBe(30_000);
    const res = await atTime(sec(310), () => service.heartbeat(1, me));
    expect(res.focusedSeconds).toBe(40);
  });

  it('겹친 heartbeat가 먼저 반영돼도 같은 구간을 두 번 더하지 않는다', async () => {
    const rows = [row()];
    const { service, participants } = setup(rows);

    // 이 요청이 행을 읽은 뒤, 다른 heartbeat가 10초 시점을 먼저 반영했다
    participants.findOneByOrFail.mockImplementationOnce(async () => {
      const snapshot = { ...rows[0] };
      Object.assign(rows[0], { focusedMs: 10_000, lastHeartbeatAt: sec(10) });
      return snapshot as Participant;
    });

    const res = await atTime(sec(12), () => service.heartbeat(1, me));
    expect(rows[0]).toMatchObject({ focusedMs: 12_000 });
    expect(rows[0].lastHeartbeatAt).toEqual(sec(12));
    expect(res.focusedSeconds).toBe(12);
  });

  it('공부 시간이 끝난 뒤에는 아무것도 바꾸지 않는다', async () => {
    const rows = [row({ focusedMs: 50_000, lastHeartbeatAt: sec(55) })];
    const { service } = setup(rows, 60);

    const res = await atTime(sec(120), () => service.heartbeat(1, me));
    expect(rows[0].lastHeartbeatAt).toEqual(sec(55));
    // 마지막 구간(55~60초)은 계산에 들어간다
    expect(res).toMatchObject({ status: 'ASSEMBLING', focusedSeconds: 55 });
  });
});

describe('StudyService.board·result', () => {
  it('진행판은 명단에 상태·누적 시간을 주고 아무것도 저장하지 않는다', async () => {
    const rows = [
      row({
        nickname: '졸린 도도',
        focusedMs: 60_000,
        lastHeartbeatAt: sec(95),
      }),
      row({
        id: 2,
        isCreator: false,
        presence: 'PAUSED',
        lastHeartbeatAt: sec(95),
      }),
      row({ id: 3, isCreator: false, lastHeartbeatAt: sec(0) }),
    ];
    const { service, participants } = setup(rows);

    const res = await atTime(sec(100), () => service.board(1, me));
    expect(res.members).toEqual([
      expect.objectContaining({
        participantId: 1,
        nickname: '졸린 도도',
        isMe: true,
        state: 'FOCUSING',
        focusedSeconds: 65,
      }),
      expect.objectContaining({ participantId: 2, state: 'PAUSED' }),
      expect.objectContaining({ participantId: 3, state: 'DISCONNECTED' }),
    ]);
    expect(participants.update).not.toHaveBeenCalled();
  });

  it('결과는 공부 중이면 409, 끝나면 참가자별 집중 시간', async () => {
    const rows = [
      row({ focusedMs: 300_000, lastHeartbeatAt: sec(590) }),
      row({
        id: 2,
        isCreator: false,
        focusedMs: 200_000,
        lastHeartbeatAt: sec(400),
      }),
    ];
    const { service } = setup(rows, 600);

    await expect(
      atTime(sec(30), () => service.result(1, me)),
    ).rejects.toMatchObject({ error: { code: 'STUDY_NOT_FINISHED' } });

    const res = await atTime(sec(700), () => service.result(1, me));
    expect(res.members).toEqual([
      expect.objectContaining({
        participantId: 1,
        focusedSeconds: 310,
        unfocusedSeconds: 290,
        absent: false,
      }),
      expect.objectContaining({
        participantId: 2,
        focusedSeconds: 200,
        unfocusedSeconds: 400,
        absent: true,
      }),
    ]);
    expect(res.averageRestoration).toBeCloseTo((310 / 600 + 200 / 600) / 2);
  });
});
