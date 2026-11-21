import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../entities/session.entity.js';

/** 세션 시작 응답. 조각 배치는 진행판(GET /board)으로 받는다. */
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

  @ApiProperty({
    description: '조각 격자 행 수 = 인원 (한 행 = 참가자 1명의 조각 2개)',
    example: 4,
  })
  gridRows: number;

  @ApiProperty({ description: '조각 격자 열 수 (항상 2)', example: 2 })
  gridCols: number;

  @ApiProperty({ description: '조각 총수 = 인원 × 2', example: 8 })
  pieceCount: number;

  @ApiProperty({
    description:
      '세션 생성 때 저장한 분할 수. 조립 단계를 쓰지 않아 지금은 참고용',
    example: 4,
  })
  splitCount: number;

  @ApiProperty({
    description: '조립 조각 수. 조립 조각을 만들지 않아 항상 0 (호환용)',
    example: 0,
  })
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
