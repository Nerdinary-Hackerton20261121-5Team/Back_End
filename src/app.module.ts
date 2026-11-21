import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssemblyModule } from './assembly/assembly.module.js';
import { CleanupModule } from './cleanup/cleanup.module.js';
import { CommonModule } from './common/common.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { StorageModule } from './storage/storage.module.js';
import { StudyModule } from './study/study.module.js';
import { ThrottleModule } from './throttle/throttle.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    ThrottleModule,
    DatabaseModule,
    HealthModule,
    SessionsModule,
    StorageModule,
    StudyModule,
    AssemblyModule,
    CleanupModule,
  ],
})
export class AppModule {}
