/**
 * 퍼즐 분할 (F-008, F-007). DB·이미지 크기와 무관한 순수 계산이다.
 *   이미지 → 원조각 N개(참가자 1명당 1개) → 원조각마다 splitCount개의 조립 조각
 *   예: 원조각 6개 × 1/4 분할 = 조립 조각 24개
 *
 * 좌표는 이미지 전체를 0~1로 둔 정규화 좌표다. 프론트는 실제 이미지 크기를 곱해 그린다.
 * 경계를 같은 식(i / 개수)으로 계산하므로 이웃끼리 틈·겹침 없이 원본을 정확히 덮는다 (AC-028).
 * TODO(Q-007): 조각 모양(직사각 / 맞물리는 퍼즐 모양)은 Design 확정 전까지 직사각으로 둔다.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OriginalPiece {
  /** 원조각 번호 0..N-1. 참가자 배정 순서와 같다 */
  originalIndex: number;
  rect: Rect;
}

export interface AssemblyPiece {
  /** 정답 칸 번호 0..N*splitCount-1 (조립판에서 이 칸에 놓아야 정답) */
  slotIndex: number;
  /** 어느 원조각에서 나왔는지 = 이 조각을 옮길 수 있는 주인 */
  originalIndex: number;
  rect: Rect;
}

export interface PuzzleLayout {
  originals: OriginalPiece[];
  pieces: AssemblyPiece[];
}

/**
 * 영역을 count개의 직사각형으로 나눈다. 열 수 = ceil(sqrt(count)),
 * 마지막 행은 남은 개수로 가로를 꽉 채운다 (예: 5 → [3, 2], 7 → [3, 3, 1]).
 */
export function splitRect(area: Rect, count: number): Rect[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer: ${count}`);
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const rects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = r === rows - 1 ? count - cols * (rows - 1) : cols;
    const y0 = area.y + (area.h * r) / rows;
    const y1 = area.y + (area.h * (r + 1)) / rows;
    for (let c = 0; c < inRow; c++) {
      const x0 = area.x + (area.w * c) / inRow;
      const x1 = area.x + (area.w * (c + 1)) / inRow;
      rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return rects;
}

/**
 * @param originalCount 원조각 수 = 시작 시점 명단 인원 (1이면 개인 세션, AC-024)
 * @param splitCount 원조각 하나를 나눌 조립 조각 수 (분할 비율 1/4 → 4)
 */
export function buildPuzzleLayout(
  originalCount: number,
  splitCount: number,
): PuzzleLayout {
  const whole: Rect = { x: 0, y: 0, w: 1, h: 1 };
  const originals = splitRect(whole, originalCount).map((rect, i) => ({
    originalIndex: i,
    rect,
  }));

  const pieces: AssemblyPiece[] = [];
  for (const original of originals) {
    for (const rect of splitRect(original.rect, splitCount)) {
      pieces.push({
        slotIndex: pieces.length,
        originalIndex: original.originalIndex,
        rect,
      });
    }
  }
  return { originals, pieces };
}
