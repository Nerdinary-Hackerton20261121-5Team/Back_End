import {
  elapsedSeconds,
  endsAt,
  isDisconnected,
  nextFrozenAt,
  remainingSeconds,
  restoration,
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
  it('시작 전 WAITING, 공부 중 STUDYING, 종료 시각부터 ASSEMBLY', () => {
    expect(sessionPhase(notStarted, at(0))).toBe('WAITING');
    expect(sessionPhase(timer, at(0))).toBe('STUDYING');
    expect(sessionPhase(timer, at(20 * MIN - 1))).toBe('STUDYING');
    expect(sessionPhase(timer, at(20 * MIN))).toBe('ASSEMBLY');
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

describe('nextFrozenAt', () => {
  it('끊기면 마지막 확인 시각으로 고정한다', () => {
    const p = { lastHeartbeatAt: at(8 * MIN), frozenAt: null };
    expect(nextFrozenAt(timer, p, at(10 * MIN), TIMEOUT)).toEqual(at(8 * MIN));
  });

  it('AC-015·AC-019 이미 고정됐으면 다시 고정하지 않는다 (덮어쓰기 없음)', () => {
    const p = { lastHeartbeatAt: at(15 * MIN), frozenAt: at(8 * MIN) };
    expect(nextFrozenAt(timer, p, at(19 * MIN), TIMEOUT)).toBeNull();
  });

  it('연결돼 있으면 고정하지 않는다', () => {
    const p = { lastHeartbeatAt: at(9 * MIN + 50), frozenAt: null };
    expect(nextFrozenAt(timer, p, at(10 * MIN), TIMEOUT)).toBeNull();
  });
});

describe('restoration', () => {
  it('목표 20분 중 8분에 끊긴 A는 0.4로 고정, 끝까지 연결된 B는 1.0 (AC-016)', () => {
    const end = at(20 * MIN + 5 * MIN);
    expect(restoration(timer, at(8 * MIN), end)).toBeCloseTo(0.4);
    expect(restoration(timer, null, end)).toBe(1);
  });

  it('공부 중에는 경과 비율만큼 복원된다', () => {
    expect(restoration(timer, null, at(5 * MIN))).toBeCloseTo(0.25);
  });

  it('시작 전 0, 범위는 항상 0~1 (AC-014)', () => {
    expect(restoration(notStarted, null, at(5 * MIN))).toBe(0);
    expect(restoration(timer, null, at(-10))).toBe(0);
    expect(restoration(timer, null, at(999 * MIN))).toBe(1);
  });

  it('AC-040 같은 입력이면 항상 같은 값', () => {
    const now = at(13 * MIN);
    expect(restoration(timer, at(6 * MIN), now)).toBe(
      restoration(timer, at(6 * MIN), now),
    );
  });
});
