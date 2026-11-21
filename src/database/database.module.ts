import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDatabaseOptions } from './database.config.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDatabaseOptions(),
        entities: [],
        // 각 기능 모듈의 TypeOrmModule.forFeature([...])에 등록한 엔티티를 자동으로 모은다
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
