import {
  Body,
  Controller,
  Get,
  INestApplication,
  Logger,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsPositive } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { CommonModule } from '../src/common/common.module.js';
import { BusinessException } from '../src/common/exception/business.exception.js';
import { CommonErrors } from '../src/common/exception/error-code.js';

class CreateThingDto {
  @IsInt()
  @IsPositive()
  goalSeconds: number;
}

// 공통 응답·예외 처리를 실제 HTTP로 확인하기 위한 테스트 전용 컨트롤러
@Controller('things')
class ThingsController {
  @Post()
  create(@Body() body: CreateThingDto) {
    return { goalSeconds: body.goalSeconds };
  }

  @Get('boom')
  boom(): never {
    throw new Error('internal detail that must not leak');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    if (id !== 1) throw new BusinessException(CommonErrors.NOT_FOUND);
    return { id };
  }
}

describe('공통 응답·전역 예외 처리 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CommonModule],
      controllers: [ThingsController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api'); // main.ts와 같은 접두사
    await app.init();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('200: 조회 성공은 공통 형식으로 감싼다', async () => {
    const res = await http().get('/api/things/1').expect(200);
    expect(res.body).toEqual({
      success: true,
      code: 'SUCCESS',
      message: '요청이 성공했습니다.',
      data: { id: 1 },
    });
  });

  it('201: 생성 성공', async () => {
    const res = await http()
      .post('/api/things')
      .send({ goalSeconds: 60 })
      .expect(201);
    expect(res.body).toMatchObject({
      success: true,
      data: { goalSeconds: 60 },
    });
  });

  it('400: DTO 검증 실패 (음수)', async () => {
    const res = await http()
      .post('/api/things')
      .send({ goalSeconds: -1 })
      .expect(400);
    expect(res.body).toMatchObject({
      success: false,
      code: 'INVALID_INPUT',
      data: null,
    });
    expect(res.body.message).toContain('goalSeconds');
  });

  it('400: DTO에 없는 필드', async () => {
    const res = await http()
      .post('/api/things')
      .send({ goalSeconds: 60, hacker: true })
      .expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('400: 빈 본문', async () => {
    const res = await http().post('/api/things').send({}).expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('400: 깨진 JSON', async () => {
    const res = await http()
      .post('/api/things')
      .set('Content-Type', 'application/json')
      .send('{"goalSeconds": ')
      .expect(400);
    expect(res.body).toMatchObject({ success: false, code: 'INVALID_INPUT' });
  });

  it('400: 숫자 자리에 문자열 ID', async () => {
    const res = await http().get('/api/things/abc').expect(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('404: 없는 ID (BusinessException)', async () => {
    const res = await http().get('/api/things/999').expect(404);
    expect(res.body).toEqual({
      success: false,
      code: 'NOT_FOUND',
      message: '요청한 리소스를 찾을 수 없습니다.',
      data: null,
    });
  });

  it('404: 없는 경로', async () => {
    const res = await http().get('/api/nope').expect(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });

  it('500: 예상 못 한 예외는 내부 메시지를 숨긴다', async () => {
    const res = await http().get('/api/things/boom').expect(500);
    expect(res.body).toEqual({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
      data: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
  });
});
