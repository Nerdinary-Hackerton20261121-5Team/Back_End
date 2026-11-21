import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Participant } from './entities/participant.entity.js';
import { Session } from './entities/session.entity.js';
import { SessionsController } from './sessions.controller.js';
import { SessionStartService } from './session-start.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Participant]), AuthModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionStartService],
  exports: [SessionsService],
})
export class SessionsModule {}
