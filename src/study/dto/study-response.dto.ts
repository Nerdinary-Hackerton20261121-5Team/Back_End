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

export class PieceEdgesDto {
  @ApiProperty({ enum: [-1, 0, 1], example: 0 })
  top: number;

  @ApiProperty({ enum: [-1, 0, 1], example: 1 })
  right: number;

  @ApiProperty({ enum: [-1, 0, 1], example: -1 })
  bottom: number;

  @ApiProperty({ enum: [-1, 0, 1], example: 0 })
  left: number;
}

export class BoardPieceDto {
  @ApiProperty({
    description:
      '정답 칸 번호. 왼쪽 위부터 1 (gridRows × gridCols 격자). 결과 화면에서 조각을 놓는 자리',
    example: 1,
  })
  position: number;

  @ApiProperty({
    type: PieceEdgesDto,
    description:
      '직소 모양. 변마다 1 = 탭(바깥으로 튀어나옴), -1 = 홈, 0 = 테두리. 이웃 조각과 서로 맞물린다',
  })
  edges: PieceEdgesDto;

  @ApiProperty({
    description:
      '조각 이미지 경로(GET, 참가자 토큰 필요). 세션에 이미지가 없으면 null',
    nullable: true,
    type: String,
    example: '/api/sessions/1/pieces/1/image',
  })
  imagePath: string | null;

  @ApiProperty({
    description:
      '공부 중 화면에 놓이는 칸 번호. 조각끼리 겹치지 않고, 주인의 정답 칸(자기·짝 조각 칸)과도 다르다. 시작 전 조각은 null',
    nullable: true,
    type: Number,
    example: 5,
  })
  displaySlot: number | null;

  @ApiProperty({
    description: '격자에서 차지하는 칸 수. 지금은 항상 1 (호환용)',
    enum: [1],
    example: 1,
  })
  colSpan: number;

  @ApiProperty({
    description: '내 조각인지. 참가자 1명당 2개라 true인 조각이 2개다',
    example: true,
  })
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

  @ApiProperty({ description: '조각 격자 행 수 = 인원', example: 4 })
  gridRows: number;

  @ApiProperty({ description: '조각 격자 열 수 (항상 2)', example: 2 })
  gridCols: number;

  @ApiProperty({ description: '세션에 이미지가 있는지', example: true })
  hasImage: boolean;

  @ApiProperty({
    description:
      '조각 이미지 여백 비율. 조각 이미지는 칸보다 좌우로 칸 너비×padRatio, 위아래로 칸 높이×padRatio만큼 크다 (탭 자리)',
    example: 0.2,
  })
  padRatio: number;

  @ApiProperty({
    description: '내 연결이 끊겨 복원도가 고정됐는지',
    example: false,
  })
  myDisconnected: boolean;

  @ApiProperty({
    type: [BoardPieceDto],
    description: '조각 목록, 정답 칸 순서 (시작 전이면 빈 배열)',
  })
  pieces: BoardPieceDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:15.000Z',
  })
  serverNow: Date;
}
