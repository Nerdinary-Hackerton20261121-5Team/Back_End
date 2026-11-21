/**
 * 남의 조각 블러 (F-009). 원본은 절대 내려주지 않는다.
 *
 * 블러 강도는 조각 주인의 진행도(복원도 0~1)로 정한다. 진행도는 참가자 단위라 같은 사람의 조각 2개는 항상 같은 단계다.
 * - 10% 단위 단계(0~10)로 나눈다. 같은 단계면 같은 이미지라 캐시를 다시 쓴다.
 * - 0%가 가장 흐리고, 100%여도 BLUR_MIN_SIGMA 이상 흐리게 둔다.
 * sigma는 조각 이미지의 칸 너비(PIECE_CELL_WIDTH px) 기준이다.
 */

export const BLUR_LEVELS = 10;
export const BLUR_MAX_SIGMA = 48;
export const BLUR_MIN_SIGMA = 14;

/** 복원도(0~1) → 블러 단계 0~10. 단계가 높을수록 덜 흐리다 */
export function blurLevel(restoration: number): number {
  const clamped = Math.min(1, Math.max(0, restoration));
  return Math.floor(clamped * BLUR_LEVELS + 1e-9);
}

/** 블러 단계 → sigma. 100%(단계 10)여도 0이 되지 않는다 */
export function blurSigma(level: number): number {
  const step = Math.min(BLUR_LEVELS, Math.max(0, level));
  return (
    BLUR_MIN_SIGMA +
    ((BLUR_MAX_SIGMA - BLUR_MIN_SIGMA) * (BLUR_LEVELS - step)) / BLUR_LEVELS
  );
}
