import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';

export const ImageErrors = {
  IMAGE_NOT_FOUND: {
    code: 'IMAGE_NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '이미지를 찾을 수 없습니다.',
  },
  IMAGE_IN_USE: {
    code: 'IMAGE_IN_USE',
    status: HttpStatus.CONFLICT,
    message: '다른 방에서 쓰고 있는 업로드 이미지입니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
