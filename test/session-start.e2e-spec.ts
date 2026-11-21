import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AssemblyPiece } from '../src/assembly/entities/assembly-piece.entity.js';
import { SourcePiece } from '../src/puzzle/entities/source-piece.entity.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 시작 API를 확인한다. 만든 세션은 끝나면 지운다.
describe('세션 시작 API (e2e)', () => {
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

  /** 정원 maxParticipants인 방을 만들고 (people - 1)명을 더 입장시킨다 */
  async function roomWith(people: number, maxParticipants = 6) {
    const res = await http()
      .post('/api/sessions')
      .send({ goalSeconds: 60, maxParticipants, clientRequestId: randomUUID() })
      .expect(201);
    const room = res.body.data as {
      sessionId: number;
      sessionCode: string;
      participantToken: string;
    };
    created.push(room.sessionId);
    const others: string[] = [];
    for (let i = 1; i < people; i++) {
      const joined = await http()
        .post('/api/sessions/join')
        .send({ sessionCode: room.sessionCode, clientRequestId: randomUUID() })
        .expect(201);
      others.push(joined.body.data.participantToken);
    }
    return { ...room, others };
  }

  const start = (sessionId: number | string, token?: string) => {
    const req = http().post(`/api/sessions/${sessionId}/start`);
    return token ? req.set('X-Participant-Token', token) : req;
  };

  it('200: 4명 방 시작 → 명단 고정, 종료 시각, 원조각 4개·조립 조각 16개', async () => {
    const room = await roomWith(4);
    const res = await start(room.sessionId, room.participantToken).expect(200);
    const data = res.body.data;

    expect(data).toMatchObject({
      sessionId: room.sessionId,
      status: 'FOCUSING',
      goalSeconds: 60,
      participantCount: 4,
      gridRows: 2,
      gridCols: 2,
      splitCount: 4,
      assemblyPieceCount: 16,
      alreadyStarted: false,
    });
    expect(Date.parse(data.endsAt) - Date.parse(data.startedAt)).toBe(60_000);

    const sources = await dataSource.getRepository(SourcePiece).find({
      where: { sessionId: room.sessionId },
      order: { position: 'ASC' },
    });
    expect(sources.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    expect(new Set(sources.map((s) => s.participantId)).size).toBe(4);

    const pieces = await dataSource.getRepository(AssemblyPiece).find({
      where: { sessionId: room.sessionId },
      order: { position: 'ASC' },
    });
    expect(pieces.map((p) => p.position)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(pieces.every((p) => p.placedAt === null)).toBe(true);

    const participants = await dataSource
      .getRepository(Participant)
      .find({ where: { sessionId: room.sessionId } });
    expect(
      participants.every(
        (p) => p.lastHeartbeatAt?.getTime() === Date.parse(data.startedAt),
      ),
    ).toBe(true);
  });

  it('5명이면 3행 2열 격자, 조립 조각 20개', async () => {
    const room = await roomWith(5);
    const res = await start(room.sessionId, room.participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      participantCount: 5,
      gridRows: 3,
      gridCols: 2,
      assemblyPieceCount: 20,
    });
  });

  it.each([1, 3])(
    '400: %i명이면 최소 인원 부족으로 시작할 수 없다',
    async (people) => {
      const room = await roomWith(people);
      const res = await start(room.sessionId, room.participantToken).expect(
        400,
      );
      expect(res.body.code).toBe('NOT_ENOUGH_PARTICIPANTS');
      const pieces = await dataSource
        .getRepository(AssemblyPiece)
        .count({ where: { sessionId: room.sessionId } });
      expect(pieces).toBe(0);
    },
  );

  it('AC-010 다시 시작해도 처음 시작 기준을 그대로 돌려준다', async () => {
    const room = await roomWith(4);
    const first = await start(room.sessionId, room.participantToken).expect(
      200,
    );
    const again = await start(room.sessionId, room.participantToken).expect(
      200,
    );

    expect(again.body.data).toMatchObject({
      startedAt: first.body.data.startedAt,
      endsAt: first.body.data.endsAt,
      participantCount: 4,
      alreadyStarted: true,
    });
    const count = await dataSource
      .getRepository(AssemblyPiece)
      .count({ where: { sessionId: room.sessionId } });
    expect(count).toBe(16);
  });

  it('AC-005 시작 후 입장은 409, 조회하면 FOCUSING', async () => {
    const room = await roomWith(4);
    await start(room.sessionId, room.participantToken).expect(200);

    const res = await http()
      .post('/api/sessions/join')
      .send({ sessionCode: room.sessionCode, clientRequestId: randomUUID() })
      .expect(409);
    expect(res.body.code).toBe('SESSION_ALREADY_STARTED');

    const detail = await http()
      .get(`/api/sessions/${room.sessionId}`)
      .set('X-Participant-Token', room.participantToken)
      .expect(200);
    expect(detail.body.data).toMatchObject({
      status: 'FOCUSING',
      participantCount: 4,
    });
  });

  it('403: 개설자가 아닌 참가자', async () => {
    const room = await roomWith(2);
    const res = await start(room.sessionId, room.others[0]).expect(403);
    expect(res.body.code).toBe('NOT_CREATOR');
  });

  it('401: 토큰 없음', async () => {
    const room = await roomWith(1);
    const res = await start(room.sessionId).expect(401);
    expect(res.body.code).toBe('TOKEN_REQUIRED');
  });

  it('403: 다른 세션 시작 시도', async () => {
    const mine = await roomWith(1);
    const other = await roomWith(1);
    const res = await start(other.sessionId, mine.participantToken).expect(403);
    expect(res.body.code).toBe('NOT_SESSION_PARTICIPANT');
  });

  it('400: 숫자가 아닌 세션 ID', async () => {
    const res = await start('abc').expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });
});
