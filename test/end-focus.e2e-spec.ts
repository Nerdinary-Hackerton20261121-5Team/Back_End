import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 방장 조기 종료 (#78). 실제 DB(.env의 app_dev)에 붙여 확인하고, 만든 세션은 끝나면 지운다.
describe('공부 조기 종료 API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const created: number[] = [];

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
  const TOKEN = 'X-Participant-Token';
  type Entry = {
    sessionId: number;
    sessionCode: string;
    participantToken: string;
  };

  async function room(start: boolean) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 3000,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    const host = res.body.data as Entry;
    created.push(host.sessionId);
    const guests: Entry[] = [];
    for (let i = 0; i < 3; i++) {
      const j = await http()
        .post('/api/sessions/join')
        .send({ sessionCode: host.sessionCode, clientRequestId: randomUUID() })
        .expect(201);
      guests.push(j.body.data as Entry);
    }
    if (start) {
      await http()
        .post(`/api/sessions/${host.sessionId}/start`)
        .set(TOKEN, host.participantToken)
        .expect(200);
    }
    return { host, guests };
  }

  const end = (sessionId: number | string, token?: string) => {
    const req = http().post(`/api/sessions/${sessionId}/end`);
    return token ? req.set(TOKEN, token) : req;
  };

  it('200: 방장이 끝내면 모두 조립 단계로, 남은 시간 0, 복원도는 원래 목표 기준, 재전송은 같은 결과', async () => {
    const { host, guests } = await room(true);

    const res = await end(host.sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      sessionId: host.sessionId,
      status: 'ASSEMBLING',
      alreadyEnded: false,
    });

    // 참가자 화면에서도 조립 단계, 남은 시간 0
    const detail = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, guests[0].participantToken)
      .expect(200);
    expect(detail.body.data.status).toBe('ASSEMBLING');
    expect(detail.body.data.remainingSeconds).toBe(0);
    expect(detail.body.data.elapsedSeconds).toBeLessThan(30);

    // 50분 목표에서 몇 초 만에 끝났으므로 복원도는 100%가 아니라 거의 0
    const board = await http()
      .get(`/api/sessions/${host.sessionId}/board`)
      .set(TOKEN, guests[0].participantToken)
      .expect(200);
    const mine = board.body.data.pieces.find(
      (p: { isMine: boolean }) => p.isMine,
    );
    expect(mine.restoration).toBeLessThan(0.05);

    // 조립판이 열린다
    await http()
      .get(`/api/sessions/${host.sessionId}/assembly`)
      .set(TOKEN, guests[0].participantToken)
      .expect(200);

    // 재전송: 처음 끝난 시각 그대로
    const again = await end(host.sessionId, host.participantToken).expect(200);
    expect(again.body.data.alreadyEnded).toBe(true);
    expect(again.body.data.endsAt).toBe(res.body.data.endsAt);
  });

  it('403: 방장이 아닌 참가자 / 409: 시작 전 / 401: 토큰 없음 / 400: 숫자 아닌 ID', async () => {
    const started = await room(true);
    const r1 = await end(
      started.host.sessionId,
      started.guests[0].participantToken,
    ).expect(403);
    expect(r1.body.code).toBe('NOT_CREATOR');

    const waiting = await room(false);
    const r2 = await end(
      waiting.host.sessionId,
      waiting.host.participantToken,
    ).expect(409);
    expect(r2.body.code).toBe('FOCUS_NOT_STARTED');

    await end(started.host.sessionId).expect(401);
    await end('abc', started.host.participantToken).expect(400);
  });
});
