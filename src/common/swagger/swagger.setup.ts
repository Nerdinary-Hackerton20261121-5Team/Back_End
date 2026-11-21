import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import {
  PARTICIPANT_TOKEN_HEADER,
  PARTICIPANT_TOKEN_SECURITY,
} from '../http-headers.js';

export const SWAGGER_PATH = 'docs';

// 심사위원이 위에서부터 순서대로 호출할 수 있게 안내한다. API가 추가되면 순서를 채운다.
const DESCRIPTION = `
집중 세션 API

**공통 응답 형식**
- 성공: \`{ "success": true, "code": "SUCCESS", "message": "...", "data": { ... } }\`
- 실패: \`{ "success": false, "code": "INVALID_INPUT", "message": "...", "data": null }\`
- 생성은 201, 조회·수정은 200, 잘못된 입력 400, 없는 대상 404, 서버 오류 500

**참가자 토큰**
1. 세션 생성 또는 입장 응답의 \`participantToken\`을 복사한다.
2. 오른쪽 위 **Authorize** 버튼에 붙여 넣는다. 이후 요청에 \`${PARTICIPANT_TOKEN_HEADER}\` 헤더로 실린다.
`.trim();

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Hackathon API')
    .setDescription(DESCRIPTION)
    .setVersion('0.0.1')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: PARTICIPANT_TOKEN_HEADER,
        description: '세션 생성·입장 때 받은 participantToken',
      },
      PARTICIPANT_TOKEN_SECURITY,
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Swagger UI를 /docs 에 띄운다 (게이트웨이가 /docs, /docs/*, /docs-json을 이 서버로 보낸다). */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, createSwaggerDocument(app), {
    swaggerOptions: { persistAuthorization: true },
  });
}
