import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../entities/session.entity.js';

/** 방 만들기·입장 응답. participantToken은 이 응답에서만 받을 수 있다. */
export class SessionEntryResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({
    description: '세션 코드 (초대·코드 입장용)',
    example: 'K7PX2Q',
  })
  sessionCode: string;

  @ApiProperty({ example: 1 })
  participantId: number;

  @ApiProperty({
    description:
      '참가자 토큰. 이후 요청의 X-Participant-Token 헤더에 넣는다 (Swagger: Authorize). 서버에는 해시만 저장한다',
    example: 'q3Jv0b0Kq6m7h2a9Yx1Zt5uW8eR4sD6fG0hJ2kL4nP8',
  })
  participantToken: string;

  @ApiProperty({ description: '개설자 여부', example: true })
  isCreator: boolean;

  @ApiProperty({
    description:
      '같은 clientRequestId 재전송으로 기존 방·참가자를 돌려줬는지. 이때 토큰은 새로 발급되고 이전 토큰은 무효',
    example: false,
  })
  restored: boolean;
}

export class SessionMeDto {
  @ApiProperty({ example: 1 })
  participantId: number;

  @ApiProperty({ example: true })
  isCreator: boolean;
}

/** 세션 조회 응답 */
export class SessionDetailResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({ example: 'K7PX2Q' })
  sessionCode: string;

  @ApiProperty({
    enum: SESSION_STATUSES,
    description:
      'WAITING(시작 전) → FOCUSING(집중) → ASSEMBLING(조립) → COMPLETED(팀 통과). 서버 시각으로 계산',
    example: 'WAITING',
  })
  status: SessionStatus;

  @ApiProperty({ example: 60 })
  goalSeconds: number;

  @ApiProperty({ example: 4 })
  maxParticipants: number | null;

  @ApiProperty({ description: '현재 입장 인원', example: 1 })
  participantCount: number;

  @ApiProperty({ description: '조립 분할 수 (1/4 → 4)', example: 4 })
  splitCount: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  startedAt: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  endsAt: Date | null;

  @ApiProperty({ description: '경과 시간(초)', example: 0 })
  elapsedSeconds: number;

  @ApiProperty({ description: '남은 시간(초), 음수 없음', example: 60 })
  remainingSeconds: number;

  @ApiProperty({
    description: '서버 현재 시각. 클라이언트 시계 보정용',
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:00.000Z',
  })
  serverNow: Date;

  @ApiProperty({ type: SessionMeDto })
  me: SessionMeDto;
}
