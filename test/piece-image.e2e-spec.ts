import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';
import { Image } from '../src/storage/entities/image.entity.js';

// 실제 DB(.env의 DB_*)에 붙여 조각 이미지 API를 확인한다. 저장소는 S3 설정이 없으면 메모리 디스크다.
describe('조각 이미지 API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const created: number[] = [];
  const imageKeys: string[] = [];
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
    for (const imageKey of imageKeys) {
      await dataSource.getRepository(Image).delete({ imageKey });
    }
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** 2열 × 4행 고대비 무늬 PNG */
  async function puzzlePng(): Promise<Buffer> {
    const rects: string[] = [];
    for (let i = 0; i < 8; i++) {
      const x = (i % 2) * 300;
      const y = Math.floor(i / 2) * 300;
      rects.push(
        `<rect x="${x}" y="${y}" width="300" height="300" fill="hsl(${i * 45},80%,45%)"/>`,
      );
      for (let s = 0; s < 12; s++) {
        rects.push(
          `<rect x="${x + 50 + s * 16}" y="${y + 90}" width="8" height="120" fill="#fff"/>`,
        );
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200">${rects.join('')}</svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  async function upload(): Promise<string> {
    const res = await http()
      .post('/api/images')
      .attach('file', await puzzlePng(), 'puzzle.png')
      .expect(201);
    // 앱 전역 응답 형식: { data: { key, ... } }
    const key = res.body.data.key as string;
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    imageKeys.push(key);
    return key;
  }

  interface Member {
    participantId: number;
    participantToken: string;
  }

  async function startedRoom(body: Record<string, unknown>) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 600,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
        ...body,
      })
      .expect(201);
    const sessionId = res.body.data.sessionId as number;
    created.push(sessionId);
    const members: Member[] = [res.body.data];
    for (let i = 1; i < 4; i++) {
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

  const pieceImage = (
    sessionId: number,
    position: number | string,
    token?: string,
  ) => {
    const req = http()
      .get(`/api/sessions/${sessionId}/pieces/${position}/image`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    return token ? req.set('X-Participant-Token', token) : req;
  };

  /** 가운데 가로줄의 밝기 변화량 (선명할수록 크다) */
  async function sharpness(webp: Buffer): Promise<number> {
    const { data, info } = await sharp(webp)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const y = Math.floor(info.height / 2);
    let sum = 0;
    for (let x = 1; x < info.width; x++) {
      const a = (y * info.width + x) * info.channels;
      sum += Math.abs(data[a] - data[a - info.channels]);
    }
    return sum;
  }

  /** 시작 시각을 secondsAgo초 전으로 옮겨 복원도를 만든다 (모두 연결 유지) */
  async function rewind(sessionId: number, secondsAgo: number) {
    const startedAt = new Date(Date.now() - secondsAgo * SEC);
    await dataSource
      .getRepository(Session)
      .update(
        { id: sessionId },
        { startedAt, endsAt: new Date(startedAt.getTime() + 600 * SEC) },
      );
    await dataSource
      .getRepository(Participant)
      .update({ sessionId }, { lastHeartbeatAt: new Date() });
  }

  it('업로드 key로 방을 만들면 images 행이 생기고 진행판에 이미지 경로·모양이 나온다', async () => {
    const imageKey = await upload();
    const { sessionId, members } = await startedRoom({ imageKey });

    const session = await dataSource
      .getRepository(Session)
      .findOneOrFail({ where: { id: sessionId }, relations: { image: true } });
    expect(session.image).toMatchObject({ source: 'UPLOAD', imageKey });

    const board = await http()
      .get(`/api/sessions/${sessionId}/board`)
      .set('X-Participant-Token', members[0].participantToken)
      .expect(200);
    const data = board.body.data;
    expect(data).toMatchObject({ hasImage: true, padRatio: 0.2 });
    expect(data.pieces[0]).toMatchObject({
      imagePath: `/api/sessions/${sessionId}/pieces/1/image`,
      edges: { top: 0, left: 0 },
    });
    // 이웃 조각끼리 맞물린다 (1번 오른쪽 ↔ 2번 왼쪽, 1번 아래 ↔ 3번 위)
    const [p1, p2, p3] = data.pieces;
    expect(p2.edges.left).toBe(-p1.edges.right);
    expect(p3.edges.top).toBe(-p1.edges.bottom);
    // 원본 주소는 어디에도 없다
    expect(JSON.stringify(data)).not.toContain(imageKey);
  });

  it('내 조각은 선명, 남의 조각은 블러 / 같은 사람의 조각 2개는 같은 단계 / 100%여도 블러', async () => {
    const imageKey = await upload();
    const { sessionId, members } = await startedRoom({ imageKey });
    await rewind(sessionId, 150); // 600초 중 150초 = 25%
    const host = members[0].participantToken;

    const mine = await pieceImage(sessionId, 1, host).expect(200);
    expect(mine.headers['content-type']).toBe('image/webp');
    expect(mine.headers['x-piece-blur-level']).toBe('none');
    const meta = await sharp(mine.body).metadata();
    expect(meta).toMatchObject({ format: 'webp', hasAlpha: true });

    // 3·4번은 두 번째 참가자 조각: 같은 단계(25% → 2)
    const other3 = await pieceImage(sessionId, 3, host).expect(200);
    const other4 = await pieceImage(sessionId, 4, host).expect(200);
    expect(other3.headers['x-piece-blur-level']).toBe('2');
    expect(other4.headers['x-piece-blur-level']).toBe('2');

    // 주인이 보면 선명 → 남이 받은 이미지는 그보다 훨씬 흐리다
    const own3 = await pieceImage(
      sessionId,
      3,
      members[1].participantToken,
    ).expect(200);
    expect(own3.headers['x-piece-blur-level']).toBe('none');
    expect(await sharpness(other3.body)).toBeLessThan(
      (await sharpness(own3.body)) / 3,
    );

    // 100%(목표 시간 경과 후 최종 복원도 1)여도 남에게는 블러
    await dataSource
      .getRepository(Participant)
      .update({ sessionId }, { finalRestoration: 1 });
    const done = await pieceImage(sessionId, 3, host).expect(200);
    expect(done.headers['x-piece-blur-level']).toBe('10');
    expect(await sharpness(done.body)).toBeLessThan(
      (await sharpness(own3.body)) / 3,
    );
  });

  it('404: 이미지 없는 세션·없는 칸 / 401·403·400', async () => {
    const { sessionId, members } = await startedRoom({});
    const host = members[0].participantToken;
    expect(
      (await pieceImage(sessionId, 1, host).expect(404)).body.toString(),
    ).toContain('SESSION_IMAGE_NOT_SET');

    const withImage = await startedRoom({ imageKey: await upload() });
    const token = withImage.members[0].participantToken;
    expect(
      (
        await pieceImage(withImage.sessionId, 99, token).expect(404)
      ).body.toString(),
    ).toContain('PIECE_NOT_FOUND');
    await pieceImage(withImage.sessionId, 1).expect(401);
    await pieceImage(withImage.sessionId, 1, host).expect(403);
    await pieceImage(withImage.sessionId, 'abc', token).expect(400);
  });

  it('400: imageKey 형식이 틀리거나 imageKey·imageId를 같이 보내면', async () => {
    const send = (body: Record<string, unknown>) =>
      http()
        .post('/api/sessions')
        .send({
          goalSeconds: 600,
          maxParticipants: 4,
          clientRequestId: randomUUID(),
          ...body,
        })
        .expect(400);
    expect((await send({ imageKey: '../etc/passwd' })).body.code).toBe(
      'INVALID_INPUT',
    );
    expect(
      (await send({ imageKey: `${randomUUID()}.png`, imageId: 1 })).body.code,
    ).toBe('INVALID_INPUT');
    expect((await send({ imageId: 999999999 })).body.code).toBe(
      'INVALID_INPUT',
    );
  });
});
