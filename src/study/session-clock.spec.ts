import {
  elapsedSeconds,
  endsAt,
  isDisconnected,
  remainingSeconds,
  sessionPhase,
  type SessionTimer,
} from './session-clock.js';

const T0 = new Date('2026-11-22T00:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const MIN = 60;
const TIMEOUT = 30; // 테스트용 단절 기준(초)

const timer: SessionTimer = { startedAt: T0, goalSeconds: 20 * MIN };
const notStarted: SessionTimer = { startedAt: null, goalSeconds: 20 * MIN };

describe('sessionPhase / endsAt', () => {
  it('시작 전 WAITING, 공부 중 FOCUSING, 종료 시각부터 ASSEMBLING', () => {
    expect(sessionPhase(notStarted, at(0))).toBe('WAITING');
    expect(sessionPhase(timer, at(0))).toBe('FOCUSING');
    expect(sessionPhase(timer, at(20 * MIN - 1))).toBe('FOCUSING');
    expect(sessionPhase(timer, at(20 * MIN))).toBe('ASSEMBLING');
  });

  it('종료 예정 시각 = 시작 + 목표 (AC-008)', () => {
    expect(endsAt(timer)).toEqual(at(20 * MIN));
    expect(endsAt(notStarted)).toBeNull();
  });
});

describe('경과·남은 시간', () => {
  it('AC-011 목표 20분, 시작 후 8분이면 경과 8분·남은 12분', () => {
    expect(elapsedSeconds(timer, at(8 * MIN))).toBe(8 * MIN);
    expect(remainingSeconds(timer, at(8 * MIN))).toBe(12 * MIN);
  });

  it('AC-014 남은 시간은 음수가 되지 않고 경과는 목표를 넘지 않는다', () => {
    expect(elapsedSeconds(timer, at(99 * MIN))).toBe(20 * MIN);
    expect(remainingSeconds(timer, at(99 * MIN))).toBe(0);
    expect(elapsedSeconds(timer, at(-5))).toBe(0);
    expect(elapsedSeconds(notStarted, at(5 * MIN))).toBe(0);
  });
});

describe('단절 판정', () => {
  it('공부 중 마지막 확인 후 기준 시간이 지나면 끊긴 것으로 본다', () => {
    expect(
      isDisconnected(timer, at(8 * MIN), at(8 * MIN + TIMEOUT), TIMEOUT),
    ).toBe(false);
    expect(
      isDisconnected(timer, at(8 * MIN), at(8 * MIN + TIMEOUT + 1), TIMEOUT),
    ).toBe(true);
  });

  it('끝까지 연결된 사람은 조립 단계에서 한참 뒤에 조회해도 끊긴 것으로 보지 않는다', () => {
    const lastHeartbeat = at(20 * MIN - 5); // 종료 5초 전 마지막 heartbeat
    expect(
      isDisconnected(timer, lastHeartbeat, at(20 * MIN + 30 * MIN), TIMEOUT),
    ).toBe(false);
  });

  it('시작 전에는 끊김을 판정하지 않는다', () => {
    expect(isDisconnected(notStarted, at(0), at(99 * MIN), TIMEOUT)).toBe(
      false,
    );
  });
});
