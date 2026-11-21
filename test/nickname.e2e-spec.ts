import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 닉네임 설정·명단 (#71, F-002). 실제 DB(.env의 app_dev)에 붙여 확인하고, 만든 세션은 끝나면 지운다.
describe('닉네임 API (e2e)', () => {
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
    created.push(res.body.data.sessionId);
    return res.body.data as Entry;
  }

  async function join(sessionCode: string, body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/api/sessions/join')
      .send({ sessionCode, clientRequestId: randomUUID(), ...body })
      .expect(201);
    return res.body.data as Entry;
  }

  const setNickname = (
    sessionId: number | string,
    nickname: unknown,
    token?: string,
  ) => {
    const req = http().patch(`/api/sessions/${sessionId}/participants/me`);
    return (token ? req.set(TOKEN, token) : req).send({ nickname });
  };

  it('방 만들기·입장 때 받거나 나중에 정한 닉네임이 명단에 입장 순서로 나온다', async () => {
    const host = await createSession({ nickname: '  도도  ' });
    const guest = await join(host.sessionCode); // 링크를 열 때 입장 (닉네임 없음)
    const third = await join(host.sessionCode, { nickname: '누렁이' });

    const before = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, guest.participantToken)
      .expect(200);
    expect(before.body.data.participants).toEqual([
      { participantId: host.participantId, nickname: '도도', isCreator: true },
      { participantId: guest.participantId, nickname: null, isCreator: false },
      {
        participantId: third.participantId,
        nickname: '누렁이',
        isCreator: false,
      },
    ]);

    // "참여하기"에서 닉네임 설정, 다시 바꿀 수도 있다
    const res = await setNickname(
      host.sessionId,
      ' 비둘기 ',
      guest.participantToken,
    ).expect(200);
    expect(res.body.data).toEqual({
      participantId: guest.participantId,
      nickname: '비둘기',
    });
    await setNickname(host.sessionId, '비둘기2', guest.participantToken).expect(
      200,
    );

    const after = await http()
      .get(`/api/sessions/${host.sessionId}`)
      .set(TOKEN, host.participantToken)
      .expect(200);
    expect(after.body.data.participants[1]).toEqual({
      participantId: guest.participantId,
      nickname: '비둘기2',
      isCreator: false,
    });
  });

  it('400: 공백만, 21자, 숫자, 누락 / 방 만들기에 21자', async () => {
    const host = await createSession();
    for (const bad of ['   ', 'a'.repeat(21), 123, undefined]) {
      const res = await setNickname(
        host.sessionId,
        bad,
        host.participantToken,
      ).expect(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    }
    await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
        nickname: 'a'.repeat(21),
      })
      .expect(400);
  });

  it('401: 토큰 없음 / 403: 다른 세션의 토큰 / 400: 숫자가 아닌 세션 ID', async () => {
    const a = await createSession();
    const b = await createSession();
    await setNickname(a.sessionId, '도도').expect(401);
    await setNickname(a.sessionId, '도도', b.participantToken).expect(403);
    await setNickname('abc', '도도', a.participantToken).expect(400);
  });
});
