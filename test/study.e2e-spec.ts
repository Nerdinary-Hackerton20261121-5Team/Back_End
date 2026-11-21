import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 heartbeat·진행판을 확인한다.
// 시간이 흐른 상황은 DB의 시각을 과거로 옮겨 만든다. 만든 세션은 끝나면 지운다.
describe('heartbeat·진행판 API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const created: number[] = [];
  const SEC = 1000;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (created.length) await dataSource.getRepository(Session).delete(created);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sessions = () => dataSource.getRepository(Session);
  const participants = () => dataSource.getRepository(Participant);

  /** 목표 goalSeconds, people명(최소 4명) 방을 만들고 시작한다 */
  async function startedRoom(goalSeconds = 600, people = 4) {
    const res = await http()
      .post('/api/sessions')
      .send({ goalSeconds, maxParticipants: 6, clientRequestId: randomUUID() })
      .expect(201);
    const host = res.body.data as {
      sessionId: number;
      sessionCode: string;
      participantId: number;
      participantToken: string;
    };
    created.push(host.sessionId);
    const guest = (
      await http()
        .post('/api/sessions/join')
        .send({ sessionCode: host.sessionCode, clientRequestId: randomUUID() })
        .expect(201)
    ).body.data as { participantId: number; participantToken: string };
    for (let i = 2; i < people; i++) {
      await http()
        .post('/api/sessions/join')
        .send({ sessionCode: host.sessionCode, clientRequestId: randomUUID() })
        .expect(201);
    }
    await http()
      .post(`/api/sessions/${host.sessionId}/start`)
      .set('X-Participant-Token', host.participantToken)
      .expect(200);
    return { host, guest, sessionId: host.sessionId };
  }

  /** 시작 시각을 secondsAgo초 전으로 옮긴다 (마지막 확인 시각도 같이) */
  async function rewind(sessionId: number, secondsAgo: number, goal: number) {
    const startedAt = new Date(Date.now() - secondsAgo * SEC);
    await sessions().update(
      { id: sessionId },
      { startedAt, endsAt: new Date(startedAt.getTime() + goal * SEC) },
    );
    await participants().update({ sessionId }, { lastHeartbeatAt: startedAt });
    return startedAt;
  }

  const heartbeat = (sessionId: number, token: string, state?: string) =>
    http()
      .post(`/api/sessions/${sessionId}/heartbeat`)
      .set('X-Participant-Token', token)
      .send(state ? { state } : {});
  const board = (sessionId: number, token: string) =>
    http()
      .get(`/api/sessions/${sessionId}/board`)
      .set('X-Participant-Token', token);

  it('200 heartbeat: 공부 중이면 마지막 확인 시각을 갱신한다', async () => {
    const { host, sessionId } = await startedRoom();
    const res = await heartbeat(sessionId, host.participantToken).expect(200);

    expect(res.body.data).toMatchObject({
      status: 'FOCUSING',
      state: 'FOCUSING',
      disconnected: false,
      heartbeatIntervalSeconds: 1,
    });
    const me = await participants().findOneByOrFail({ id: host.participantId });
    expect(Date.now() - me.lastHeartbeatAt!.getTime()).toBeLessThan(5 * SEC);
  });

  it('200 진행판: 4명이면 4×2, 내 조각 2개, 모두의 복원도·명단 공개', async () => {
    const { host, sessionId } = await startedRoom(600);
    await rewind(sessionId, 150, 600); // 600초 중 150초 경과
    // 모두 방금까지 신호를 보냈고, 그동안 얼굴이 계속 인식됐다고 둔다
    await participants().update(
      { sessionId },
      { lastHeartbeatAt: new Date(), focusedMs: 150 * SEC },
    );

    const res = await board(sessionId, host.participantToken).expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      status: 'FOCUSING',
      gridRows: 4,
      gridCols: 2,
      myDisconnected: false,
    });
    expect(data.pieces).toHaveLength(8);
    expect(data.pieces.map((p: { position: number }) => p.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);

    type Piece = {
      position: number;
      displaySlot: number;
      colSpan: number;
      isMine: boolean;
      restoration: number | null;
    };
    const mine = data.pieces.filter((p: Piece) => p.isMine) as Piece[];
    const others = data.pieces.filter((p: Piece) => !p.isMine) as Piece[];
    // 개설자는 명단 첫 번째라 첫 행(1·2번 칸)을 맡는다
    expect(mine.map((p) => p.position)).toEqual([1, 2]);
    for (const p of mine) {
      expect(p.colSpan).toBe(1);
      expect(p.restoration).toBeCloseTo(0.25, 1);
      // 공부 중에는 내 정답 칸(1·2번)이 아닌 곳에 놓인다
      expect([1, 2]).not.toContain(p.displaySlot);
      expect(p).not.toHaveProperty('rect');
    }
    // 배치 칸은 서로 겹치지 않는다
    expect(
      data.pieces
        .map((p: Piece) => p.displaySlot)
        .sort((a: number, b: number) => a - b),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const p of others) expect(p.restoration).toBeCloseTo(0.25, 1);

    expect(data.members).toHaveLength(4);
    expect(data.members[0]).toMatchObject({
      participantId: host.participantId,
      isMe: true,
      state: 'FOCUSING',
    });
    expect(data.members[0].focusedSeconds).toBeGreaterThanOrEqual(150);
  });

  it('일시정지·얼굴 인식 안 됨 구간은 쌓이지 않고 명단에 상태가 보인다', async () => {
    const { host, guest, sessionId } = await startedRoom(600);
    await rewind(sessionId, 100, 600);
    // 20초 전부터 일시정지 상태였다고 둔다 (그 전 80초는 집중)
    await participants().update(
      { id: host.participantId },
      {
        lastHeartbeatAt: new Date(Date.now() - 20 * SEC),
        presence: 'PAUSED',
        focusedMs: 80 * SEC,
      },
    );

    const res = await heartbeat(
      sessionId,
      host.participantToken,
      'AWAY',
    ).expect(200);
    expect(res.body.data).toMatchObject({ state: 'AWAY', focusedSeconds: 80 });

    const b = await board(sessionId, guest.participantToken).expect(200);
    const hostRow = b.body.data.members.find(
      (m: { participantId: number }) => m.participantId === host.participantId,
    );
    expect(hostRow).toMatchObject({
      isMe: false,
      state: 'AWAY',
      focusedSeconds: 80,
    });
  });

  it('400 heartbeat state가 정해진 값이 아니면', async () => {
    const { host, sessionId } = await startedRoom();
    const res = await heartbeat(
      sessionId,
      host.participantToken,
      'SLEEPING',
    ).expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('5명이면 5×2 격자, 조각 10개 모두 한 칸 크기', async () => {
    const { host, sessionId } = await startedRoom(600, 5);
    const res = await board(sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({ gridRows: 5, gridCols: 2 });
    expect(
      res.body.data.pieces.map((p: { colSpan: number }) => p.colSpan),
    ).toEqual(Array(10).fill(1));
  });

  it('기준 시간 넘게 신호가 없던 사람은 DISCONNECTED, 그 구간은 빼고 다시 보내면 이어서 쌓인다', async () => {
    const { host, guest, sessionId } = await startedRoom(600);
    await rewind(sessionId, 300, 600); // 300초 전 시작, 그 뒤로 신호 없음
    await heartbeat(sessionId, host.participantToken).expect(200);

    const b = await board(sessionId, host.participantToken).expect(200);
    const guestRow = b.body.data.members.find(
      (m: { participantId: number }) => m.participantId === guest.participantId,
    );
    expect(guestRow).toMatchObject({
      state: 'DISCONNECTED',
      focusedSeconds: 0,
    });

    // 늦게 온 heartbeat로 끊긴 300초를 인정받지 못한다
    const res = await heartbeat(sessionId, guest.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      state: 'FOCUSING',
      disconnected: false,
      focusedSeconds: 0,
      myRestoration: 0,
    });
  });

  it('종료 시각이 지나면 ASSEMBLING, 모두의 복원도 공개, 끝까지 있던 사람은 끊김 아님', async () => {
    const { host, sessionId } = await startedRoom(60);
    const startedAt = await rewind(sessionId, 600, 60); // 10분 전 시작, 60초짜리
    // 호스트는 종료 5초 전까지 신호를 보냈다고 둔다
    await participants().update(
      { id: host.participantId },
      {
        lastHeartbeatAt: new Date(startedAt.getTime() + 55 * SEC),
        focusedMs: 55 * SEC,
      },
    );

    const res = await board(sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      status: 'ASSEMBLING',
      remainingSeconds: 0,
      myDisconnected: false,
    });
    const restorations = res.body.data.pieces.map(
      (p: { restoration: number | null }) => p.restoration,
    );
    expect(restorations.every((r: number | null) => r !== null)).toBe(true);
    const mine = res.body.data.pieces.find(
      (p: { isMine: boolean }) => p.isMine,
    );
    expect(mine.restoration).toBe(1);

    // 공부가 끝난 뒤의 heartbeat는 아무것도 바꾸지 않는다
    const before = await participants().findOneByOrFail({
      id: host.participantId,
    });
    await heartbeat(sessionId, host.participantToken).expect(200);
    const after = await participants().findOneByOrFail({
      id: host.participantId,
    });
    expect(after.lastHeartbeatAt).toEqual(before.lastHeartbeatAt);
  });

  it('결과: 공부 중이면 409, 끝나면 참가자별 집중 시간·최종 복원도', async () => {
    const { host, guest, sessionId } = await startedRoom(60);
    const early = await http()
      .get(`/api/sessions/${sessionId}/result`)
      .set('X-Participant-Token', host.participantToken)
      .expect(409);
    expect(early.body.code).toBe('STUDY_NOT_FINISHED');

    const startedAt = await rewind(sessionId, 600, 60);
    await participants().update({ sessionId }, { focusedMs: 0 });
    await participants().update(
      { id: host.participantId },
      {
        lastHeartbeatAt: new Date(startedAt.getTime() + 50 * SEC),
        focusedMs: 30 * SEC,
      },
    );
    await participants().update(
      { id: guest.participantId },
      {
        lastHeartbeatAt: new Date(startedAt.getTime() + 50 * SEC),
        presence: 'PAUSED',
        focusedMs: 20 * SEC,
      },
    );

    const res = await http()
      .get(`/api/sessions/${sessionId}/result`)
      .set('X-Participant-Token', guest.participantToken)
      .expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      status: 'ASSEMBLING',
      goalSeconds: 60,
      completed: false,
    });
    expect(data.members).toHaveLength(4);
    // 호스트: 30초 + 마지막 heartbeat(50초) 뒤 종료까지 10초 집중
    expect(data.members[0]).toMatchObject({
      participantId: host.participantId,
      isMe: false,
      isCreator: true,
      focusedSeconds: 40,
      unfocusedSeconds: 20,
      absent: false,
    });
    // 게스트: 일시정지 상태로 끝나 마지막 10초는 쌓이지 않는다
    expect(data.members[1]).toMatchObject({
      participantId: guest.participantId,
      isMe: true,
      focusedSeconds: 20,
      unfocusedSeconds: 40,
    });
    expect(data.members[1].restoration).toBeCloseTo(20 / 60);
  });

  it('시작 전 진행판은 WAITING, 조각 없음', async () => {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    created.push(res.body.data.sessionId);

    const b = await board(
      res.body.data.sessionId,
      res.body.data.participantToken,
    ).expect(200);
    expect(b.body.data).toMatchObject({ status: 'WAITING', pieces: [] });
  });

  it('401·403·400', async () => {
    const { host, sessionId } = await startedRoom();
    const other = await startedRoom();

    const none = await http()
      .post(`/api/sessions/${sessionId}/heartbeat`)
      .expect(401);
    expect(none.body.code).toBe('TOKEN_REQUIRED');

    const forbidden = await board(
      other.sessionId,
      host.participantToken,
    ).expect(403);
    expect(forbidden.body.code).toBe('NOT_SESSION_PARTICIPANT');

    const bad = await http().get('/api/sessions/abc/board').expect(400);
    expect(bad.body.code).toBe('INVALID_INPUT');
  });
});
