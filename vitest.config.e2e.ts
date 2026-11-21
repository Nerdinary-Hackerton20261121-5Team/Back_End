import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e는 원격 dev DB(app_dev)를 오가므로 여러 명 입장처럼 요청이 많은 테스트는 5초(기본)를 넘길 수 있다
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
