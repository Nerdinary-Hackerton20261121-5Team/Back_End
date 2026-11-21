import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Participant } from '../../sessions/entities/participant.entity.js';
import { Session } from '../../sessions/entities/session.entity.js';

/**
 * 원조각. 참가자 1명당 1개, 위치는 원조각 격자 왼쪽 위부터 1 (F-008).
 * 세션 이미지를 session.grid_rows × grid_cols로 나눈 칸(slot)을 slot_row·slot_col로 갖는다.
 */
@Entity({ name: 'source_piece', comment: '원조각' })
@Unique('uk_source_piece_position', ['sessionId', 'position'])
@Unique('uk_source_piece_slot', ['sessionId', 'slotRow', 'slotCol'])
@Unique('uk_source_piece_owner', ['participantId'])
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

  @Column({ type: 'int', comment: '위치 번호 (왼쪽 위부터 1)' })
  position: number;

  @Column({
    name: 'slot_row',
    type: 'int',
    comment: 'slot 행 번호 (1 ~ session.grid_rows)',
  })
  slotRow: number;

  @Column({
    name: 'slot_col',
    type: 'int',
    comment: 'slot 열 번호 (1 ~ session.grid_cols)',
  })
  slotCol: number;
}
