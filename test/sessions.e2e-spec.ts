import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 세션 API를 확인한다. 만든 세션은 끝나면 지운다.
describe('세션 API (e2e)', () => {
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

  async function createSession(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
        ...body,
      })
      .expect(201);
    if (!created.includes(res.body.data.sessionId)) {
      created.push(res.body.data.sessionId);
    }
    return res.body.data as {
      sessionId: number;
      sessionCode: string;
      participantId: number;
      participantToken: string;
      isCreator: boolean;
      restored: boolean;
    };
  }

  const join = (sessionCode: string, clientRequestId = randomUUID()) =>
    http().post('/api/sessions/join').send({ sessionCode, clientRequestId });

  describe('POST /api/sessions', () => {
    it('201: 방을 만들고 개설자 토큰을 준다', async () => {
      const data = await createSession();
      expect(data).toMatchObject({ isCreator: true, restored: false });
      expect(data.sessionCode).toMatch(/^[A-Z2-9]{6}$/);
      expect(data.participantToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('AC-002 같은 clientRequestId는 같은 방을 돌려주고 토큰은 새로 발급', async () => {
      const clientRequestId = randomUUID();
      const first = await createSession({ clientRequestId });
      const second = await createSession({ clientRequestId });

      expect(second).toMatchObject({
        sessionId: first.sessionId,
        participantId: first.participantId,
        restored: true,
      });
      expect(second.participantToken).not.toBe(first.participantToken);
      await http()
        .get(`/api/sessions/${first.sessionId}`)
        .set('X-Participant-Token', first.participantToken)
        .expect(401);
    });

    it.each([
      ['음수 목표 시간', { goalSeconds: -1 }],
      ['범위 밖 목표 시간(30초)', { goalSeconds: 30 }],
      ['허용하지 않는 정원(3명)', { maxParticipants: 3 }],
      ['문자열 목표 시간', { goalSeconds: 'abc' }],
      ['정의되지 않은 필드', { hacker: true }],
    ])('400: %s', async (_name, override) => {
      const res = await http()
        .post('/api/sessions')
        .send({
          goalSeconds: 60,
          maxParticipants: 4,
          clientRequestId: randomUUID(),
          ...override,
        })
        .expect(400);
      expect(res.body).toMatchObject({
        success: false,
        code: 'INVALID_INPUT',
        data: null,
      });
    });

    it('400: 빈 본문', async () => {
      const res = await http().post('/api/sessions').send({}).expect(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('#59 400: 제외된 allowRandom을 보내면 거절하고, 조회 응답에도 없다', async () => {
      const res = await http()
        .post('/api/sessions')
        .send({
          goalSeconds: 60,
          maxParticipants: 4,
          allowRandom: true,
          clientRequestId: randomUUID(),
        })
        .expect(400);
      expect(res.body.code).toBe('INVALID_INPUT');

      const data = await createSession();
      const detail = await http()
        .get(`/api/sessions/${data.sessionId}`)
        .set('X-Participant-Token', data.participantToken)
        .expect(200);
      expect(detail.body.data).not.toHaveProperty('allowRandom');
    });
  });

  describe('POST /api/sessions/join', () => {
    it('201: 코드로 입장 (소문자도 허용), 재전송은 같은 참가자', async () => {
      const room = await createSession();
      const clientRequestId = randomUUID();

      const first = await join(
        room.sessionCode.toLowerCase(),
        clientRequestId,
      ).expect(201);
      expect(first.body.data).toMatchObject({
        sessionId: room.sessionId,
        isCreator: false,
        restored: false,
      });

      const again = await join(room.sessionCode, clientRequestId).expect(201);
      expect(again.body.data).toMatchObject({
        participantId: first.body.data.participantId,
        restored: true,
      });
    });

    it('404: 없는 코드', async () => {
      const res = await join('ZZZZZZZZ').expect(404);
      expect(res.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('409: 정원이 찬 방', async () => {
      const room = await createSession({ maxParticipants: 4 });
      for (let i = 0; i < 3; i++) await join(room.sessionCode).expect(201);
      const res = await join(room.sessionCode).expect(409);
      expect(res.body.code).toBe('SESSION_FULL');
    });

    it('AC-005 409: 시작된 방', async () => {
      const room = await createSession();
      await dataSource
        .getRepository(Session)
        .update({ id: room.sessionId }, { status: 'FOCUSING' });
      const res = await join(room.sessionCode).expect(409);
      expect(res.body.code).toBe('SESSION_ALREADY_STARTED');
    });

    it('400: 코드 누락', async () => {
      const res = await http()
        .post('/api/sessions/join')
        .send({ clientRequestId: randomUUID() })
        .expect(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('200: 단계·남은 시간·인원·내 정보', async () => {
      const room = await createSession({ goalSeconds: 120 });
      await join(room.sessionCode).expect(201);

      const res = await http()
        .get(`/api/sessions/${room.sessionId}`)
        .set('X-Participant-Token', room.participantToken)
        .expect(200);
      expect(res.body).toMatchObject({ success: true, code: 'SUCCESS' });
      expect(res.body.data).toMatchObject({
        sessionId: room.sessionId,
        status: 'WAITING',
        goalSeconds: 120,
        participantCount: 2,
        elapsedSeconds: 0,
        remainingSeconds: 120,
        me: { participantId: room.participantId, isCreator: true },
      });
      expect(Date.parse(res.body.data.serverNow)).not.toBeNaN();
    });

    it('401: 토큰 없음 / 잘못된 토큰', async () => {
      const room = await createSession();
      const none = await http()
        .get(`/api/sessions/${room.sessionId}`)
        .expect(401);
      expect(none.body.code).toBe('TOKEN_REQUIRED');
      const wrong = await http()
        .get(`/api/sessions/${room.sessionId}`)
        .set('X-Participant-Token', 'not-a-real-token')
        .expect(401);
      expect(wrong.body.code).toBe('TOKEN_INVALID');
    });

    it('AC-006 403: 다른 세션의 토큰', async () => {
      const mine = await createSession();
      const other = await createSession();
      const res = await http()
        .get(`/api/sessions/${other.sessionId}`)
        .set('X-Participant-Token', mine.participantToken)
        .expect(403);
      expect(res.body.code).toBe('NOT_SESSION_PARTICIPANT');
    });

    it('400: 숫자가 아닌 세션 ID', async () => {
      const res = await http().get('/api/sessions/abc').expect(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });
  });
});
