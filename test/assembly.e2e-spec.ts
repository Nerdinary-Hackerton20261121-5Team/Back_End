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
// 조립판은 조각 격자(N행 × 2열)와 같고, 공부 중에 쓴 조각(source_piece)을 그대로 정답 칸에 놓는다.
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
      // 끝까지 있던 사람은 595초까지 얼굴이 인식돼 누적됐다고 둔다
      await dataSource.getRepository(Participant).update(
        { id: m.participantId },
        {
          lastHeartbeatAt: last,
          focusedMs: absent.includes(m) ? 0 : 595 * SEC,
        },
      );
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

  /** 세션의 조각을 정답 칸 순서로 */
  const piecesOf = (sessionId: number) =>
    dataSource.getRepository(SourcePiece).find({
      where: { sessionId },
      order: { position: 'ASC' },
    });

  it('집중이 끝나면 ASSEMBLING, 부재자 조각은 정답 칸에 자동 배치, 최종 복원도 확정', async () => {
    const { sessionId, members } = await startedRoom(4);
    const away = members[3];
    await finishFocus(sessionId, members, [away]);

    const res = await board(sessionId, members[0].participantToken).expect(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      status: 'ASSEMBLING',
      me: { participantId: members[0].participantId, isCreator: true },
      boardRows: 4,
      boardCols: 2,
      totalPieces: 8,
      placedCount: 2,
      completed: false,
    });
    expect(data.slots).toHaveLength(8);
    expect(data.slots[2]).toEqual({ position: 3, row: 1, col: 0, colSpan: 1 });

    const pieces = await piecesOf(sessionId);
    const awayPieces = pieces.filter(
      (p) => p.participantId === away.participantId,
    );
    expect(awayPieces).toHaveLength(2);
    for (const p of pieces) {
      const isAway = p.participantId === away.participantId;
      expect(p.placedAt !== null).toBe(isAway);
      expect(p.autoPlaced).toBe(isAway);
      const shown = data.pieces.find(
        (x: { pieceId: number }) => Number(x.pieceId) === Number(p.id),
      );
      expect(shown).toMatchObject({
        participantId: p.participantId,
        isMine: p.participantId === members[0].participantId,
        placed: isAway,
        // 정답 위치는 놓이기 전까지 숨긴다
        position: isAway ? p.position : null,
        autoPlaced: isAway,
        restoration: isAway ? 0 : 1,
      });
    }

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

    // AC-054 다시 조회해도 같은 결과 (자동 배치를 두 번 하지 않는다)
    const again = await board(sessionId, members[1].participantToken).expect(
      200,
    );
    expect(again.body.data).toMatchObject({
      status: 'ASSEMBLING',
      placedCount: 2,
    });
  });

  it('조각 놓기: 남의 조각 403, 틀린 칸·찬 칸은 저장 안 함, 모두 놓으면 COMPLETED', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members);
    await board(sessionId, members[0].participantToken).expect(200);

    const pieces = await piecesOf(sessionId);
    const tokenOf = new Map(
      members.map((m) => [Number(m.participantId), m.participantToken]),
    );
    const [first, ...rest] = pieces;
    const ownerToken = tokenOf.get(Number(first.participantId))!;
    const otherToken = members.find(
      (m) => Number(m.participantId) !== Number(first.participantId),
    )!.participantToken;

    expect(
      (await place(sessionId, first.id, first.position, otherToken).expect(403))
        .body.code,
    ).toBe('NOT_PIECE_OWNER');

    const wrong = await place(
      sessionId,
      first.id,
      rest[0].position,
      ownerToken,
    ).expect(200);
    expect(wrong.body.data).toMatchObject({
      correct: false,
      reason: 'WRONG_POSITION',
      placed: false,
      placedCount: 0,
      totalPieces: 8,
    });

    const right = await place(
      sessionId,
      first.id,
      first.position,
      ownerToken,
    ).expect(200);
    expect(right.body.data).toMatchObject({
      correct: true,
      reason: null,
      placed: true,
      placedCount: 1,
      completed: false,
    });

    // 이미 찬 칸에 다른 조각을 놓으면 OCCUPIED
    const occupied = await place(
      sessionId,
      rest[0].id,
      first.position,
      tokenOf.get(Number(rest[0].participantId))!,
    ).expect(200);
    expect(occupied.body.data).toMatchObject({
      correct: false,
      reason: 'OCCUPIED',
      placed: false,
    });

    // 같은 조각을 다시 정답 칸에 놓아도 개수는 그대로
    const repeat = await place(
      sessionId,
      first.id,
      first.position,
      ownerToken,
    ).expect(200);
    expect(repeat.body.data).toMatchObject({ placed: true, placedCount: 1 });

    let last;
    for (const p of rest) {
      last = await place(
        sessionId,
        p.id,
        p.position,
        tokenOf.get(Number(p.participantId))!,
      ).expect(200);
    }
    expect(last!.body.data).toMatchObject({
      placedCount: 8,
      totalPieces: 8,
      completed: true,
    });

    const after = await board(sessionId, members[0].participantToken).expect(
      200,
    );
    expect(after.body.data).toMatchObject({
      status: 'COMPLETED',
      placedCount: 8,
      completed: true,
    });
    const session = await dataSource
      .getRepository(Session)
      .findOneByOrFail({ id: sessionId });
    expect(session.completedAt).not.toBeNull();
  });

  it('모두 부재면 집중 종료 시 전부 자동 배치되어 바로 COMPLETED', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members, members);

    const res = await board(sessionId, members[0].participantToken).expect(200);
    expect(res.body.data).toMatchObject({
      status: 'COMPLETED',
      totalPieces: 8,
      placedCount: 8,
      completed: true,
    });
  });

  it('400: 숫자 아닌 값·0·칸 범위 밖 / 404: 다른 세션·없는 조각 ID', async () => {
    const { sessionId, members } = await startedRoom(4);
    await finishFocus(sessionId, members);
    const other = await startedRoom(4);
    await finishFocus(other.sessionId, other.members);
    const token = members[0].participantToken;
    const mine = (await piecesOf(sessionId)).find(
      (p) => Number(p.participantId) === Number(members[0].participantId),
    )!;
    const [foreign] = await piecesOf(other.sessionId);

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
      (await place(sessionId, mine.id, 9, token).expect(400)).body.code,
    ).toBe('INVALID_INPUT');
    expect(
      (await place(sessionId, foreign.id, 1, token).expect(404)).body.code,
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
