import { randomInt } from 'node:crypto';
import { PIECES_PER_PARTICIPANT } from './entities/source-piece.entity.js';

/**
 * 조각 배치 (F-008). DB와 무관한 순수 계산이다.
 *
 * - 격자: 참가자 N명이면 N행 × 2열, 조각 2N개. 칸 번호(slot)는 왼쪽 위부터 1이다.
 * - 정답 칸(position): 명단 i번째(0부터) 참가자가 i+1번째 행, 곧 2i+1·2i+2번 칸을 맡는다.
 * - 공부 중 배치 칸(displaySlot): 랜덤 순열이라 두 조각이 같은 칸에 놓이지 않는다.
 *   그리고 조각이 주인의 정답 칸(자기 칸·짝 조각 칸)에는 놓이지 않는다.
 */

/** 조각 격자 한 행의 칸 수 */
export const PIECE_GRID_COLS = 2;

export interface PieceLayout {
  /** 정답 칸 번호, 왼쪽 위부터 1 */
  position: number;
  /** 주인 = 명단 순서(0부터) */
  ownerIndex: number;
  /** 공부 중 화면에 놓이는 칸 번호 */
  displaySlot: number;
}

export interface PieceGrid {
  /** session.grid_rows, grid_cols */
  gridRows: number;
  gridCols: number;
  /** 정답 칸 순서 */
  pieces: PieceLayout[];
}

/** 0 이상 max 미만 정수를 고르는 함수. 테스트에서 바꿔 끼운다 */
export type RandomInt = (max: number) => number;

/** 랜덤 배치를 이 횟수만큼 뽑아도 조건을 못 맞추면 한 행씩 밀어 놓는다 */
const MAX_SHUFFLE_ATTEMPTS = 100;

export function buildPieceLayout(
  participantCount: number,
  random: RandomInt = randomInt,
): PieceGrid {
  if (!Number.isInteger(participantCount) || participantCount < 2) {
    // 1명이면 남의 칸이 없어 조건을 맞출 수 없다 (시작 최소 인원은 4명)
    throw new RangeError(
      `participantCount must be an integer >= 2: ${participantCount}`,
    );
  }
  const total = participantCount * PIECES_PER_PARTICIPANT;
  const owners = Array.from({ length: total }, (_, i) =>
    Math.floor(i / PIECES_PER_PARTICIPANT),
  );
  const slots = assignDisplaySlots(owners, random);

  return {
    gridRows: total / PIECE_GRID_COLS,
    gridCols: PIECE_GRID_COLS,
    pieces: owners.map((ownerIndex, i) => ({
      position: i + 1,
      ownerIndex,
      displaySlot: slots[i],
    })),
  };
}

/**
 * owners[i] = (i+1)번 칸 조각의 주인. 돌려주는 값 [i] = 그 조각의 배치 칸 번호.
 * 1~n의 순열 중 "배치 칸의 주인 ≠ 조각의 주인"인 것을 고른다.
 * 무작위로 섞어 조건을 만족할 때까지 다시 뽑으므로(4명이면 약 7번 중 1번 통과) 조건을 만족하는 배치가 고르게 나온다.
 */
export function assignDisplaySlots(
  owners: readonly number[],
  random: RandomInt = randomInt,
): number[] {
  const n = owners.length;
  const valid = (slots: number[]) =>
    slots.every((slot, i) => owners[slot - 1] !== owners[i]);

  for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const slots = shuffled(
      Array.from({ length: n }, (_, i) => i + 1),
      random,
    );
    if (valid(slots)) return slots;
  }
  // 거의 오지 않는다. 한 사람 몫(PIECES_PER_PARTICIPANT칸)만큼 밀면 항상 남의 칸이다.
  const shifted = owners.map((_, i) => ((i + PIECES_PER_PARTICIPANT) % n) + 1);
  if (!valid(shifted)) {
    throw new RangeError('조각 배치 칸을 정할 수 없습니다.');
  }
  return shifted;
}

/** Fisher–Yates 섞기 (원본은 그대로 둔다) */
function shuffled<T>(items: readonly T[], random: RandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
