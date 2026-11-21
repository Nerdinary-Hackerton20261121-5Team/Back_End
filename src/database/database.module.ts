import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDatabaseOptions } from './database.config.js';
import { ENTITIES } from './entities.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDatabaseOptions(),
        // 관계로 이어진 엔티티가 빠지지 않도록 전체 목록을 등록한다 (src/database/entities.ts)
        entities: ENTITIES,
        // 기능 모듈은 쓰는 엔티티를 TypeOrmModule.forFeature([...])로 주입받는다
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
