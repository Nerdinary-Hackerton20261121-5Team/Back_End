import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../entities/session.entity.js';

/** 세션 시작 응답. 조립 조각의 정답 위치는 조립 단계 전까지 내려주지 않는다. */
export class StartSessionResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({ enum: SESSION_STATUSES, example: 'FOCUSING' })
  status: SessionStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:00.000Z',
  })
  startedAt: Date;

  @ApiProperty({
    description: '종료 예정 시각 = startedAt + goalSeconds',
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:01:00.000Z',
  })
  endsAt: Date;

  @ApiProperty({ example: 60 })
  goalSeconds: number;

  @ApiProperty({ description: '시작 시점에 고정된 명단 인원', example: 4 })
  participantCount: number;

  @ApiProperty({ description: '원조각 격자 행 수 (한 행에 2명)', example: 2 })
  gridRows: number;

  @ApiProperty({ description: '원조각 격자 열 수', example: 2 })
  gridCols: number;

  @ApiProperty({ description: '원조각 하나의 조립 조각 수 (1/4)', example: 4 })
  splitCount: number;

  @ApiProperty({ description: '조립 조각 총수 = 인원 × 분할 수', example: 16 })
  assemblyPieceCount: number;

  @ApiProperty({
    description: '이미 시작된 세션이라 처음 시작한 결과를 돌려줬는지 (AC-010)',
    example: false,
  })
  alreadyStarted: boolean;

  @ApiProperty({
    description: '서버 현재 시각',
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:00.000Z',
  })
  serverNow: Date;
}
