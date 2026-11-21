/**
 * 세션 시계·복원도 계산 (F-003, F-004, F-005, F-009). DB·현재 시각에 의존하지 않는 순수 함수다.
 * 모든 시각은 서버 시각을 쓴다. 기기 시계를 바꿔도 결과가 바뀌지 않는다 (AC-019).
 */

/** 시간으로 정해지는 단계. ERD session.status 값과 같다. COMPLETED(팀 통과)는 시간이 아니라 조립 결과로 정해져 DB에 저장한다. */
export type SessionPhase = 'WAITING' | 'FOCUSING' | 'ASSEMBLING';

export interface SessionTimer {
  /** 개설자가 시작한 시각. 시작 전이면 null */
  startedAt: Date | null;
  /** 공통 목표 시간(초), 0보다 크다 */
  goalSeconds: number;
}

const MS = 1000;

function endsAtOf(timer: SessionTimer & { startedAt: Date }): Date {
  return new Date(timer.startedAt.getTime() + timer.goalSeconds * MS);
}

/** 시작 전 WAITING, 집중 중 FOCUSING, 종료 시각이 지나면 ASSEMBLING (조회 시점에 계산, 스케줄러 불필요) */
export function sessionPhase(timer: SessionTimer, now: Date): SessionPhase {
  if (!timer.startedAt) return 'WAITING';
  return now.getTime() <
    endsAtOf({ ...timer, startedAt: timer.startedAt }).getTime()
    ? 'FOCUSING'
    : 'ASSEMBLING';
}

/** 시작 시각 기준 종료 예정 시각 = startedAt + goalSeconds (AC-008: 이탈·화면 전환과 무관) */
export function endsAt(timer: SessionTimer): Date | null {
  return timer.startedAt
    ? endsAtOf({ ...timer, startedAt: timer.startedAt })
    : null;
}

/** 경과 시간(초). 0 ~ goalSeconds로 자른다 (AC-011, AC-014) */
export function elapsedSeconds(timer: SessionTimer, now: Date): number {
  if (!timer.startedAt) return 0;
  const end = Math.min(
    now.getTime(),
    endsAtOf({ ...timer, startedAt: timer.startedAt }).getTime(),
  );
  const elapsed = Math.floor((end - timer.startedAt.getTime()) / MS);
  return Math.min(Math.max(elapsed, 0), timer.goalSeconds);
}

/** 남은 시간(초). 음수가 되지 않는다 (AC-014) */
export function remainingSeconds(timer: SessionTimer, now: Date): number {
  return timer.goalSeconds - elapsedSeconds(timer, now);
}

/**
 * 연결이 끊겼는지 판정한다 (F-005).
 * 기준 시각은 min(now, endsAt)이다. 공부가 끝나면 heartbeat가 멈추므로,
 * now를 그대로 쓰면 조립 단계에서 끝까지 연결돼 있던 사람까지 모두 끊긴 것으로 잘못 판정된다.
 */
export function isDisconnected(
  timer: SessionTimer,
  lastHeartbeatAt: Date,
  now: Date,
  timeoutSeconds: number,
): boolean {
  const end = endsAt(timer);
  if (!end) return false;
  const reference = Math.min(now.getTime(), end.getTime());
  return reference - lastHeartbeatAt.getTime() > timeoutSeconds * MS;
}

/**
 * 이번 조회·heartbeat에서 새로 기록할 고정 시각. 이미 고정됐으면 null (AC-015, AC-019: 덮어쓰지 않음).
 * 끊긴 시점이 불명확하므로 마지막으로 확인한 시각(lastHeartbeatAt)으로 고정한다.
 */
export function nextFrozenAt(
  timer: SessionTimer,
  participant: { lastHeartbeatAt: Date; frozenAt: Date | null },
  now: Date,
  timeoutSeconds: number,
): Date | null {
  if (participant.frozenAt) return null;
  return isDisconnected(timer, participant.lastHeartbeatAt, now, timeoutSeconds)
    ? participant.lastHeartbeatAt
    : null;
}

/**
 * 복원도 0~1 (F-009). 끊긴 사람은 frozenAt에서 멈추고, 나머지는 공통 타이머를 따른다.
 *   restoration = clamp((min(frozenAt ?? now, endsAt) - startedAt) / goalSeconds, 0, 1)
 * 같은 입력이면 어느 기기에서 조회해도 같은 값이다 (AC-040).
 */
export function restoration(
  timer: SessionTimer,
  frozenAt: Date | null,
  now: Date,
): number {
  if (!timer.startedAt) return 0;
  const stop = frozenAt && frozenAt.getTime() < now.getTime() ? frozenAt : now;
  const ratio = elapsedSeconds(timer, stop) / timer.goalSeconds;
  return Math.min(Math.max(ratio, 0), 1);
}
