import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant } from '../sessions/entities/participant.entity.js';
import { ParticipantGuard } from './participant.guard.js';

/** 참가자 인증. @ParticipantAuth()를 쓰는 모듈이 import한다. */
@Module({
  imports: [TypeOrmModule.forFeature([Participant])],
  providers: [ParticipantGuard],
  exports: [ParticipantGuard, TypeOrmModule],
})
export class AuthModule {}
