/**
 * 세션 시계·단절 판정 (F-003, F-004, F-005). 복원도는 focus-time.ts가 계산한다. DB·현재 시각에 의존하지 않는 순수 함수다.
 * 모든 시각은 서버 시각을 쓴다. 기기 시계를 바꿔도 결과가 바뀌지 않는다 (AC-019).
 */

/** 시간으로 정해지는 단계. ERD session.status 값과 같다. COMPLETED(팀 통과)는 시간이 아니라 조립 결과로 정해져 DB에 저장한다. */
export type SessionPhase = 'WAITING' | 'FOCUSING' | 'ASSEMBLING';

export interface SessionTimer {
  /** 개설자가 시작한 시각. 시작 전이면 null */
  startedAt: Date | null;
  /** 공통 목표 시간(초), 0보다 크다. 복원도의 분모 */
  goalSeconds: number;
  /**
   * 저장된 종료 시각. 방장이 조기 종료하면 startedAt + goalSeconds보다 앞당겨진다 (#78).
   * 없으면 startedAt + goalSeconds로 계산한다.
   */
  endsAt?: Date | null;
}

const MS = 1000;

function endsAtOf(timer: SessionTimer & { startedAt: Date }): Date {
  return (
    timer.endsAt ?? new Date(timer.startedAt.getTime() + timer.goalSeconds * MS)
  );
}

/** 시작 전 WAITING, 집중 중 FOCUSING, 종료 시각이 지나면 ASSEMBLING (조회 시점에 계산, 스케줄러 불필요) */
export function sessionPhase(timer: SessionTimer, now: Date): SessionPhase {
  if (!timer.startedAt) return 'WAITING';
  return now.getTime() <
    endsAtOf({ ...timer, startedAt: timer.startedAt }).getTime()
    ? 'FOCUSING'
    : 'ASSEMBLING';
}

/**
 * 응답에 내보낼 세션 단계. 팀 통과(COMPLETED)는 조립 결과로 DB에 저장된 값을 그대로 쓰고,
 * 나머지는 서버 시각으로 계산한다 (DB의 FOCUSING은 종료 시각이 지나도 조립을 열기 전까지 그대로라서).
 */
export function sessionStatus(
  session: SessionTimer & { status: string },
  now: Date,
): SessionPhase | 'COMPLETED' {
  return session.status === 'COMPLETED'
    ? 'COMPLETED'
    : sessionPhase(session, now);
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

/** 남은 시간(초). 음수가 되지 않는다 (AC-014). 조기 종료했으면 0 (#78) */
export function remainingSeconds(timer: SessionTimer, now: Date): number {
  if (!timer.startedAt) return timer.goalSeconds;
  const total = Math.floor(
    (endsAtOf({ ...timer, startedAt: timer.startedAt }).getTime() -
      timer.startedAt.getTime()) /
      MS,
  );
  return Math.max(
    Math.min(total, timer.goalSeconds) - elapsedSeconds(timer, now),
    0,
  );
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
