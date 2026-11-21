import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { cleanupPolicy } from '../config/policy.js';
import { Session } from '../sessions/entities/session.entity.js';

const JOB_NAME = 'session-cleanup';
const MINUTE = 60_000;

/**
 * 끝났거나 방치된 방 자동 정리 (POL-010, SPEC `CLEANUP_AFTER`, TODO(Q-004)).
 * 세션 행을 지우면 참가자·조각은 ON DELETE CASCADE로 함께 지워지고 참가자 토큰도 무효가 된다.
 * - 완성(COMPLETED): 완성 후 completedRetentionMinutes 지나면 (결과 화면을 볼 시간)
 * - 시작 전(WAITING): 만든 뒤 waitingTtlMinutes 지나면
 * - 시작했지만 완성 못 함(FOCUSING·ASSEMBLING): 집중 종료(ends_at) 후 unfinishedAfterEndMinutes 지나면
 * 조건부 DELETE 한 번이라 여러 인스턴스에서 동시에 돌아도 결과가 같다.
 * TODO(POL-010): 업로드 사진(images 행·저장소 객체) 삭제는 방 삭제 API와 함께 이미지 담당과 연결
 */
@Injectable()
export class SessionCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const { enabled, intervalMinutes } = cleanupPolicy();
    if (!enabled) return;
    const timer = setInterval(() => {
      void this.purge().catch((error: unknown) => {
        this.logger.error('세션 자동 정리 실패', error as Error);
      });
    }, intervalMinutes * MINUTE);
    timer.unref();
    this.scheduler.addInterval(JOB_NAME, timer);
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist('interval', JOB_NAME)) {
      this.scheduler.deleteInterval(JOB_NAME);
    }
  }

  /** 기준이 지난 세션을 지우고 지운 개수를 돌려준다. */
  async purge(now: Date = new Date()): Promise<number> {
    const policy = cleanupPolicy();
    const before = (minutes: number) =>
      new Date(now.getTime() - minutes * MINUTE);

    const result = await this.sessions
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where(
        "(status = 'COMPLETED' AND completed_at < :completedBefore)" +
          " OR (status = 'WAITING' AND created_at < :createdBefore)" +
          " OR (status IN ('FOCUSING', 'ASSEMBLING') AND ends_at < :endedBefore)",
        {
          completedBefore: before(policy.completedRetentionMinutes),
          createdBefore: before(policy.waitingTtlMinutes),
          endedBefore: before(policy.unfinishedAfterEndMinutes),
        },
      )
      .execute();

    const deleted = result.affected ?? 0;
    if (deleted) this.logger.log(`세션 자동 정리: ${deleted}개 삭제`);
    return deleted;
  }
}
