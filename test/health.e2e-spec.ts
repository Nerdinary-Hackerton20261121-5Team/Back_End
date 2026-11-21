import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// 실제 HTTP로 /api/health를 확인한다. DB 연결 없이 뜨는 앱이어야 하고,
// 게이트웨이가 /api/* 를 경로 그대로 넘기므로 'api' 접두사가 붙은 경로만 응답해야 한다.
describe('GET /api/health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts와 같은 전역 접두사 (테스트 앱은 main.ts를 거치지 않는다)
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('200과 { status: "ok", commit }을 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body).toEqual({
      status: 'ok',
      commit: expect.any(String),
    });
  });

  it('접두사 없는 /health는 404', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });
});
