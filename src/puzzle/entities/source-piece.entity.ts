import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Participant } from '../../sessions/entities/participant.entity.js';
import { Session } from '../../sessions/entities/session.entity.js';

/** 참가자 한 명이 갖는 조각 수 */
export const PIECES_PER_PARTICIPANT = 2;

/**
 * 조각 (F-008). 세션 이미지를 session.grid_rows × grid_cols 격자로 나눈 칸 하나이고, 참가자 1명당 2개다.
 * 칸 번호(slot)는 왼쪽 위부터 1이다.
 * - position: 정답 칸. 결과 화면에서 조각이 놓이는 자리
 * - display_slot: 공부 중 화면에 놓이는 칸. 시작할 때 랜덤으로 정하고, 조각의 정답 칸과 겹치지 않는다
 * - placed_at: 조립판(F-006)에서 정답 칸에 놓인 일시. 틀린 칸은 저장하지 않으므로
 *   조각은 대기 영역(NULL)이거나 정답 칸(position)에 놓인 상태 둘 중 하나다
 * 진행률은 참가자 단위라 같은 참가자의 조각 2개가 함께 쓴다.
 */
@Entity({ name: 'source_piece', comment: '조각' })
@Unique('uk_source_piece_position', ['sessionId', 'position'])
@Unique('uk_source_piece_display_slot', ['sessionId', 'displaySlot'])
@Index('idx_source_piece_participant', ['participantId'])
export class SourcePiece {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'piece_id',
    comment: '조각 ID',
  })
  id: number;

  @Column({ name: 'session_id', type: 'bigint', comment: '세션 ID' })
  sessionId: number;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_source_piece_session',
  })
  session?: Session;

  @Column({
    name: 'participant_id',
    type: 'bigint',
    comment: '소유자 참가자 ID',
  })
  participantId: number;

  @ManyToOne(() => Participant, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'participant_id',
    foreignKeyConstraintName: 'fk_source_piece_participant',
  })
  participant?: Participant;

  @Column({ type: 'int', comment: '정답 slot (왼쪽 위부터 1)' })
  position: number;

  @Column({
    name: 'display_slot',
    type: 'int',
    nullable: true,
    comment: '공부 중 화면 배치 slot (정답 slot과 다름, NULL = 미배정)',
  })
  displaySlot: number | null;

  @Column({
    name: 'placed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '조립판 정답 칸에 놓인 일시 (NULL = 대기 영역)',
  })
  placedAt: Date | null;

  @Column({
    name: 'auto_placed',
    type: 'boolean',
    default: false,
    comment: '집중 종료 때 부재로 자동 배치됐는지',
  })
  autoPlaced: boolean;
}
