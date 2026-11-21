import { ApiProperty } from '@nestjs/swagger';
import {
  SESSION_STATUSES,
  type SessionStatus,
} from '../../sessions/entities/session.entity.js';
import { MEMBER_STATES, type MemberState } from '../focus-time.js';

const MEMBER_STATE_DESCRIPTION =
  'FOCUSING = 기록 중(얼굴 인식), PAUSED = 일시정지, AWAY = 얼굴 인식 안 됨, ' +
  'DISCONNECTED = heartbeat가 단절 기준 시간 넘게 끊김. FOCUSING일 때만 시간이 쌓인다';

export class HeartbeatResponseDto {
  @ApiProperty({ enum: SESSION_STATUSES, example: 'FOCUSING' })
  status: SessionStatus;

  @ApiProperty({
    enum: MEMBER_STATES,
    description: `내 상태. ${MEMBER_STATE_DESCRIPTION}`,
    example: 'FOCUSING',
  })
  state: MemberState;

  @ApiProperty({
    description: '내 누적 집중 시간(초). 얼굴이 인식된 시간의 합',
    example: 1200,
  })
  focusedSeconds: number;

  @ApiProperty({
    description:
      '내 연결이 끊긴 상태인지 (= state가 DISCONNECTED). 끊긴 동안은 시간이 쌓이지 않고, 다시 heartbeat를 보내면 이어서 쌓인다',
    example: false,
  })
  disconnected: boolean;

  @ApiProperty({
    description: '내 복원도 0~1 = 누적 집중 시간 / 목표 시간',
    example: 0.25,
  })
  myRestoration: number;

  @ApiProperty({ description: '남은 시간(초)', example: 45 })
  remainingSeconds: number;

  @ApiProperty({
    description:
      '다음 heartbeat까지 권장 간격(초). 상태가 바뀌면 기다리지 말고 바로 보낸다',
    example: 1,
  })
  heartbeatIntervalSeconds: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:00:15.000Z',
  })
  serverNow: Date;
}

export class BoardMemberDto {
  @ApiProperty({ example: 1 })
  participantId: number;

  @ApiProperty({ nullable: true, type: String, example: '졸린 도도' })
  nickname: string | null;

  @ApiProperty({ example: true })
  isMe: boolean;

  @ApiProperty({
    enum: MEMBER_STATES,
    description: MEMBER_STATE_DESCRIPTION,
    example: 'FOCUSING',
  })
  state: MemberState;

  @ApiProperty({
    description: '누적 집중 시간(초). "기록 중 · n분째" 표시에 쓴다',
    example: 1200,
  })
  focusedSeconds: number;

  @ApiProperty({ description: '복원도 0~1', example: 0.64 })
  restoration: number;
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
      '조각 주인의 복원도 0~1 (누적 집중 시간 / 목표 시간). 진행 링 표시용으로 모두 공개한다. 조각 이미지는 남의 것이면 블러',
    example: 0.25,
  })
  restoration: number;
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
    description:
      '내 연결이 끊긴 상태인지 (members에서 내 state가 DISCONNECTED)',
    example: false,
  })
  myDisconnected: boolean;

  @ApiProperty({
    type: [BoardMemberDto],
    description: '함께 하는 사람 명단, 입장 순서',
  })
  members: BoardMemberDto[];

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

export class ResultMemberDto {
  @ApiProperty({ example: 1 })
  participantId: number;

  @ApiProperty({ nullable: true, type: String, example: '졸린 도도' })
  nickname: string | null;

  @ApiProperty({ example: true })
  isMe: boolean;

  @ApiProperty({ example: false })
  isCreator: boolean;

  @ApiProperty({ description: '누적 집중 시간(초)', example: 1200 })
  focusedSeconds: number;

  @ApiProperty({
    description:
      '집중하지 못한 시간(초) = 목표 시간 - 누적 집중 시간 (일시정지·얼굴 인식 안 됨·연결 끊김 포함)',
    example: 600,
  })
  unfocusedSeconds: number;

  @ApiProperty({ description: '최종 복원도 0~1', example: 0.6667 })
  restoration: number;

  @ApiProperty({
    description: '공부가 끝날 때 연결이 끊겨 있었는지 (조각이 자동 배치된다)',
    example: false,
  })
  absent: boolean;
}

export class ResultResponseDto {
  @ApiProperty({ enum: SESSION_STATUSES, example: 'ASSEMBLING' })
  status: SessionStatus;

  @ApiProperty({ description: '목표 시간(초)', example: 1800 })
  goalSeconds: number;

  @ApiProperty({ description: '팀 통과(조립 완료) 여부', example: false })
  completed: boolean;

  @ApiProperty({
    description: '팀 평균 복원도 0~1',
    example: 0.75,
  })
  averageRestoration: number;

  @ApiProperty({
    type: [ResultMemberDto],
    description: '참가자별 결과, 입장 순서',
  })
  members: ResultMemberDto[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:30:15.000Z',
  })
  serverNow: Date;
}
