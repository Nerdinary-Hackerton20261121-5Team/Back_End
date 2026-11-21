import {
  focusSnapshot,
  pendingFocusMs,
  type FocusRecord,
} from './focus-time.js';
import type { SessionTimer } from './session-clock.js';

const T0 = new Date('2026-11-22T00:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const MIN = 60;
const TIMEOUT = 30;

const timer: SessionTimer = { startedAt: T0, goalSeconds: 20 * MIN };

const record = (over: Partial<FocusRecord> = {}): FocusRecord => ({
  focusedMs: 0,
  presence: 'FOCUSING',
  lastHeartbeatAt: at(0),
  disconnectedAt: null,
  finalRestoration: null,
  ...over,
});

describe('pendingFocusMs', () => {
  it('직전 상태가 FOCUSING이면 마지막 heartbeat 이후 구간을 인정한다', () => {
    expect(pendingFocusMs(timer, record(), at(10), TIMEOUT)).toBe(10_000);
  });

  it('PAUSED·AWAY 구간은 쌓이지 않는다', () => {
    expect(
      pendingFocusMs(timer, record({ presence: 'PAUSED' }), at(10), TIMEOUT),
    ).toBe(0);
    expect(
      pendingFocusMs(timer, record({ presence: 'AWAY' }), at(10), TIMEOUT),
    ).toBe(0);
  });

  it('단절 기준을 넘긴 구간은 늦게 온 heartbeat로도 인정받지 못한다', () => {
    expect(pendingFocusMs(timer, record(), at(TIMEOUT + 1), TIMEOUT)).toBe(0);
  });

  it('종료 시각 뒤로는 시간이 흐르지 않는다 (마지막 구간은 종료 시각까지)', () => {
    const last = record({ lastHeartbeatAt: at(20 * MIN - 5) });
    expect(pendingFocusMs(timer, last, at(99 * MIN), TIMEOUT)).toBe(5_000);
  });
});

describe('focusSnapshot', () => {
  it('누적값 + 마지막 heartbeat 이후 구간으로 복원도를 계산한다', () => {
    const snap = focusSnapshot(
      timer,
      record({ focusedMs: 5 * MIN * 1000, lastHeartbeatAt: at(8 * MIN) }),
      at(8 * MIN + 10),
      TIMEOUT,
    );
    expect(snap).toEqual({
      state: 'FOCUSING',
      focusedMs: (5 * MIN + 10) * 1000,
      restoration: (5 * MIN + 10) / (20 * MIN),
    });
  });

  it('신호가 단절 기준 넘게 없으면 DISCONNECTED, 저장된 누적값만 인정', () => {
    const snap = focusSnapshot(
      timer,
      record({ focusedMs: 60_000, lastHeartbeatAt: at(2 * MIN) }),
      at(10 * MIN),
      TIMEOUT,
    );
    expect(snap.state).toBe('DISCONNECTED');
    expect(snap.focusedMs).toBe(60_000);
  });

  it('일시정지 상태는 그대로 보이고 시간은 늘지 않는다', () => {
    const snap = focusSnapshot(
      timer,
      record({ presence: 'PAUSED', focusedMs: 1000, lastHeartbeatAt: at(60) }),
      at(70),
      TIMEOUT,
    );
    expect(snap).toMatchObject({ state: 'PAUSED', focusedMs: 1000 });
  });

  it('확정값이 있으면 그대로 쓴다 (다시 더하지 않음)', () => {
    const snap = focusSnapshot(
      timer,
      record({
        focusedMs: 600_000,
        finalRestoration: 0.5,
        lastHeartbeatAt: at(20 * MIN - 5),
      }),
      at(99 * MIN),
      TIMEOUT,
    );
    expect(snap).toEqual({
      state: 'FOCUSING',
      focusedMs: 600_000,
      restoration: 0.5,
    });
  });

  it('시작 전 0, 누적은 목표 시간을 넘지 않는다 (AC-014)', () => {
    expect(
      focusSnapshot(
        { startedAt: null, goalSeconds: 60 },
        record(),
        at(10),
        TIMEOUT,
      ),
    ).toMatchObject({ focusedMs: 0, restoration: 0 });
    const over = focusSnapshot(
      timer,
      record({ focusedMs: 99 * MIN * 1000, lastHeartbeatAt: at(20 * MIN) }),
      at(20 * MIN),
      TIMEOUT,
    );
    expect(over.restoration).toBe(1);
  });
});
