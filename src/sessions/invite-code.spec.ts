import {
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
} from './invite-code.js';

describe('generateInviteCode', () => {
  it('정해진 길이와 허용 글자로만 만든다', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      for (const ch of code) expect(INVITE_CODE_ALPHABET).toContain(ch);
    }
  });

  it('헷갈리는 글자(0, O, 1, I, L)를 쓰지 않는다', () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
  });

  it('매번 다른 코드가 나올 확률이 높다', () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => generateInviteCode()),
    );
    expect(codes.size).toBeGreaterThan(95);
  });
});
