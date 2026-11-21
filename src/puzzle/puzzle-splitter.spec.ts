import { buildPuzzleLayout, splitRect, type Rect } from './puzzle-splitter.js';

const EPS = 1e-9;
const area = (r: Rect) => r.w * r.h;
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.x + inner.w <= outer.x + outer.w + EPS &&
  inner.y + inner.h <= outer.y + outer.h + EPS;

describe('splitRect', () => {
  it('5개는 [3, 2], 7개는 [3, 3, 1]로 행을 채운다', () => {
    const rowsOf = (rects: Rect[]) =>
      [...new Set(rects.map((r) => r.y))].map(
        (y) => rects.filter((r) => r.y === y).length,
      );
    expect(rowsOf(splitRect({ x: 0, y: 0, w: 1, h: 1 }, 5))).toEqual([3, 2]);
    expect(rowsOf(splitRect({ x: 0, y: 0, w: 1, h: 1 }, 7))).toEqual([3, 3, 1]);
  });

  it('1개는 영역 전체', () => {
    const r = { x: 0.5, y: 0, w: 0.5, h: 0.5 };
    expect(splitRect(r, 1)).toEqual([r]);
  });

  it('0이나 소수는 거절한다', () => {
    expect(() => splitRect({ x: 0, y: 0, w: 1, h: 1 }, 0)).toThrow(RangeError);
    expect(() => splitRect({ x: 0, y: 0, w: 1, h: 1 }, 2.5)).toThrow(
      RangeError,
    );
  });
});

describe('buildPuzzleLayout', () => {
  it('원조각 6개 × 1/4 분할 = 조립 조각 24개', () => {
    const { originals, pieces } = buildPuzzleLayout(6, 4);
    expect(originals).toHaveLength(6);
    expect(pieces).toHaveLength(24);
  });

  it('AC-024 혼자면 원조각 1개(전체 이미지)를 비율대로 나눈다', () => {
    const { originals, pieces } = buildPuzzleLayout(1, 4);
    expect(originals).toEqual([
      { originalIndex: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
    ]);
    expect(pieces).toHaveLength(4);
    expect(pieces.every((p) => p.originalIndex === 0)).toBe(true);
  });

  describe.each([1, 2, 3, 4, 5, 6, 7, 8])('참가자 %i명', (n) => {
    describe.each([1, 4, 9])('분할 %i', (k) => {
      const { originals, pieces } = buildPuzzleLayout(n, k);

      it('AC-028 조각 수와 정답 칸 번호가 겹치지 않는다', () => {
        expect(pieces).toHaveLength(n * k);
        expect(pieces.map((p) => p.slotIndex)).toEqual(
          Array.from({ length: n * k }, (_, i) => i),
        );
      });

      it('AC-028 모든 조각을 정답 칸에 놓으면 틈·겹침 없이 원본을 덮는다', () => {
        const total = pieces.reduce((sum, p) => sum + area(p.rect), 0);
        expect(total).toBeCloseTo(1, 9);
        for (let i = 0; i < pieces.length; i++) {
          for (let j = i + 1; j < pieces.length; j++) {
            expect(overlap(pieces[i].rect, pieces[j].rect)).toBeLessThan(EPS);
          }
        }
      });

      it('원조각마다 정확히 k개, 각 조각은 자기 원조각 안에 있다', () => {
        for (const original of originals) {
          const mine = pieces.filter(
            (p) => p.originalIndex === original.originalIndex,
          );
          expect(mine).toHaveLength(k);
          for (const p of mine)
            expect(inside(p.rect, original.rect)).toBe(true);
        }
      });
    });
  });

  it('같은 입력이면 항상 같은 배치 (모든 기기 배치 일치, AC-035)', () => {
    expect(buildPuzzleLayout(5, 4)).toEqual(buildPuzzleLayout(5, 4));
  });
});
