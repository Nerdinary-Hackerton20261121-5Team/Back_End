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

  const heartbeat = (sessionId: number, token: string) =>
    http()
      .post(`/api/sessions/${sessionId}/heartbeat`)
      .set('X-Participant-Token', token);
  const board = (sessionId: number, token: string) =>
    http()
      .get(`/api/sessions/${sessionId}/board`)
      .set('X-Participant-Token', token);

  it('200 heartbeat: 공부 중이면 마지막 확인 시각을 갱신한다', async () => {
    const { host, sessionId } = await startedRoom();
    const res = await heartbeat(sessionId, host.participantToken).expect(200);

    expect(res.body.data).toMatchObject({
      status: 'FOCUSING',
      disconnected: false,
      heartbeatIntervalSeconds: 10,
    });
    const me = await participants().findOneByOrFail({ id: host.participantId });
    expect(Date.now() - me.lastHeartbeatAt!.getTime()).toBeLessThan(5 * SEC);
  });

  it('200 진행판: 4명이면 4×2, 내 조각 2개, 내 복원도만 공개하고 남의 것은 null', async () => {
    const { host, sessionId } = await startedRoom(600);
    await rewind(sessionId, 150, 600); // 600초 중 150초 경과
    // 모두 방금까지 신호를 보낸 상태로 둔다 (연결 유지)
    await participants().update({ sessionId }, { lastHeartbeatAt: new Date() });

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
    expect(others.every((p) => p.restoration === null)).toBe(true);
  });

  it('5명이면 5×2 격자, 조각 10개 모두 한 칸 크기', async () => {
    const { host, sessionId } = await startedRoom(600, 5);
    const res = await board(sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({ gridRows: 5, gridCols: 2 });
    expect(
      res.body.data.pieces.map((p: { colSpan: number }) => p.colSpan),
    ).toEqual(Array(10).fill(1));
  });

  it('AC-016 기준 시간 넘게 신호가 없던 사람은 마지막 확인 시각으로 고정된다', async () => {
    const { host, guest, sessionId } = await startedRoom(600);
    await rewind(sessionId, 300, 600); // 300초 전 시작, 그 뒤로 신호 없음
    await heartbeat(sessionId, host.participantToken).expect(200); // 호스트만 지금 신호

    // 호스트가 진행판을 보면 guest가 판정되어 시작 시각(0%)에 고정된다
    await board(sessionId, host.participantToken).expect(200);
    const frozen = await participants().findOneByOrFail({
      id: guest.participantId,
    });
    expect(frozen.disconnectedAt).not.toBeNull();

    // AC-015·018 끊긴 사람이 다시 heartbeat를 보내도 고정값은 바뀌지 않는다
    const res = await heartbeat(sessionId, guest.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      disconnected: true,
      myRestoration: 0,
    });
    const after = await participants().findOneByOrFail({
      id: guest.participantId,
    });
    expect(after.disconnectedAt!.getTime()).toBe(
      frozen.disconnectedAt!.getTime(),
    );
  });

  it('종료 시각이 지나면 ASSEMBLING, 모두의 복원도 공개, 끝까지 있던 사람은 끊김 아님', async () => {
    const { host, sessionId } = await startedRoom(60);
    const startedAt = await rewind(sessionId, 600, 60); // 10분 전 시작, 60초짜리
    // 호스트는 종료 5초 전까지 신호를 보냈다고 둔다
    await participants().update(
      { id: host.participantId },
      { lastHeartbeatAt: new Date(startedAt.getTime() + 55 * SEC) },
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
