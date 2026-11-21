import { goalSecondsRange, heartbeatPolicy } from './policy.js';

describe('policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('환경변수가 없으면 임시 기본값', () => {
    vi.stubEnv('POLICY_GOAL_MIN_SECONDS', '');
    expect(goalSecondsRange()).toEqual({ min: 60, max: 14400 });
    expect(heartbeatPolicy()).toEqual({
      intervalSeconds: 1,
      disconnectTimeoutSeconds: 90,
    });
  });

  it('환경변수로 바꿀 수 있다', () => {
    vi.stubEnv('POLICY_GOAL_MIN_SECONDS', '300');
    expect(goalSecondsRange().min).toBe(300);
  });

  it('잘못된 값이면 기본값을 쓴다', () => {
    vi.stubEnv('POLICY_GOAL_MIN_SECONDS', '-5');
    expect(goalSecondsRange().min).toBe(60);
    vi.stubEnv('POLICY_GOAL_MIN_SECONDS', 'abc');
    expect(goalSecondsRange().min).toBe(60);
  });
});
