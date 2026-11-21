import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { SessionCleanupService } from '../src/cleanup/session-cleanup.service.js';
import { Participant } from '../src/sessions/entities/participant.entity.js';
import { Session } from '../src/sessions/entities/session.entity.js';

// 끝났거나 방치된 방 자동 정리 (#64, POL-010, TODO(Q-004)).
// 실제 DB(.env의 app_dev)에 방을 만들고 시각만 과거로 돌려 정리 기준을 확인한다. 남은 세션은 끝나면 지운다.
describe('세션 자동 정리 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let cleanup: SessionCleanupService;
  const created: number[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = app.get(DataSource);
    cleanup = app.get(SessionCleanupService);
  });

  afterAll(async () => {
    if (created.length) await dataSource.getRepository(Session).delete(created);
    await app.close();
  });

  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

  async function createSession(): Promise<number> {
    const res = await request(app.getHttpServer())
      .post('/api/sessions')
      .send({
        goalSeconds: 60,
        maxParticipants: 4,
        clientRequestId: randomUUID(),
      })
      .expect(201);
    const id = res.body.data.sessionId as number;
    created.push(id);
    return id;
  }

  async function backdate(id: number, changes: Partial<Session>) {
    await dataSource.getRepository(Session).update({ id }, changes);
  }

  async function backdateCreatedAt(id: number, at: Date) {
    await dataSource.query(
      'UPDATE session SET created_at = ? WHERE session_id = ?',
      [at, id],
    );
  }

  it('기준 시간이 지난 방만 지우고, 참가자도 함께 지운다', async () => {
    // 지울 대상 (기본값: 완성 60분, 시작 전 120분, 미완성 종료 후 60분)
    const oldWaiting = await createSession();
    await backdateCreatedAt(oldWaiting, minutesAgo(121));

    const oldCompleted = await createSession();
    await backdate(oldCompleted, {
      status: 'COMPLETED',
      startedAt: minutesAgo(130),
      endsAt: minutesAgo(129),
      completedAt: minutesAgo(61),
    });

    const oldUnfinished = await createSession();
    await backdate(oldUnfinished, {
      status: 'FOCUSING',
      startedAt: minutesAgo(62),
      endsAt: minutesAgo(61),
    });

    // 남길 대상
    const freshWaiting = await createSession();
    await backdateCreatedAt(freshWaiting, minutesAgo(119));

    const freshCompleted = await createSession();
    await backdate(freshCompleted, {
      status: 'COMPLETED',
      startedAt: minutesAgo(70),
      endsAt: minutesAgo(69),
      completedAt: minutesAgo(59),
    });

    const assemblingNow = await createSession();
    await backdate(assemblingNow, {
      status: 'ASSEMBLING',
      startedAt: minutesAgo(30),
      endsAt: minutesAgo(29),
    });

    const deleted = await cleanup.purge();
    expect(deleted).toBeGreaterThanOrEqual(3);

    const remaining = await dataSource.getRepository(Session).find({
      where: { id: In(created) },
      select: { id: true },
    });
    const ids = remaining.map((s) => Number(s.id));
    expect(ids).not.toContain(oldWaiting);
    expect(ids).not.toContain(oldCompleted);
    expect(ids).not.toContain(oldUnfinished);
    expect(ids).toEqual(
      expect.arrayContaining([freshWaiting, freshCompleted, assemblingNow]),
    );

    // 지운 방의 참가자(개설자)도 함께 지워진다 (ON DELETE CASCADE)
    const orphans = await dataSource.getRepository(Participant).count({
      where: { sessionId: In([oldWaiting, oldCompleted, oldUnfinished]) },
    });
    expect(orphans).toBe(0);
  });

  it('지울 방이 없으면 다시 돌려도 남은 방은 그대로', async () => {
    const fresh = await createSession();
    await cleanup.purge();
    await cleanup.purge();
    const row = await dataSource
      .getRepository(Session)
      .findOneBy({ id: fresh });
    expect(row).not.toBeNull();
  });

  it('앱이 뜨면 정리 작업이 주기 작업으로 등록된다', () => {
    expect(app.get(SchedulerRegistry).getIntervals()).toContain(
      'session-cleanup',
    );
  });
});
