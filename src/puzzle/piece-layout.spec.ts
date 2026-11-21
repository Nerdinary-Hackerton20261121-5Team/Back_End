import { describe, expect, it } from 'vitest';
import { PIECES_PER_PARTICIPANT } from './entities/source-piece.entity.js';
import { assignDisplaySlots, buildPieceLayout } from './piece-layout.js';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('buildPieceLayout', () => {
  it('참가자당 조각 2개', () => {
    expect(PIECES_PER_PARTICIPANT).toBe(2);
  });

  describe.each([4, 5, 6])('참가자 %i명', (n) => {
    it('격자 N행 × 2열, 조각 2N개, 정답 칸은 1부터 빈틈없이', () => {
      const layout = buildPieceLayout(n);
      expect(layout).toMatchObject({ gridRows: n, gridCols: 2 });
      expect(layout.pieces.map((p) => p.position)).toEqual(range(2 * n));
    });

    it('한 사람이 한 행(조각 2개)을 맡는다', () => {
      const { pieces } = buildPieceLayout(n);
      for (let owner = 0; owner < n; owner++) {
        expect(
          pieces.filter((p) => p.ownerIndex === owner).map((p) => p.position),
        ).toEqual([2 * owner + 1, 2 * owner + 2]);
      }
    });

    it('배치 칸은 서로 겹치지 않고, 주인의 정답 칸에 놓이지 않는다 (200번 반복)', () => {
      for (let run = 0; run < 200; run++) {
        const { pieces } = buildPieceLayout(n);
        const slots = pieces.map((p) => p.displaySlot);
        expect([...slots].sort((a, b) => a - b)).toEqual(range(2 * n));
        for (const piece of pieces) {
          const ownerOfSlot = pieces[piece.displaySlot - 1].ownerIndex;
          expect(ownerOfSlot).not.toBe(piece.ownerIndex);
        }
      }
    });
  });

  it('배치는 매번 달라진다 (랜덤)', () => {
    const seen = new Set(
      Array.from({ length: 50 }, () =>
        buildPieceLayout(4)
          .pieces.map((p) => p.displaySlot)
          .join(','),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('1명·소수는 거절한다', () => {
    expect(() => buildPieceLayout(1)).toThrow(RangeError);
    expect(() => buildPieceLayout(2.5)).toThrow(RangeError);
  });
});

describe('assignDisplaySlots', () => {
  it('랜덤이 계속 조건을 못 맞추면 한 사람 몫만큼 밀어 놓는다', () => {
    // 항상 0을 고르면 섞은 결과가 [2,3,4,5,6,7,8,1]로 고정돼 1번 조각이 짝 조각 칸(2번)에 놓인다
    const slots = assignDisplaySlots([0, 0, 1, 1, 2, 2, 3, 3], () => 0);
    expect(slots).toEqual([3, 4, 5, 6, 7, 8, 1, 2]);
  });
});
