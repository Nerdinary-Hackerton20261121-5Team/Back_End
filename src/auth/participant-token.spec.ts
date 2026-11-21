import {
  hashParticipantToken,
  issueParticipantToken,
} from './participant-token.js';

describe('participantToken', () => {
  it('발급할 때마다 다른 토큰을 만든다', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => issueParticipantToken().token),
    );
    expect(tokens.size).toBe(100);
  });

  it('토큰은 URL에 안전한 43자, 해시는 64자 hex', () => {
    const { token, tokenHash } = issueParticipantToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('같은 토큰은 항상 같은 해시가 되고, 해시는 평문과 다르다', () => {
    const { token, tokenHash } = issueParticipantToken();
    expect(hashParticipantToken(token)).toBe(tokenHash);
    expect(tokenHash).not.toBe(token);
  });
});
