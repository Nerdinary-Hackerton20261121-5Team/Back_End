/**
 * 퍼즐 분할 (F-008). DB·이미지 크기와 무관한 순수 계산이다.
 *
 * 1) 원조각: 시작 시점 명단 인원 N(4·5·6명)으로 이미지를 나눈다. 한 행에 2명, 행 수 = ceil(N / 2).
 *    N이 홀수(5명)면 마지막 사람이 맨 아래 행 전체(두 칸, colSpan 2)를 맡는다.
 *      N=4 → 2×2 / N=5 → 3행(2, 2, 1) / N=6 → 3×2
 * 2) 조립 조각: 원조각마다 2×2(분할 비율 1/4)로 나눈다. 총 4N개.
 * 3) 위치 번호(position)는 ERD와 같이 왼쪽 위부터 1이다. 같은 행에서는 왼쪽부터.
 *
 * 좌표는 이미지 전체를 0~1로 둔 정규화 좌표다. 경계를 같은 식(i / 개수)으로 계산하므로
 * 이웃끼리 틈·겹침 없이 원본을 정확히 덮는다 (AC-028).
 */

/** 분할 비율 1/4 = 원조각 하나를 2×2로 나눈다 (팀 확정: 1/4만 사용) */
export const SPLIT_COUNT = 4;
const SPLIT_SIDE = 2;
/** 원조각 격자 한 행의 인원 */
const SOURCE_COLS = 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SourcePieceLayout {
  /** 원조각 위치 번호, 왼쪽 위부터 1. 명단 순서대로 참가자에게 배정한다 */
  position: number;
  /** 격자에서 차지하는 칸 수. 홀수 인원의 마지막 원조각만 2 (맨 아래 행 전체) */
  colSpan: number;
  rect: Rect;
}

export interface AssemblyPieceLayout {
  /** 조립판 정답 위치 번호, 왼쪽 위부터 1 */
  position: number;
  /** 이 조각이 나온 원조각의 위치 번호 = 옮길 수 있는 주인 */
  sourcePosition: number;
  rect: Rect;
}

export interface PuzzleLayout {
  /** 원조각 격자 행·열 수 (session.grid_rows, grid_cols) */
  gridRows: number;
  gridCols: number;
  sources: SourcePieceLayout[];
  pieces: AssemblyPieceLayout[];
}

/** 원조각 격자 크기. 항상 한 행에 2명. */
export function sourceGrid(participantCount: number): {
  rows: number;
  cols: number;
} {
  assertPositiveInteger(participantCount);
  return {
    rows: Math.ceil(participantCount / SOURCE_COLS),
    cols: SOURCE_COLS,
  };
}

export function buildPuzzleLayout(participantCount: number): PuzzleLayout {
  const { rows, cols } = sourceGrid(participantCount);

  const sourceRects: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    // 마지막 행은 남은 인원 수만큼 (홀수면 1명이 행 전체)
    const inRow = Math.min(cols, participantCount - r * cols);
    for (let c = 0; c < inRow; c++) {
      sourceRects.push(cell({ x: 0, y: 0, w: 1, h: 1 }, r, rows, c, inRow));
    }
  }
  const sources = sourceRects.map((rect, i) => ({
    position: i + 1,
    // 행 전체 너비면 두 칸 (cols가 2일 때 홀수 인원의 마지막 원조각)
    colSpan: rect.w === 1 && cols > 1 ? cols : 1,
    rect,
  }));

  const unordered = sources.flatMap((source) =>
    splitIntoQuarters(source.rect).map((rect) => ({
      sourcePosition: source.position,
      rect,
    })),
  );
  const pieces = unordered
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((piece, i) => ({ position: i + 1, ...piece }));

  return { gridRows: rows, gridCols: cols, sources, pieces };
}

function splitIntoQuarters(area: Rect): Rect[] {
  const rects: Rect[] = [];
  for (let r = 0; r < SPLIT_SIDE; r++) {
    for (let c = 0; c < SPLIT_SIDE; c++) {
      rects.push(cell(area, r, SPLIT_SIDE, c, SPLIT_SIDE));
    }
  }
  return rects;
}

/** area를 rows×cols로 나눴을 때 (row, col) 칸 */
function cell(
  area: Rect,
  row: number,
  rows: number,
  col: number,
  cols: number,
): Rect {
  const x0 = area.x + (area.w * col) / cols;
  const x1 = area.x + (area.w * (col + 1)) / cols;
  const y0 = area.y + (area.h * row) / rows;
  const y1 = area.y + (area.h * (row + 1)) / rows;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function assertPositiveInteger(n: number): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`participantCount must be a positive integer: ${n}`);
  }
}
