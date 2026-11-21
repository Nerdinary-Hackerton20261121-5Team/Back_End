import { describe, expect, it } from 'vitest';
import { pieceEdges, piecePath } from './piece-shape.js';

describe('pieceEdges', () => {
  const rows = 6;
  const cols = 2;
  const at = (sessionId: number, row: number, col: number) =>
    pieceEdges(sessionId, row * cols + col + 1, rows, cols);

  it.each([1, 42, 9999])(
    '세션 %i: 이웃한 두 조각의 맞닿은 변은 반대 값(맞물림)',
    (sid) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const me = at(sid, r, c);
          if (c + 1 < cols) {
            expect(me.right).not.toBe(0);
            expect(at(sid, r, c + 1).left).toBe(-me.right);
          }
          if (r + 1 < rows) {
            expect(me.bottom).not.toBe(0);
            expect(at(sid, r + 1, c).top).toBe(-me.bottom);
          }
        }
      }
    },
  );

  it('바깥 테두리는 곧은 변(0)', () => {
    expect(at(1, 0, 0)).toMatchObject({ top: 0, left: 0 });
    expect(at(1, 0, 1)).toMatchObject({ top: 0, right: 0 });
    expect(at(1, rows - 1, 0)).toMatchObject({ bottom: 0, left: 0 });
    expect(at(1, rows - 1, 1)).toMatchObject({ bottom: 0, right: 0 });
  });

  it('같은 세션이면 항상 같고, 세션마다 다르다', () => {
    const all = (sid: number) =>
      Array.from({ length: rows * cols }, (_, i) =>
        JSON.stringify(pieceEdges(sid, i + 1, rows, cols)),
      ).join('|');
    expect(all(7)).toBe(all(7));
    const distinct = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(all));
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe('piecePath', () => {
  it('곧은 변만 있으면 칸 사각형', () => {
    expect(
      piecePath({ top: 0, right: 0, bottom: 0, left: 0 }, 100, 50, 20, 10),
    ).toBe('M20,10 L120,10 L120,60 L20,60 L20,10 Z');
  });

  it('탭은 여백(바깥)으로, 홈은 칸 안쪽으로 그린다', () => {
    const ys = (d: string) =>
      [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));
    const tab = piecePath(
      { top: 1, right: 0, bottom: 0, left: 0 },
      100,
      100,
      20,
      20,
    );
    const hole = piecePath(
      { top: -1, right: 0, bottom: 0, left: 0 },
      100,
      100,
      20,
      20,
    );
    expect(Math.min(...ys(tab))).toBe(0); // 위 여백 끝까지
    expect(Math.min(...ys(hole))).toBe(20); // 칸 밖으로 나가지 않음
    expect(Math.max(...ys(hole).filter((y) => y < 60))).toBe(40); // 탭 높이만큼 안으로
  });
});
