import { randomInt } from 'node:crypto';

/**
 * 세션 입장 코드 (F-001, F-011). 사람이 읽고 입력하기 쉽게 헷갈리는 글자(0/O, 1/I/L)를 뺀다.
 * 중복은 DB의 UNIQUE 제약으로 막고, 충돌하면 새로 만들어 다시 저장한다.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// TODO(Q-006): 코드 길이 팀 확정 전 임시값
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
