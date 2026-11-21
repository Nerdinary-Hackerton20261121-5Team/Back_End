import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../../sessions/entities/session.entity.js';

export class HeartbeatResponseDto {
  @ApiProperty({ enum: SESSION_STATUSES, example: 'FOCUSING' })
  status: SessionStatus;

  @ApiProperty({
    description:
      '내 연결이 끊긴 것으로 확정됐는지. true면 복원도가 끊긴 시점에 고정되고 더 늘지 않는다 (AC-016)',
    example: false,
  })
  disconnected: boolean;

  @ApiProperty({ description: '내 복원도 0~1', example: 0.25 })
  myRestoration: number;

  @ApiProperty({ description: '남은 시간(초)', example: 45 })
  remainingSeconds: number;

  @ApiProperty({
    description: '다음 heartbeat까지 권장 간격(초)',
    example: 10,
  })
  heartbeatIntervalSeconds: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:15.000Z',
  })
  serverNow: Date;
}

export class BoardPieceDto {
  @ApiProperty({
    description:
      '원조각 위치 번호. 왼쪽 위부터 1, 한 행에 2칸 (gridRows × gridCols 격자)',
    example: 1,
  })
  position: number;

  @ApiProperty({
    description:
      '격자에서 차지하는 칸 수. 5명일 때 마지막(5번) 원조각만 2(맨 아래 행 전체), 나머지는 1',
    enum: [1, 2],
    example: 1,
  })
  colSpan: number;

  @ApiProperty({ description: '내 원조각인지', example: true })
  isMine: boolean;

  @ApiProperty({
    description:
      '복원도 0~1. 집중 중에는 내 조각만 값이 있고 남의 조각은 null(블러로 표시). 조립 단계부터 모두 공개',
    nullable: true,
    type: Number,
    example: 0.25,
  })
  restoration: number | null;
}

export class BoardResponseDto {
  @ApiProperty({ enum: SESSION_STATUSES, example: 'FOCUSING' })
  status: SessionStatus;

  @ApiProperty({ example: 60 })
  goalSeconds: number;

  @ApiProperty({ example: 15 })
  elapsedSeconds: number;

  @ApiProperty({ example: 45 })
  remainingSeconds: number;

  @ApiProperty({ description: '원조각 격자 행 수', example: 2 })
  gridRows: number;

  @ApiProperty({ description: '원조각 격자 열 수', example: 2 })
  gridCols: number;

  @ApiProperty({
    description: '내 연결이 끊겨 복원도가 고정됐는지',
    example: false,
  })
  myDisconnected: boolean;

  @ApiProperty({
    type: [BoardPieceDto],
    description: '원조각 목록 (시작 전이면 빈 배열)',
  })
  pieces: BoardPieceDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:15.000Z',
  })
  serverNow: Date;
}
