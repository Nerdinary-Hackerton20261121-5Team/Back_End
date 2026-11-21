import { createHash, randomBytes } from 'node:crypto';

/**
 * 익명 참가자 토큰 (POL-003).
 * - 평문 토큰은 발급 응답에서 한 번만 내려주고, DB에는 SHA-256 해시만 저장한다.
 * - URL·로그에 토큰을 넣지 않는다.
 */
const TOKEN_BYTES = 32;

export interface IssuedParticipantToken {
  /** 클라이언트에게 한 번만 주는 평문 토큰 (base64url, 43자) */
  token: string;
  /** DB에 저장하는 값 (SHA-256 hex, 64자) */
  tokenHash: string;
}

export function hashParticipantToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function issueParticipantToken(): IssuedParticipantToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashParticipantToken(token) };
}
