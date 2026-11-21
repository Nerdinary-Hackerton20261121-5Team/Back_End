import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';

export const StudyErrors = {
  PIECE_NOT_FOUND: {
    code: 'PIECE_NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '조각을 찾을 수 없습니다.',
  },
  SESSION_IMAGE_NOT_SET: {
    code: 'SESSION_IMAGE_NOT_SET',
    status: HttpStatus.NOT_FOUND,
    message: '세션에 이미지가 없습니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
