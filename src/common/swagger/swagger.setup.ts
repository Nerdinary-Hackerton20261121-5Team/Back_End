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
- 생성은 201, 조회·수정은 200, 잘못된 입력 400, 토큰 없음 401, 권한 없음 403, 없는 대상 404, 상태 충돌 409, 요청 과다 429, 서버 오류 500

**참가자 토큰**
1. 세션 생성 또는 입장 응답의 \`participantToken\`을 복사한다.
2. 오른쪽 위 **Authorize** 버튼에 붙여 넣는다. 이후 요청에 \`${PARTICIPANT_TOKEN_HEADER}\` 헤더로 실린다.
3. 다른 참가자로 호출하려면 Authorize에서 Logout 후 그 참가자의 토큰을 넣는다.

**한 바퀴 호출 순서** (로그인 없이 위에서부터)
1. \`POST /api/sessions\` 방 만들기 — \`goalSeconds: 60\`, \`maxParticipants: 4\`, \`clientRequestId\`는 아무 문자열. 응답의 \`sessionId\`·\`sessionCode\`·방장 \`participantToken\`을 적어 둔다
2. **Authorize**에 방장 토큰
3. \`POST /api/sessions/join\` 3번 — 같은 \`sessionCode\`, \`clientRequestId\`는 매번 다르게 (최소 4명이어야 시작)
4. (선택) \`PATCH /api/sessions/{sessionId}/participants/me\` 닉네임, \`POST /api/images\` → \`PATCH /api/sessions/{sessionId}/image\` 방 사진
5. \`POST /api/sessions/{sessionId}/start\` 시작 (방장)
6. \`POST /api/sessions/{sessionId}/heartbeat\` (\`state\`: FOCUSING·PAUSED·AWAY, 얼굴이 보일 때 FOCUSING), \`GET /api/sessions/{sessionId}/board\` 공부 중 연결 확인·진행판
7. 60초를 기다리거나 \`POST /api/sessions/{sessionId}/end\` 조기 종료 (방장)
8. \`GET /api/sessions/{sessionId}/assembly\` 조립판 → \`PATCH /api/sessions/{sessionId}/assembly/pieces/{pieceId}\` 조각 놓기 (자기 조각만, 정답 칸이면 \`correct: true\`)
9. \`GET /api/sessions/{sessionId}/result\` 공부 결과 (공부 시간 종료 후)
10. \`DELETE /api/sessions/{sessionId}\` 방 삭제 (방장) — 이후 이 방 토큰은 401

**시작 전 나가기**: \`DELETE /api/sessions/{sessionId}/participants/me\` (방장이 나가면 다음 입장자가 방장)
**요청 횟수 제한**: 사용자 IP별 1분에 방 만들기 20회·입장 60회, 넘으면 429 \`TOO_MANY_REQUESTS\`
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
