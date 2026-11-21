import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity.js';
import { SessionCleanupService } from './session-cleanup.service.js';

/** 끝났거나 방치된 방 자동 정리 (POL-010, TODO(Q-004)) */
@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([Session])],
  providers: [SessionCleanupService],
  exports: [SessionCleanupService],
})
export class CleanupModule {}
