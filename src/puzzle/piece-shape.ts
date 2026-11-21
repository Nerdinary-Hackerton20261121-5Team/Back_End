import { createHash } from 'node:crypto';

/**
 * 직소 조각 모양 (F-008). DB에 저장하지 않고 세션 ID로 매번 같은 결과를 계산한다.
 *
 * - 변 값: 1 = 탭(바깥으로 튀어나옴), -1 = 홈(안으로 들어감), 0 = 테두리(곧은 변)
 * - 이웃한 두 조각의 맞닿은 변은 항상 반대 값이라 서로 맞물린다.
 * - 탭은 칸 밖으로 튀어나오므로 조각 이미지는 칸보다 사방으로 PIECE_PAD_RATIO만큼 크다.
 *   (가로 여유 = 칸 너비 × 비율, 세로 여유 = 칸 높이 × 비율)
 */

export type Edge = -1 | 0 | 1;

export interface PieceEdges {
  top: Edge;
  right: Edge;
  bottom: Edge;
  left: Edge;
}

/** 탭 높이 = 칸 크기 × 이 비율. 조각 이미지의 사방 여유와 같다 */
export const PIECE_PAD_RATIO = 0.2;

/** 경계 하나의 방향. 1이면 위·왼쪽 조각에 탭이 있다 */
function seam(sessionId: number, kind: 'h' | 'v', row: number, col: number) {
  const byte = createHash('sha256')
    .update(`${sessionId}:${kind}:${row}:${col}`)
    .digest()[0];
  return (byte & 1 ? 1 : -1) as 1 | -1;
}

/** position(왼쪽 위부터 1) 조각의 네 변 */
export function pieceEdges(
  sessionId: number,
  position: number,
  rows: number,
  cols: number,
): PieceEdges {
  const row = Math.floor((position - 1) / cols);
  const col = (position - 1) % cols;
  const neg = (e: Edge): Edge => (e === 0 ? 0 : (-e as Edge));
  return {
    top: row > 0 ? neg(seam(sessionId, 'h', row - 1, col)) : 0,
    bottom: row < rows - 1 ? seam(sessionId, 'h', row, col) : 0,
    left: col > 0 ? neg(seam(sessionId, 'v', row, col - 1)) : 0,
    right: col < cols - 1 ? seam(sessionId, 'v', row, col) : 0,
  };
}

/**
 * 탭 하나의 윤곽. (u: 변을 따라 0~1, v: 바깥쪽으로 탭 높이 단위 0~1)
 * u=0.5를 기준으로 좌우 대칭이라 이웃 조각이 반대 방향으로 그려도 같은 곡선이 된다.
 */
const TAB_CURVES: [number, number][][] = [
  [
    [0.42, 0],
    [0.42, 0.25],
    [0.39, 0.45],
  ],
  [
    [0.33, 0.8],
    [0.4, 1],
    [0.5, 1],
  ],
  [
    [0.6, 1],
    [0.67, 0.8],
    [0.61, 0.45],
  ],
  [
    [0.58, 0.25],
    [0.58, 0],
    [0.63, 0],
  ],
];

/**
 * 조각 윤곽 SVG path. 캔버스는 (칸 너비 + 2·padX) × (칸 높이 + 2·padY)이고 칸은 (padX, padY)에서 시작한다.
 */
export function piecePath(
  edges: PieceEdges,
  cellWidth: number,
  cellHeight: number,
  padX: number,
  padY: number,
): string {
  const corners: [number, number][] = [
    [padX, padY],
    [padX + cellWidth, padY],
    [padX + cellWidth, padY + cellHeight],
    [padX, padY + cellHeight],
  ];
  // 시계 방향: 위 → 오른쪽 → 아래 → 왼쪽. normal은 바깥쪽, depth는 탭 높이
  const sides: { edge: Edge; normal: [number, number]; depth: number }[] = [
    { edge: edges.top, normal: [0, -1], depth: padY },
    { edge: edges.right, normal: [1, 0], depth: padX },
    { edge: edges.bottom, normal: [0, 1], depth: padY },
    { edge: edges.left, normal: [-1, 0], depth: padX },
  ];
  const fmt = (n: number) => Number(n.toFixed(2));
  const parts = [`M${fmt(corners[0][0])},${fmt(corners[0][1])}`];

  sides.forEach((side, i) => {
    const [sx, sy] = corners[i];
    const [ex, ey] = corners[(i + 1) % 4];
    if (side.edge === 0) {
      parts.push(`L${fmt(ex)},${fmt(ey)}`);
      return;
    }
    const point = (u: number, v: number) => {
      const x =
        sx + (ex - sx) * u + side.normal[0] * side.depth * side.edge * v;
      const y =
        sy + (ey - sy) * u + side.normal[1] * side.depth * side.edge * v;
      return `${fmt(x)},${fmt(y)}`;
    };
    parts.push(`L${point(0.37, 0)}`);
    for (const curve of TAB_CURVES) {
      parts.push(`C${curve.map(([u, v]) => point(u, v)).join(' ')}`);
    }
    parts.push(`L${fmt(ex)},${fmt(ey)}`);
  });
  parts.push('Z');
  return parts.join(' ');
}
