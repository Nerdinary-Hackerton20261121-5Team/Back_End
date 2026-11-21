import { HttpStatus } from '@nestjs/common';

/** 에러 하나의 정의. code는 응답 본문의 code, status는 HTTP 상태 코드. */
export interface ErrorDefinition {
  code: string;
  status: HttpStatus;
  message: string;
}

/**
 * 모든 모듈이 같이 쓰는 공통 에러 코드. 심사 기준표의 400/404/500만 둔다.
 * 기능 전용 코드(SESSION_NOT_FOUND 등)나 다른 상태 코드(401/403/409 등)가 필요하면
 * 각 모듈의 `<기능>.errors.ts`에 같은 모양으로 정의한다.
 *   export const SessionErrors = {
 *     SESSION_NOT_FOUND: { code: 'SESSION_NOT_FOUND', status: HttpStatus.NOT_FOUND, message: '세션을 찾을 수 없습니다.' },
 *   } as const satisfies Record<string, ErrorDefinition>;
 */
export const CommonErrors = {
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    status: HttpStatus.BAD_REQUEST,
    message: '요청 값이 올바르지 않습니다.',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '요청한 리소스를 찾을 수 없습니다.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '서버 내부 오류가 발생했습니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
