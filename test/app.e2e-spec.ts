import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    // CommonModule의 ResponseInterceptor가 공통 응답 형식으로 감싼다
    return request(app.getHttpServer()).get('/').expect(200).expect({
      success: true,
      code: 'SUCCESS',
      message: '요청이 성공했습니다.',
      data: 'Hello World!',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
