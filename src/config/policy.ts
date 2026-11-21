/**
 * 제품 정책 값을 한곳에 모은다 (POL-011: 미정 값을 코드 곳곳에 확정값처럼 쓰지 않는다).
 * 확정된 값은 상수로, 미정 값은 TODO(Q-ID)와 함께 환경변수로 바꿀 수 있게 둔다.
 * 호출할 때마다 process.env를 읽으므로 .env 로드 순서와 무관하다.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** 방 정원 선택지 (팀 확정: 4·5·6명) */
export const ALLOWED_CAPACITIES = [4, 5, 6] as const;

/** 세션을 시작할 수 있는 최소 인원 (팀 확정: 4명, 개인 세션 없음) */
export const MIN_START_PARTICIPANTS = 4;

/** 원조각 하나를 나누는 조립 조각 수 (팀 확정: 1/4) */
export { SPLIT_COUNT } from '../puzzle/puzzle-splitter.js';

/**
 * 목표 시간 범위(초).
 * TODO(Q-006): 팀 확정 전 임시값. 최소값은 심사위원이 Swagger에서 조립까지 바로 볼 수 있게 60초로 둔다.
 */
export function goalSecondsRange(): { min: number; max: number } {
  return {
    min: intFromEnv('POLICY_GOAL_MIN_SECONDS', 60),
    max: intFromEnv('POLICY_GOAL_MAX_SECONDS', 4 * 60 * 60),
  };
}

/**
 * 연결 확인 주기와 단절 판정 기준(초).
 * TODO(Q-003): 팀 확정 전 임시값. 주기는 상태·진행도가 바로 보이도록 1초(#84).
 * 백그라운드 탭 타이머 지연을 고려해 단절 기준은 주기보다 넉넉히 둔다.
 */
export function heartbeatPolicy(): {
  intervalSeconds: number;
  disconnectTimeoutSeconds: number;
} {
  return {
    intervalSeconds: intFromEnv('POLICY_HEARTBEAT_SECONDS', 1),
    disconnectTimeoutSeconds: intFromEnv(
      'POLICY_DISCONNECT_TIMEOUT_SECONDS',
      90,
    ),
  };
}

/**
 * 끝났거나 방치된 방 자동 정리 기준(분) (POL-010, SPEC `CLEANUP_AFTER`).
 * TODO(Q-004): 팀 확정 전 임시값. 완성 후 결과를 볼 시간을 남기고, 시작하지 않은 방·완성하지 못한 방을 정리한다.
 */
export function cleanupPolicy(): {
  enabled: boolean;
  intervalMinutes: number;
  completedRetentionMinutes: number;
  waitingTtlMinutes: number;
  unfinishedAfterEndMinutes: number;
} {
  return {
    enabled: process.env.POLICY_CLEANUP_ENABLED !== 'false',
    intervalMinutes: intFromEnv('POLICY_CLEANUP_INTERVAL_MINUTES', 10),
    completedRetentionMinutes: intFromEnv(
      'POLICY_CLEANUP_COMPLETED_MINUTES',
      60,
    ),
    waitingTtlMinutes: intFromEnv('POLICY_CLEANUP_WAITING_MINUTES', 120),
    unfinishedAfterEndMinutes: intFromEnv(
      'POLICY_CLEANUP_UNFINISHED_MINUTES',
      60,
    ),
  };
}

/**
 * 요청 횟수 제한 (사용자 IP별, windowSeconds 동안 limit회).
 * TODO(Q-미등록): 팀 확정 전 임시값. 같은 와이파이를 여러 명이 함께 쓰는 경우를 고려해
 * 전체 API는 넉넉하게, 남용 위험이 큰 방 만들기·입장·이미지 업로드(인증 없이 최대 10MB)만 좁게 둔다.
 */
export function throttlePolicy(): {
  enabled: boolean;
  windowSeconds: number;
  defaultLimit: number;
  createLimit: number;
  joinLimit: number;
  uploadLimit: number;
} {
  return {
    enabled: process.env.POLICY_THROTTLE_ENABLED !== 'false',
    windowSeconds: intFromEnv('POLICY_THROTTLE_WINDOW_SECONDS', 60),
    defaultLimit: intFromEnv('POLICY_THROTTLE_DEFAULT_LIMIT', 600),
    createLimit: intFromEnv('POLICY_THROTTLE_CREATE_LIMIT', 20),
    joinLimit: intFromEnv('POLICY_THROTTLE_JOIN_LIMIT', 60),
    uploadLimit: intFromEnv('POLICY_THROTTLE_UPLOAD_LIMIT', 20),
  };
}
