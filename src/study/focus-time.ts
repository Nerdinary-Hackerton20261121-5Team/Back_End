/**
 * 얼굴 기준 집중 시간 누적 (F-005, F-009). DB·현재 시각에 의존하지 않는 순수 함수다.
 * 시간은 서버 시각으로 재고, 클라이언트는 heartbeat마다 지금 상태(presence)만 알려준다.
 * - FOCUSING: 얼굴이 인식됨 → 다음 heartbeat까지의 시간을 누적한다
 * - PAUSED:   일시정지 버튼 (명시적 자리비움) → 누적하지 않는다
 * - AWAY:     얼굴이 인식되지 않음 → 누적하지 않는다
 * heartbeat가 단절 기준 시간보다 오래 끊기면 DISCONNECTED로 보고 그 구간은 누적하지 않는다.
 * 다시 heartbeat가 오면 그때부터 다시 누적한다 (영구 고정 없음).
 */
import { endsAt, isDisconnected, type SessionTimer } from './session-clock.js';

/** 클라이언트가 heartbeat로 보내는 상태 */
export const PRESENCE_STATES = ['FOCUSING', 'PAUSED', 'AWAY'] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

/** 화면에 보이는 참가자 상태. DISCONNECTED는 서버가 판정한다 */
export const MEMBER_STATES = [...PRESENCE_STATES, 'DISCONNECTED'] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

const MS = 1000;

/** 참가자 행에서 계산에 쓰는 값 */
export interface FocusRecord {
  /** 저장된 누적 집중 시간(ms). 마지막 heartbeat 시각까지의 합계 */
  focusedMs: number;
  /** 마지막 heartbeat가 알려준 상태 */
  presence: PresenceState;
  lastHeartbeatAt: Date | null;
  /** 조립을 열 때 끊겨 있던 사람이면 그 마지막 확인 시각 */
  disconnectedAt: Date | null;
  /** 조립을 열 때 확정한 복원도. 값이 있으면 focusedMs도 확정값이다 */
  finalRestoration: number | null;
}

export interface FocusSnapshot {
  state: MemberState;
  /** 누적 집중 시간(ms). 0 ~ goalSeconds */
  focusedMs: number;
  /** 복원도 0~1 = 누적 집중 시간 / 목표 시간 */
  restoration: number;
}

/**
 * 시간 계산 기준 시각 = min(now, 종료 시각). 공부가 끝난 뒤에는 시간이 흐르지 않는다.
 * 방장이 조기 종료했으면 앞당겨진 종료 시각을 쓴다 (#78).
 */
function referenceMs(timer: SessionTimer, now: Date): number {
  const end = endsAt(timer);
  return end ? Math.min(now.getTime(), end.getTime()) : now.getTime();
}

/**
 * 마지막 heartbeat 이후 아직 저장되지 않은 구간 중 인정되는 시간(ms).
 * 마지막 상태가 FOCUSING이고 단절 기준 안이면 그 구간 전체, 아니면 0.
 * 늦게 온 heartbeat(단절 기준 초과)로 끊긴 구간을 인정받을 수 없다.
 */
export function pendingFocusMs(
  timer: SessionTimer,
  record: Pick<FocusRecord, 'presence' | 'lastHeartbeatAt'>,
  now: Date,
  timeoutSeconds: number,
): number {
  if (!timer.startedAt || !record.lastHeartbeatAt) return 0;
  if (record.presence !== 'FOCUSING') return 0;
  const gap = referenceMs(timer, now) - record.lastHeartbeatAt.getTime();
  if (gap <= 0 || gap > timeoutSeconds * MS) return 0;
  return gap;
}

/** 누적값을 0 ~ 목표 시간으로 자른다 */
export function clampFocusMs(timer: SessionTimer, focusedMs: number): number {
  return Math.min(Math.max(focusedMs, 0), timer.goalSeconds * MS);
}

/**
 * 지금 시각 기준 참가자의 상태·누적 시간·복원도.
 * 같은 입력이면 어느 기기에서 조회해도 같은 값이다 (AC-040).
 */
export function focusSnapshot(
  timer: SessionTimer,
  record: FocusRecord,
  now: Date,
  timeoutSeconds: number,
): FocusSnapshot {
  // 조립을 열 때 확정한 값이 있으면 그대로 쓴다
  if (record.finalRestoration !== null) {
    return {
      state: record.disconnectedAt ? 'DISCONNECTED' : record.presence,
      focusedMs: clampFocusMs(timer, record.focusedMs),
      restoration: record.finalRestoration,
    };
  }
  if (!timer.startedAt) {
    return { state: record.presence, focusedMs: 0, restoration: 0 };
  }

  const disconnected =
    record.lastHeartbeatAt !== null &&
    isDisconnected(timer, record.lastHeartbeatAt, now, timeoutSeconds);
  const focusedMs = clampFocusMs(
    timer,
    record.focusedMs + pendingFocusMs(timer, record, now, timeoutSeconds),
  );
  return {
    state: disconnected ? 'DISCONNECTED' : record.presence,
    focusedMs,
    restoration: focusedMs / (timer.goalSeconds * MS),
  };
}

/** 저장용 복원도 (DECIMAL(5,4)) */
export function roundRestoration(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
