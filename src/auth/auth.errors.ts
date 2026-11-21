import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';
import { PARTICIPANT_TOKEN_HEADER } from '../common/http-headers.js';

export const AuthErrors = {
  TOKEN_REQUIRED: {
    code: 'TOKEN_REQUIRED',
    status: HttpStatus.UNAUTHORIZED,
    message: `${PARTICIPANT_TOKEN_HEADER} 헤더가 필요합니다.`,
  },
  TOKEN_INVALID: {
    code: 'TOKEN_INVALID',
    status: HttpStatus.UNAUTHORIZED,
    message: '참가자 토큰이 유효하지 않습니다.',
  },
  NOT_SESSION_PARTICIPANT: {
    code: 'NOT_SESSION_PARTICIPANT',
    status: HttpStatus.FORBIDDEN,
    message: '이 세션의 참가자가 아닙니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
