import { describe, expect, it } from 'vitest';
import {
  BLUR_MAX_SIGMA,
  BLUR_MIN_SIGMA,
  blurLevel,
  blurSigma,
} from './piece-blur.js';

describe('piece-blur', () => {
  it('복원도를 10% 단위 단계로 나눈다', () => {
    expect(blurLevel(0)).toBe(0);
    expect(blurLevel(0.09)).toBe(0);
    expect(blurLevel(0.1)).toBe(1);
    expect(blurLevel(0.55)).toBe(5);
    expect(blurLevel(0.999)).toBe(9);
    expect(blurLevel(1)).toBe(10);
    expect(blurLevel(1.5)).toBe(10);
    expect(blurLevel(-1)).toBe(0);
  });

  it('진행할수록 덜 흐리지만 100%여도 블러가 남는다', () => {
    expect(blurSigma(0)).toBe(BLUR_MAX_SIGMA);
    expect(blurSigma(10)).toBe(BLUR_MIN_SIGMA);
    expect(BLUR_MIN_SIGMA).toBeGreaterThan(0);
    for (let level = 1; level <= 10; level++) {
      expect(blurSigma(level)).toBeLessThan(blurSigma(level - 1));
    }
  });
});
