import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';

export const SessionErrors = {
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '세션을 찾을 수 없습니다.',
  },
  SESSION_ALREADY_STARTED: {
    code: 'SESSION_ALREADY_STARTED',
    status: HttpStatus.CONFLICT,
    message: '이미 시작된 세션에는 입장할 수 없습니다.',
  },
  SESSION_FULL: {
    code: 'SESSION_FULL',
    status: HttpStatus.CONFLICT,
    message: '세션 정원이 가득 찼습니다.',
  },
  NOT_CREATOR: {
    code: 'NOT_CREATOR',
    status: HttpStatus.FORBIDDEN,
    message: '개설자만 할 수 있습니다.',
  },
  NOT_ENOUGH_PARTICIPANTS: {
    code: 'NOT_ENOUGH_PARTICIPANTS',
    status: HttpStatus.BAD_REQUEST,
    message: '최소 4명이 입장해야 시작할 수 있습니다.',
  },
  IMAGE_LOCKED_AFTER_START: {
    code: 'IMAGE_LOCKED_AFTER_START',
    status: HttpStatus.CONFLICT,
    message: '시작된 세션의 이미지는 바꿀 수 없습니다.',
  },
  CANNOT_LEAVE_AFTER_START: {
    code: 'CANNOT_LEAVE_AFTER_START',
    status: HttpStatus.CONFLICT,
    message: '시작된 세션에서는 나갈 수 없습니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
