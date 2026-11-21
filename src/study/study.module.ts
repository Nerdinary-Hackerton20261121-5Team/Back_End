import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { SourcePiece } from '../puzzle/entities/source-piece.entity.js';
import { Participant } from '../sessions/entities/participant.entity.js';
import { Session } from '../sessions/entities/session.entity.js';
import { StudyController } from './study.controller.js';
import { StudyService } from './study.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Participant, SourcePiece]),
    AuthModule,
  ],
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
