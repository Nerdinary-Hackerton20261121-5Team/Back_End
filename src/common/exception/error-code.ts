import { HttpStatus } from '@nestjs/common';

/** 에러 하나의 정의. code는 응답 본문의 code, status는 HTTP 상태 코드. */
export interface ErrorDefinition {
  code: string;
  status: HttpStatus;
  message: string;
}

/**
 * 모든 모듈이 같이 쓰는 공통 에러 코드.
 * 기능 전용 코드(SESSION_NOT_FOUND 등)는 각 모듈의 `<기능>.errors.ts`에 같은 모양으로 정의한다.
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
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: HttpStatus.UNAUTHORIZED,
    message: '인증이 필요합니다.',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: HttpStatus.FORBIDDEN,
    message: '권한이 없습니다.',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '요청한 리소스를 찾을 수 없습니다.',
  },
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    status: HttpStatus.METHOD_NOT_ALLOWED,
    message: '지원하지 않는 요청 방식입니다.',
  },
  CONFLICT: {
    code: 'CONFLICT',
    status: HttpStatus.CONFLICT,
    message: '요청이 현재 상태와 충돌합니다.',
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: '요청 크기가 너무 큽니다.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: '지원하지 않는 형식입니다.',
  },
  TOO_MANY_REQUESTS: {
    code: 'TOO_MANY_REQUESTS',
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: '서버 내부 오류가 발생했습니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
