import { HttpStatus } from '@nestjs/common';
import type { ErrorDefinition } from '../common/exception/error-code.js';

export const AssemblyErrors = {
  ASSEMBLY_NOT_OPEN: {
    code: 'ASSEMBLY_NOT_OPEN',
    status: HttpStatus.CONFLICT,
    message: '조립은 집중 시간이 끝난 뒤에 열립니다.',
  },
  PIECE_NOT_FOUND: {
    code: 'PIECE_NOT_FOUND',
    status: HttpStatus.NOT_FOUND,
    message: '조각을 찾을 수 없습니다.',
  },
  NOT_PIECE_OWNER: {
    code: 'NOT_PIECE_OWNER',
    status: HttpStatus.FORBIDDEN,
    message: '자기 조각만 옮길 수 있습니다.',
  },
} as const satisfies Record<string, ErrorDefinition>;
