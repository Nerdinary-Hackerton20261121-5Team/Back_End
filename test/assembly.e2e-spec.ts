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

// 실제 DB(.env의 DB_*, dev 테스트용 app_dev)에 붙여 조립 API를 확인한다.
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

  /** 참가자의 조립 조각과 정답 위치 (테스트에서만 DB로 확인) */
  async function piecesOf(sessionId: number, member: Member) {
    const source = await dataSource
      .getRepository(SourcePiece)
      .findOneByOrFail({ sessionId, participantId: member.participantId });
    return dataSource
      .getRepository(AssemblyPiece)
      .find({ where: { sourcePieceId: source.id } });
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

  it('조립 열기: ASSEMBLING, 4×4 판, 부재자 조각 자동 배치, 정답 위치는 숨김', async () => {
    const { sessionId, members } = await startedRoom(4);
    const away = members[3];
    await finishFocus(sessionId, members, [away]);

    const res = await board(sessionId, members[0].participantToken).expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      status: 'ASSEMBLING',
      boardRows: 4,
      boardCols: 4,
      totalPieces: 16,
      placedCount: 4, // 부재자 1명의 조각 4개
      completed: false,
    });
    expect(data.slots).toHaveLength(16);

    const auto = data.pieces.filter(
      (p: { autoPlaced: boolean }) => p.autoPlaced,
    );
    expect(auto).toHaveLength(4);
    const waiting = data.pieces.filter((p: { placed: boolean }) => !p.placed);
    expect(
      waiting.every((p: { position: unknown }) => p.position === null),
    ).toBe(true);
    expect(
      data.pieces.filter((p: { isMine: boolean }) => p.isMine),
    ).toHaveLength(4);

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

    // AC-054 다시 조회해도 중복 처리 없음
    const again = await board(sessionId, members[1].participantToken).expect(
      200,
    );
    expect(again.body.data.placedCount).toBe(4);
  });

  it('조각 놓기: 틀린 칸은 저장 안 함, 남의 조각 403, 정답 칸 저장, 모두 놓으면 팀 통과', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members);
    await board(sessionId, members[0].participantToken).expect(200);

    const [first, ...rest] = await piecesOf(sessionId, members[0]);
    const wrongTarget = first.position === 1 ? 2 : 1;

    const wrong = await place(
      sessionId,
      first.id,
      wrongTarget,
      members[0].participantToken,
    ).expect(200);
    expect(wrong.body.data).toMatchObject({
      correct: false,
      placed: false,
      placedCount: 0,
    });
    expect(['WRONG_POSITION', 'OCCUPIED']).toContain(wrong.body.data.reason);

    const notMine = await place(
      sessionId,
      first.id,
      first.position,
      members[1].participantToken,
    ).expect(403);
    expect(notMine.body.code).toBe('NOT_PIECE_OWNER');

    const ok = await place(
      sessionId,
      first.id,
      first.position,
      members[0].participantToken,
    ).expect(200);
    expect(ok.body.data).toMatchObject({
      correct: true,
      placed: true,
      placedCount: 1,
      completed: false,
    });

    // 같은 요청 재전송은 그대로
    const again = await place(
      sessionId,
      first.id,
      first.position,
      members[0].participantToken,
    ).expect(200);
    expect(again.body.data).toMatchObject({ correct: true, placedCount: 1 });

    // 나머지 조각을 모두 정답 칸에 놓으면 팀 통과
    let last: { completed: boolean; placedCount: number } | undefined;
    for (const p of rest) {
      last = (
        await place(sessionId, p.id, p.position, members[0].participantToken)
      ).body.data;
    }
    for (const m of members.slice(1)) {
      for (const p of await piecesOf(sessionId, m)) {
        last = (await place(sessionId, p.id, p.position, m.participantToken))
          .body.data;
      }
    }
    expect(last).toMatchObject({ completed: true, placedCount: 16 });

    const done = await board(sessionId, members[0].participantToken).expect(
      200,
    );
    expect(done.body.data).toMatchObject({
      status: 'COMPLETED',
      completed: true,
    });
  });

  it('5명이면 조립판 6행 4열, 맨 아래 두 행의 칸은 두 열짜리', async () => {
    const { sessionId, members } = await startedRoom(5);
    await finishFocus(sessionId, members);
    const res = await board(sessionId, members[0].participantToken).expect(200);
    expect(res.body.data).toMatchObject({ boardRows: 6, boardCols: 4 });
    const wide = res.body.data.slots.filter(
      (s: { colSpan: number }) => s.colSpan === 2,
    );
    expect(wide.map((s: { row: number }) => s.row).sort()).toEqual([
      4, 4, 5, 5,
    ]);
  });

  it('400: 범위 밖 칸, 숫자 아닌 값 / 404: 없는 조각', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members);
    const [mine] = await piecesOf(sessionId, members[0]);
    const token = members[0].participantToken;

    expect(
      (await place(sessionId, mine.id, 99, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, mine.id, 0, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, mine.id, 'abc', token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, 'abc', 1, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
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
        .getRepository(AssemblyPiece)
        .count({ where: { sessionId } }),
    ).toBe(0);
    await http()
      .get(`/api/sessions/${sessionId}`)
      .set('X-Participant-Token', members[0].participantToken)
      .expect(401);
  });
});
