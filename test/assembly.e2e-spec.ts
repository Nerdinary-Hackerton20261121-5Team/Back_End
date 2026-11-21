import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { SourcePiece } from '../src/puzzle/entities/source-piece.entity.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 조립 API를 확인한다.
// 시작 API가 조립 조각(assembly_piece)을 만들지 않으므로, 집중이 끝나면 조립판은 비어 있고 바로 팀 통과가 된다.
// 집중 시간이 끝난 상황은 DB의 시각을 과거로 옮겨 만든다. 만든 세션은 끝나면 지운다.
describe('조립·종료 API (e2e)', () => {
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

  interface Member {
    participantId: number;
    participantToken: string;
  }

  /** people명 방을 만들고 시작한다. members[0]이 개설자 */
  async function startedRoom(people = 4) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 6,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    const sessionId = res.body.data.sessionId as number;
    created.push(sessionId);
    const members: Member[] = [res.body.data];
    for (let i = 1; i < people; i++) {
      const joined = await http()
        .post('/api/sessions/join')
        .send({
          sessionCode: res.body.data.sessionCode,
          clientRequestId: randomUUID(),
        })
        .expect(201);
      members.push(joined.body.data);
    }
    await http()
      .post(`/api/sessions/${sessionId}/start`)
      .set('X-Participant-Token', members[0].participantToken)
      .expect(200);
    return { sessionId, members };
  }

  /**
   * 집중 시간이 끝난 상황으로 만든다 (15분 전 시작, 목표 10분 → 5분 전 종료).
   * 단절 기준(기본 90초)보다 긴 세션이어야 끊김을 판정할 수 있다.
   * absent에 든 참가자는 시작 직후부터 신호가 없던 것으로, 나머지는 종료 5초 전까지 신호를 보낸 것으로 둔다.
   */
  async function finishFocus(
    sessionId: number,
    members: Member[],
    absent: Member[] = [],
  ) {
    const startedAt = new Date(Date.now() - 900 * SEC);
    await dataSource.getRepository(Session).update(
      { id: sessionId },
      {
        goalSeconds: 600,
        startedAt,
        endsAt: new Date(startedAt.getTime() + 600 * SEC),
      },
    );
    for (const m of members) {
      const last = absent.includes(m)
        ? startedAt
        : new Date(startedAt.getTime() + 595 * SEC);
      await dataSource
        .getRepository(Participant)
        .update({ id: m.participantId }, { lastHeartbeatAt: last });
    }
  }

  const board = (sessionId: number, token: string) =>
    http()
      .get(`/api/sessions/${sessionId}/assembly`)
      .set('X-Participant-Token', token);
  const place = (
    sessionId: number,
    pieceId: number | string,
    targetPosition: unknown,
    token: string,
  ) =>
    http()
      .patch(`/api/sessions/${sessionId}/assembly/pieces/${pieceId}`)
      .set('X-Participant-Token', token)
      .send({ targetPosition });

  it('409: 집중 중에는 조립판이 열리지 않는다', async () => {
    const { sessionId, members } = await startedRoom();
    const res = await board(sessionId, members[0].participantToken).expect(409);
    expect(res.body.code).toBe('ASSEMBLY_NOT_OPEN');
  });

  it('집중이 끝나면 조립 조각이 없으므로 바로 팀 통과(COMPLETED), 최종 복원도는 확정', async () => {
    const { sessionId, members } = await startedRoom(4);
    const away = members[3];
    await finishFocus(sessionId, members, [away]);

    const res = await board(sessionId, members[0].participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      status: 'COMPLETED',
      boardRows: 8,
      boardCols: 4,
      totalPieces: 0,
      placedCount: 0,
      completed: true,
      slots: [],
      pieces: [],
    });

    // 최종 복원도: 끝까지 있던 사람 1, 부재자 0
    const final = await dataSource
      .getRepository(Participant)
      .find({ where: { sessionId } });
    expect(
      final.find((p) => p.id === away.participantId)?.finalRestoration,
    ).toBe(0);
    expect(
      final.find((p) => p.id === members[0].participantId)?.finalRestoration,
    ).toBe(1);

    const session = await dataSource
      .getRepository(Session)
      .findOneByOrFail({ id: sessionId });
    expect(session.completedAt).not.toBeNull();
    // 조각(source_piece)은 결과 화면용으로 그대로 남는다
    expect(
      await dataSource
        .getRepository(SourcePiece)
        .count({ where: { sessionId } }),
    ).toBe(8);

    // AC-054 다시 조회해도 같은 결과
    const again = await board(sessionId, members[1].participantToken).expect(
      200,
    );
    expect(again.body.data).toMatchObject({
      status: 'COMPLETED',
      totalPieces: 0,
    });
  });

  it('400: 숫자 아닌 값·0 / 404: 조립 조각이 없으므로 어떤 조각 ID든 없음', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members);
    const token = members[0].participantToken;
    const [source] = await dataSource
      .getRepository(SourcePiece)
      .find({ where: { sessionId }, take: 1 });

    expect(
      (await place(sessionId, source.id, 0, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, source.id, 'abc', token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, 'abc', 1, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, source.id, 1, token).expect(404)).body.code,
    ).toBe('PIECE_NOT_FOUND');
    expect(
      (await place(sessionId, 999999999, 1, token).expect(404)).body.code,
    ).toBe('PIECE_NOT_FOUND');
  });

  it('방 삭제: 개설자가 아니면 403, 개설자면 200 후 모든 자료 삭제·토큰 무효', async () => {
    const { sessionId, members } = await startedRoom(4);

    const denied = await http()
      .delete(`/api/sessions/${sessionId}`)
      .set('X-Participant-Token', members[1].participantToken)
      .expect(403);
    expect(denied.body.code).toBe('NOT_CREATOR');

    const res = await http()
      .delete(`/api/sessions/${sessionId}`)
      .set('X-Participant-Token', members[0].participantToken)
      .expect(200);
    expect(res.body.data).toEqual({ sessionId, deleted: true });

    expect(
      await dataSource
        .getRepository(Participant)
        .count({ where: { sessionId } }),
    ).toBe(0);
    expect(
      await dataSource
        .getRepository(SourcePiece)
        .count({ where: { sessionId } }),
    ).toBe(0);
    await http()
      .get(`/api/sessions/${sessionId}`)
      .set('X-Participant-Token', members[0].participantToken)
      .expect(401);
  });
});
