import { Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { CommonErrors } from '../exception/error-code.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
} from './api-response.decorators.js';
import { createSwaggerDocument } from './swagger.setup.js';

class ThingDto {
  @ApiProperty({ example: 1 })
  id: number;
}

const THING_NOT_FOUND = {
  code: 'THING_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '대상을 찾을 수 없습니다.',
};

@Controller('things')
class ThingsController {
  @Post()
  @ApiSuccessResponse(ThingDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(CommonErrors.INVALID_INPUT)
  create() {
    return { id: 1 };
  }

  @Get(':id')
  @ApiSuccessResponse(ThingDto)
  @ApiErrorResponses(CommonErrors.NOT_FOUND, THING_NOT_FOUND)
  findOne() {
    return { id: 1 };
  }
}

describe('Swagger 공통 응답 데코레이터', () => {
  async function document() {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    const doc = createSwaggerDocument(app);
    await app.close();
    return doc;
  }

  it('성공 응답의 data에 DTO 스키마를 넣는다', async () => {
    const doc = await document();
    const created = doc.paths['/things']?.post?.responses['201'] as {
      content: Record<
        string,
        { schema: { properties: Record<string, unknown> } }
      >;
    };
    const props = created.content['application/json'].schema.properties;

    expect(props.success).toMatchObject({ example: true });
    expect(props.code).toMatchObject({ example: 'SUCCESS' });
    expect(props.data).toEqual({ $ref: '#/components/schemas/ThingDto' });
  });

  it('같은 상태 코드의 에러는 한 응답에 예시로 묶고 500을 항상 붙인다', async () => {
    const doc = await document();
    const responses = doc.paths['/things/{id}']?.get?.responses as Record<
      string,
      { content: Record<string, { examples: Record<string, unknown> }> }
    >;

    expect(Object.keys(responses)).toEqual(
      expect.arrayContaining(['200', '404', '500']),
    );
    expect(
      Object.keys(responses['404'].content['application/json'].examples),
    ).toEqual(['NOT_FOUND', 'THING_NOT_FOUND']);
    expect(
      responses['500'].content['application/json'].examples.INTERNAL_ERROR,
    ).toMatchObject({
      value: { success: false, code: 'INTERNAL_ERROR', data: null },
    });
  });

  it('X-Participant-Token Authorize 스키마를 등록한다', async () => {
    const doc = await document();

    expect(
      doc.components?.securitySchemes?.['participant-token'],
    ).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'X-Participant-Token',
    });
  });
});
