import {
  buildPuzzleLayout,
  sourceGrid,
  SPLIT_COUNT,
  type Rect,
} from './puzzle-splitter.js';

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

describe('sourceGrid', () => {
  it('항상 한 행에 2명', () => {
    expect(sourceGrid(4)).toEqual({ rows: 2, cols: 2 });
    expect(sourceGrid(5)).toEqual({ rows: 3, cols: 2 });
    expect(sourceGrid(6)).toEqual({ rows: 3, cols: 2 });
  });

  it('0명이나 소수는 거절한다', () => {
    expect(() => sourceGrid(0)).toThrow(RangeError);
    expect(() => sourceGrid(2.5)).toThrow(RangeError);
  });
});

describe('buildPuzzleLayout', () => {
  it('분할 비율은 1/4 (원조각 하나 → 조립 조각 4개)', () => {
    expect(SPLIT_COUNT).toBe(4);
  });

  it('5명이면 마지막 사람이 맨 아래 행 전체(두 칸 크기)를 맡는다', () => {
    const { sources } = buildPuzzleLayout(5);
    const last = sources[4];
    expect(last.position).toBe(5);
    expect(last.rect.x).toBe(0);
    expect(last.rect.w).toBe(1);
    expect(last.rect.y).toBeCloseTo(2 / 3, 9);
    expect(last.rect.h).toBeCloseTo(1 / 3, 9);
    expect(sources.slice(0, 4).every((s) => s.rect.w === 0.5)).toBe(true);
  });

  it('두 칸(colSpan 2)은 5명일 때 5번 원조각뿐', () => {
    const spans = (n: number) =>
      buildPuzzleLayout(n).sources.map((s) => s.colSpan);
    expect(spans(4)).toEqual([1, 1, 1, 1]);
    expect(spans(5)).toEqual([1, 1, 1, 1, 2]);
    expect(spans(6)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  describe.each([4, 5, 6])('참가자 %i명', (n) => {
    const { sources, pieces } = buildPuzzleLayout(n);

    it('원조각 N개, 조립 조각 4N개, 위치 번호는 1부터 빈틈없이', () => {
      expect(sources.map((s) => s.position)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
      expect(pieces.map((p) => p.position)).toEqual(
        Array.from({ length: 4 * n }, (_, i) => i + 1),
      );
    });

    it('AC-028 모든 조각을 정답 위치에 놓으면 틈·겹침 없이 원본을 덮는다', () => {
      const total = pieces.reduce((sum, p) => sum + area(p.rect), 0);
      expect(total).toBeCloseTo(1, 9);
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          expect(overlap(pieces[i].rect, pieces[j].rect)).toBeLessThan(EPS);
        }
      }
    });

    it('원조각마다 조립 조각 4개, 각 조각은 자기 원조각 안에 있다', () => {
      for (const source of sources) {
        const mine = pieces.filter((p) => p.sourcePosition === source.position);
        expect(mine).toHaveLength(4);
        for (const p of mine) expect(inside(p.rect, source.rect)).toBe(true);
      }
    });

    it('위치 번호는 왼쪽 위부터 (위 행 먼저, 같은 행은 왼쪽 먼저)', () => {
      for (let i = 1; i < pieces.length; i++) {
        const prev = pieces[i - 1].rect;
        const cur = pieces[i].rect;
        expect(cur.y > prev.y || (cur.y === prev.y && cur.x > prev.x)).toBe(
          true,
        );
      }
    });
  });

  it('같은 인원이면 항상 같은 배치 (모든 기기 배치 일치, AC-035)', () => {
    expect(buildPuzzleLayout(5)).toEqual(buildPuzzleLayout(5));
  });
});
