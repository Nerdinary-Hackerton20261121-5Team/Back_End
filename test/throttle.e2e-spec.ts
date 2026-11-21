import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 요청 횟수 제한 (#67). 한도를 낮춘 설정으로 실제 앱(app_dev)에 요청을 보낸다. 만든 세션은 끝나면 지운다.
describe('요청 횟수 제한 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const created: number[] = [];
  const saved = { ...process.env };

  beforeAll(async () => {
    // 제한 값은 요청마다 읽으므로 이 파일에서만 낮춘다
    process.env.POLICY_THROTTLE_ENABLED = 'true';
    process.env.POLICY_THROTTLE_CREATE_LIMIT = '2';
    process.env.POLICY_THROTTLE_JOIN_LIMIT = '2';
    process.env.POLICY_THROTTLE_UPLOAD_LIMIT = '2';
    process.env.POLICY_THROTTLE_DEFAULT_LIMIT = '3';

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
    process.env = saved;
  });

  const http = () => request(app.getHttpServer());
  // 테스트마다 다른 사용자 IP를 써서 서로 영향을 주지 않게 한다
  const ip = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

  const create = (clientIp: string) =>
    http()
      .post('/api/sessions')
      .set('CF-Connecting-IP', clientIp)
      .send({
        goalSeconds: 60,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
      })
      .then((res) => {
        if (res.status === 201) created.push(res.body.data.sessionId);
        return res;
      });

  it('방 만들기: 같은 사용자 IP는 한도를 넘으면 429, 다른 IP는 따로 센다', async () => {
    const me = ip();
    expect((await create(me)).status).toBe(201);
    expect((await create(me)).status).toBe(201);

    const third = await create(me);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      data: null,
    });

    let other = ip();
    while (other === me) other = ip();
    expect((await create(other)).status).toBe(201);
  });

  it('이미지 업로드: 인증이 없으므로 IP별 한도를 넘으면 429 (파일 없는 400 요청도 센다)', async () => {
    const me = ip();
    const post = () => http().post('/api/images').set('CF-Connecting-IP', me);
    expect((await post()).status).toBe(400);
    expect((await post()).status).toBe(400);
    const third = await post();
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('입장: 한도를 넘으면 429 (없는 코드로 404가 나는 요청도 센다)', async () => {
    const me = ip();
    const join = () =>
      http()
        .post('/api/sessions/join')
        .set('CF-Connecting-IP', me)
        .send({ sessionCode: 'ZZZZZZ', clientRequestId: randomUUID() });
    expect((await join()).status).toBe(404);
    expect((await join()).status).toBe(404);
    const res = await join();
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('그 밖의 API는 기본 한도, /api/health는 제한하지 않는다', async () => {
    const me = ip();
    for (let i = 0; i < 3; i++) {
      await http()
        .get('/api/sessions/1')
        .set('CF-Connecting-IP', me)
        .expect(401);
    }
    await http().get('/api/sessions/1').set('CF-Connecting-IP', me).expect(429);

    for (let i = 0; i < 6; i++) {
      await http().get('/api/health').set('CF-Connecting-IP', me).expect(200);
    }
  });
});
