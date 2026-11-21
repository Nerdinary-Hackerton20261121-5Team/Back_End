import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Session } from '../src/sessions/entities/session.entity.js';
import { Image } from '../src/storage/entities/image.entity.js';

// 실제 DB(.env의 DB_*)에 붙여 이미지 업로드 → 방 이미지 지정 흐름을 확인한다.
// S3 키가 없으면 저장소는 메모리 디스크다. 만든 세션·이미지 행은 끝나면 지운다.
// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

describe('이미지 업로드·방 이미지 지정 API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const sessions: number[] = [];
  const images: number[] = [];

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
    // 세션이 이미지를 가리키므로 세션부터 지운다
    if (sessions.length)
      await dataSource.getRepository(Session).delete(sessions);
    if (images.length)
      await dataSource.getRepository(Image).delete({ id: In(images) });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  interface Member {
    participantId: number;
    participantToken: string;
    sessionCode: string;
  }

  /** people명 방. members[0]이 개설자 */
  async function room(people = 1) {
    const res = await http()
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 6,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    const sessionId = res.body.data.sessionId as number;
    sessions.push(sessionId);
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
    return { sessionId, members };
  }

  async function upload(token: string) {
    const res = await http()
      .post('/api/images')
      .set('X-Participant-Token', token)
      .attach('file', PNG, 'a.png')
      .expect(201);
    images.push(res.body.data.imageId);
    return res.body.data as {
      imageId: number;
      source: string;
      url: string;
      thumbnailUrl: string;
    };
  }

  const setImage = (sessionId: number, imageId: unknown, token: string) =>
    http()
      .patch(`/api/sessions/${sessionId}/image`)
      .set('X-Participant-Token', token)
      .send({ imageId });

  const detail = (sessionId: number, token: string) =>
    http()
      .get(`/api/sessions/${sessionId}`)
      .set('X-Participant-Token', token)
      .expect(200);

  it('401: 토큰 없이 업로드하면 저장하지 않는다', async () => {
    const before = await dataSource.getRepository(Image).count();
    const res = await http()
      .post('/api/images')
      .attach('file', PNG, 'a.png')
      .expect(401);
    expect(res.body.code).toBe('TOKEN_REQUIRED');
    expect(await dataSource.getRepository(Image).count()).toBe(before);
  });

  it('업로드 → images에 UPLOAD 행, 응답에 key 없음 → 개설자가 지정 → 세션 조회에 image', async () => {
    const { sessionId, members } = await room(2);
    const [creator, guest] = members;

    expect(
      (await detail(sessionId, creator.participantToken)).body.data.image,
    ).toBeNull();

    // 참가자는 누구나 올릴 수 있다
    const uploaded = await upload(guest.participantToken);
    expect(Object.keys(uploaded).sort()).toEqual([
      'imageId',
      'source',
      'thumbnailUrl',
      'url',
    ]);
    expect(uploaded.source).toBe('UPLOAD');
    expect(uploaded.url).toContain('rs:fit:1920:1920');
    expect(uploaded.thumbnailUrl).toContain('rs:fit:400:400');
    const row = await dataSource
      .getRepository(Image)
      .findOneByOrFail({ id: uploaded.imageId });
    expect(row.source).toBe('UPLOAD');
    expect(row.imageKey).toMatch(/^[0-9a-f-]{36}\.png$/);

    // 지정은 개설자만
    expect(
      (
        await setImage(
          sessionId,
          uploaded.imageId,
          guest.participantToken,
        ).expect(403)
      ).body.code,
    ).toBe('NOT_CREATOR');

    const set = await setImage(
      sessionId,
      uploaded.imageId,
      creator.participantToken,
    ).expect(200);
    expect(set.body.data).toEqual(uploaded);

    // 다른 참가자도 세션 조회로 같은 이미지를 받는다
    expect(
      (await detail(sessionId, guest.participantToken)).body.data.image,
    ).toEqual(uploaded);

    // 다시 보내면 바꾼다
    const second = await upload(creator.participantToken);
    await setImage(sessionId, second.imageId, creator.participantToken).expect(
      200,
    );
    expect(
      (await detail(sessionId, creator.participantToken)).body.data.image
        .imageId,
    ).toBe(second.imageId);
  });

  it('400 잘못된 imageId / 404 없는 이미지 / 403 다른 방 경로', async () => {
    const { sessionId, members } = await room();
    const token = members[0].participantToken;
    for (const bad of [0, -1, 'abc', null]) {
      expect(
        (await setImage(sessionId, bad, token).expect(400)).body.code,
      ).toBe('INVALID_INPUT');
    }
    expect(
      (await setImage(sessionId, 999999999, token).expect(404)).body.code,
    ).toBe('IMAGE_NOT_FOUND');

    const other = await room();
    const img = await upload(token);
    expect(
      (await setImage(other.sessionId, img.imageId, token).expect(403)).body
        .code,
    ).toBe('NOT_SESSION_PARTICIPANT');
  });

  it('409: 다른 방이 쓰는 업로드 이미지는 지정할 수 없고, 기본 이미지는 함께 쓸 수 있다', async () => {
    const a = await room();
    const b = await room();
    const img = await upload(a.members[0].participantToken);
    await setImage(
      a.sessionId,
      img.imageId,
      a.members[0].participantToken,
    ).expect(200);
    expect(
      (
        await setImage(
          b.sessionId,
          img.imageId,
          b.members[0].participantToken,
        ).expect(409)
      ).body.code,
    ).toBe('IMAGE_IN_USE');

    const preset = await dataSource.getRepository(Image).save(
      dataSource.getRepository(Image).create({
        source: 'DEFAULT',
        name: 'e2e 기본 이미지',
        imageUrl: 'https://example.com/default.png',
      }),
    );
    images.push(preset.id);
    for (const r of [a, b]) {
      const res = await setImage(
        r.sessionId,
        preset.id,
        r.members[0].participantToken,
      ).expect(200);
      expect(res.body.data).toEqual({
        imageId: preset.id,
        source: 'DEFAULT',
        url: 'https://example.com/default.png',
        thumbnailUrl: 'https://example.com/default.png',
      });
    }
  });

  it('409: 시작한 방은 이미지를 바꿀 수 없다', async () => {
    const { sessionId, members } = await room(4);
    const token = members[0].participantToken;
    const img = await upload(token);
    await http()
      .post(`/api/sessions/${sessionId}/start`)
      .set('X-Participant-Token', token)
      .expect(200);
    expect(
      (await setImage(sessionId, img.imageId, token).expect(409)).body.code,
    ).toBe('IMAGE_LOCKED_AFTER_START');
  });
});
