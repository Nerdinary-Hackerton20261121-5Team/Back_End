import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 대기실 나가기 (#53, F-002, F-011, AC-005). 실제 DB(.env의 app_dev)에 붙여 확인하고, 만든 세션은 끝나면 지운다.
describe('대기실 나가기 API (e2e)', () => {
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
    participantId: number;
    participantToken: string;
  };

  async function createSession(maxParticipants = 4): Promise<Entry> {
    const res = await http()
      .post('/api/sessions')
      .send({ goalSeconds: 60, maxParticipants, clientRequestId: randomUUID() })
      .expect(201);
    created.push(res.body.data.sessionId);
    return res.body.data as Entry;
  }

  async function join(sessionCode: string): Promise<Entry> {
    const res = await http()
      .post('/api/sessions/join')
      .send({ sessionCode, clientRequestId: randomUUID() })
      .expect(201);
    return res.body.data as Entry;
  }

  const leave = (sessionId: number | string, token?: string) => {
    const req = http().delete(`/api/sessions/${sessionId}/participants/me`);
    return token ? req.set(TOKEN, token) : req;
  };

  it('200: 나가면 토큰이 무효가 되고, 정원이 찬 방에 빈자리가 생긴다', async () => {
    const host = await createSession(4);
    const guests = [
      await join(host.sessionCode),
      await join(host.sessionCode),
      await join(host.sessionCode),
    ];
    // 4/4 만석
    await http()
      .post('/api/sessions/join')
      .send({ sessionCode: host.sessionCode, clientRequestId: randomUUID() })
      .expect(409);

    const res = await leave(host.sessionId, guests[0].participantToken).expect(
      200,
    );
    expect(res.body).toMatchObject({
      success: true,
      data: {
        sessionId: host.sessionId,
        participantId: guests[0].participantId,
        left: true,
      },
    });

    // 나간 토큰은 거절
    await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, guests[0].participantToken)
      .expect(401);

    // 인원이 줄고 빈자리에 새로 들어올 수 있다
    const detail = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, host.participantToken)
      .expect(200);
    expect(detail.body.data.participantCount).toBe(3);
    await join(host.sessionCode);
  });

  it('409: 시작된 방에서는 나갈 수 없다', async () => {
    const host = await createSession(4);
    const guest = await join(host.sessionCode);
    await join(host.sessionCode);
    await join(host.sessionCode);
    await http()
      .post(`/api/sessions/${host.sessionId}/start`)
      .set(TOKEN, host.participantToken)
      .expect(200);

    const res = await leave(host.sessionId, guest.participantToken).expect(409);
    expect(res.body.code).toBe('CANNOT_LEAVE_AFTER_START');
  });

  it('#56 방장이 나가면 다음 입장 순서가 방장이 되고, 원래 방장의 재전송은 새 방장에게 영향이 없다', async () => {
    const clientRequestId = randomUUID();
    const res0 = await http()
      .post('/api/sessions')
      .send({ goalSeconds: 60, maxParticipants: 4, clientRequestId })
      .expect(201);
    const host = res0.body.data as Entry;
    created.push(host.sessionId);
    const second = await join(host.sessionCode);
    const third = await join(host.sessionCode);

    const res = await leave(host.sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      participantId: host.participantId,
      left: true,
      newCreatorId: second.participantId,
      sessionDeleted: false,
    });

    // 새 방장 확인, 세 번째 사람은 그대로
    const asSecond = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, second.participantToken)
      .expect(200);
    expect(asSecond.body.data.me.isCreator).toBe(true);
    expect(asSecond.body.data.participantCount).toBe(2);
    const asThird = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, third.participantToken)
      .expect(200);
    expect(asThird.body.data.me.isCreator).toBe(false);

    // 원래 방장이 방 만들기를 재전송해도 새 방장 토큰은 살아 있다 (나간 사람이라 404)
    await http()
      .post('/api/sessions')
      .send({ goalSeconds: 60, maxParticipants: 4, clientRequestId })
      .expect(404);
    await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, second.participantToken)
      .expect(200);

    // 새 방장은 방장 권한(시작)을 쓸 수 있다: 인원 부족 400까지 가면 권한 확인을 통과한 것
    const start = await http()
      .post(`/api/sessions/${host.sessionId}/start`)
      .set(TOKEN, second.participantToken)
      .expect(400);
    expect(start.body.code).toBe('NOT_ENOUGH_PARTICIPANTS');
  });

  it('#56 마지막 한 명(방장)이 나가면 방이 지워진다', async () => {
    const host = await createSession();
    const res = await leave(host.sessionId, host.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      newCreatorId: null,
      sessionDeleted: true,
    });
    const row = await dataSource
      .getRepository(Session)
      .findOneBy({ id: host.sessionId });
    expect(row).toBeNull();
  });

  it('401: 토큰 없음', async () => {
    const host = await createSession();
    await leave(host.sessionId).expect(401);
  });

  it('400: 숫자가 아닌 세션 ID', async () => {
    const host = await createSession();
    const guest = await join(host.sessionCode);
    await leave('abc', guest.participantToken).expect(400);
  });

  it('403: 다른 세션의 토큰', async () => {
    const a = await createSession();
    const b = await createSession();
    const guest = await join(b.sessionCode);
    await leave(a.sessionId, guest.participantToken).expect(403);
  });
});
