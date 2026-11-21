import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';

export const ThrottleErrors = {
  TOO_MANY_REQUESTS: {
    code: 'TOO_MANY_REQUESTS',
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
} as const satisfies Record<string, ErrorDefinition>;
