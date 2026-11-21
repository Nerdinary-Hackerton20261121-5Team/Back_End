import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import { SessionMeDto } from '../../sessions/dto/session-response.dto.js';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../../sessions/entities/session.entity.js';

export class PlacePieceDto {
  @ApiProperty({
    description: '놓으려는 조립판 칸 번호 (왼쪽 위부터 1)',
    example: 3,
  })
  @IsInt()
  @IsPositive()
  targetPosition: number;
}

export class AssemblySlotDto {
  @ApiProperty({ description: '칸 번호 (왼쪽 위부터 1)', example: 1 })
  position: number;

  @ApiProperty({ description: '행 (0부터)', example: 0 })
  row: number;

  @ApiProperty({ description: '열 (0부터, 0~1)', example: 0 })
  col: number;

  @ApiProperty({
    description: '차지하는 열 수. 지금은 항상 1',
    example: 1,
  })
  colSpan: number;
}

export class AssemblyPieceDto {
  @ApiProperty({
    description: '조각 ID (= 공부 화면의 조각 ID, 조각 놓기 요청에 사용)',
    example: 11,
  })
  pieceId: number;

  @ApiProperty({
    description:
      '이 조각 주인의 참가자 ID. 참가자 1명당 조각 2개라 같은 값이 2번 나온다 (누구 조각인지 표시용)',
    example: 3,
  })
  participantId: number;

  @ApiProperty({ description: '내가 옮길 수 있는 조각인지', example: true })
  isMine: boolean;

  @ApiProperty({ description: '조각 너비(열 수). 지금은 항상 1', example: 1 })
  colSpan: number;

  @ApiProperty({
    description:
      '이 조각 주인의 최종 복원도 0~1. 복원된 만큼만 무늬가 보이도록 그린다',
    example: 0.8,
  })
  restoration: number;

  @ApiProperty({ description: '정답 칸에 놓였는지', example: false })
  placed: boolean;

  @ApiProperty({
    description:
      '놓인 칸 번호. 대기 영역에 있으면 null (정답 위치는 놓이기 전까지 알려주지 않음)',
    nullable: true,
    type: Number,
    example: null,
  })
  position: number | null;

  @ApiProperty({
    description: '집중 종료 때 접속해 있지 않아 자동으로 배치된 조각인지',
    example: false,
  })
  autoPlaced: boolean;
}

export class AssemblyBoardResponseDto {
  @ApiProperty({ enum: SESSION_STATUSES, example: 'ASSEMBLING' })
  status: SessionStatus;

  @ApiProperty({
    type: SessionMeDto,
    description: '요청한 참가자. pieces[].participantId와 비교하면 내 조각이다',
  })
  me: SessionMeDto;

  @ApiProperty({
    description: '조립판 행 수 = 조각 격자 행 수(참가자 수)',
    example: 4,
  })
  boardRows: number;

  @ApiProperty({ description: '조립판 열 수 = 조각 격자 열 수', example: 2 })
  boardCols: number;

  @ApiProperty({ description: '조각 수 = 참가자 수 × 2', example: 8 })
  totalPieces: number;

  @ApiProperty({ example: 4 })
  placedCount: number;

  @ApiProperty({
    description: '모든 조각이 정답 칸에 놓였는지 (팀 통과)',
    example: false,
  })
  completed: boolean;

  @ApiProperty({ type: [AssemblySlotDto] })
  slots: AssemblySlotDto[];

  @ApiProperty({ type: [AssemblyPieceDto] })
  pieces: AssemblyPieceDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:01:05.000Z',
  })
  serverNow: Date;
}

export class PlacePieceResponseDto {
  @ApiProperty({ example: 11 })
  pieceId: number;

  @ApiProperty({
    description:
      '정답 칸이면 true(저장됨). false면 저장하지 않으니 직전 위치로 되돌린다',
    example: true,
  })
  correct: boolean;

  @ApiProperty({
    description: 'correct가 false인 이유',
    enum: ['WRONG_POSITION', 'OCCUPIED'],
    nullable: true,
    example: null,
  })
  reason: 'WRONG_POSITION' | 'OCCUPIED' | null;

  @ApiProperty({
    description: '지금 이 조각이 정답 칸에 놓여 있는지',
    example: true,
  })
  placed: boolean;

  @ApiProperty({ example: 5 })
  placedCount: number;

  @ApiProperty({ example: 8 })
  totalPieces: number;

  @ApiProperty({ description: '팀 통과 여부', example: false })
  completed: boolean;
}
