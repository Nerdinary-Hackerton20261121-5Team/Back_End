import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AssemblyController } from './assembly.controller.js';
import { AssemblyService } from './assembly.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AssemblyController],
  providers: [AssemblyService],
})
export class AssemblyModule {}
