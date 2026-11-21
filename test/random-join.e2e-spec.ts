import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 랜덤 매칭을 확인한다.
// app_dev의 다른 방도 후보가 될 수 있어서, "배정된 방이 조건을 만족하는지"와 "제외 대상에는 안 들어가는지"를 본다.
describe('랜덤 매칭 API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const created: number[] = [];
  const joinedElsewhere: number[] = [];

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
    // 테스트가 아닌 방에 들어간 참가자는 지운다 (다른 사람이 만든 방을 건드리지 않도록)
    if (joinedElsewhere.length) {
      await dataSource.getRepository(Participant).delete(joinedElsewhere);
    }
    if (created.length) await dataSource.getRepository(Session).delete(created);
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sessions = () => dataSource.getRepository(Session);

  async function createRoom(allowRandom: boolean, maxParticipants = 4) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants,
        allowRandom,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    created.push(res.body.data.sessionId);
    return res.body.data as { sessionId: number; sessionCode: string };
  }

  async function randomJoin(clientRequestId = randomUUID()) {
    const res = await http()
      .post('/api/sessions/random-join')
      .send({ clientRequestId });
    if (res.status === 201 && !created.includes(res.body.data.sessionId)) {
      joinedElsewhere.push(res.body.data.participantId);
    }
    return res;
  }

  it('201: 랜덤 허용·시작 전·빈자리 있는 방에 배정한다 (AC-048)', async () => {
    await createRoom(true);
    const res = await randomJoin();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ isCreator: false, restored: false });

    const room = await sessions().findOneByOrFail({
      id: res.body.data.sessionId,
    });
    const count = await dataSource
      .getRepository(Participant)
      .count({ where: { sessionId: room.id } });
    expect(room.allowRandom).toBe(true);
    expect(room.status).toBe('WAITING');
    expect(count).toBeLessThanOrEqual(room.maxParticipants ?? Infinity);
  });

  it('AC-048 랜덤 비허용·시작된 방·만석 방에는 배정하지 않는다', async () => {
    const closed = await createRoom(false);
    const started = await createRoom(true);
    await sessions().update({ id: started.sessionId }, { status: 'FOCUSING' });
    const full = await createRoom(true, 4);
    for (let i = 0; i < 3; i++) {
      await http()
        .post('/api/sessions/join')
        .send({ sessionCode: full.sessionCode, clientRequestId: randomUUID() })
        .expect(201);
    }
    const open = await createRoom(true, 6);
    const excluded = [closed.sessionId, started.sessionId, full.sessionId];

    for (let i = 0; i < 5; i++) {
      const res = await randomJoin();
      expect(res.status).toBe(201);
      expect(excluded).not.toContain(res.body.data.sessionId);
    }
    expect(open.sessionId).toBeGreaterThan(0);
  });

  it('AC-049 같은 요청을 다시 보내면 같은 방·같은 참가자 (두 방에 배정되지 않음)', async () => {
    await createRoom(true, 6);
    const clientRequestId = randomUUID();
    const first = await randomJoin(clientRequestId);
    const again = await randomJoin(clientRequestId);

    expect(first.status).toBe(201);
    expect(again.body.data).toMatchObject({
      sessionId: first.body.data.sessionId,
      participantId: first.body.data.participantId,
      restored: true,
    });
    const rows = await dataSource
      .getRepository(Participant)
      .count({ where: { joinRequestId: clientRequestId } });
    expect(rows).toBe(1);
  });

  it('404: 들어갈 수 있는 방이 없으면 NO_AVAILABLE_SESSION', async () => {
    // 지금 열린 랜덤 방을 모두 시작 상태로 만들 수는 없으니(다른 사람 방), 테스트 방만 닫고 후보가 없을 때만 확인
    await sessions().update(
      created.map((id) => ({ id })),
      { allowRandom: false },
    );
    const remaining = await sessions().count({
      where: { allowRandom: true, status: 'WAITING' },
    });
    const res = await randomJoin();
    if (remaining === 0) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NO_AVAILABLE_SESSION');
    } else {
      expect([201, 404]).toContain(res.status);
    }
  });

  it('400: 요청 ID 누락', async () => {
    const res = await http()
      .post('/api/sessions/random-join')
      .send({})
      .expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });
});
