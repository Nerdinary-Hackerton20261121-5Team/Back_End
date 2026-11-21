import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type ValueTransformer,
} from 'typeorm';
import { Session } from './session.entity.js';

/** DECIMAL은 드라이버가 문자열로 주므로 number로 바꾼다 */
const decimalToNumber: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** 참가자. 가입 없이 토큰으로 식별하며, 토큰은 해시만 저장한다 (POL-003). */
@Entity({ name: 'participant', comment: '참가자' })
@Unique('uk_participant_token', ['tokenHash'])
@Unique('uk_participant_join_request', ['sessionId', 'joinRequestId'])
export class Participant {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'participant_id',
    comment: '참가자 ID',
  })
  id: number;

  @Column({ name: 'session_id', type: 'bigint', comment: '세션 ID' })
  sessionId: number;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_participant_session',
  })
  session?: Session;

  @Column({
    name: 'token_hash',
    type: 'char',
    length: 64,
    comment: '참가 토큰 해시',
  })
  tokenHash: string;

  @Column({
    name: 'join_request_id',
    type: 'varchar',
    length: 64,
    comment: '입장 요청 ID',
  })
  joinRequestId: string;

  @Column({
    name: 'is_creator',
    type: 'boolean',
    default: false,
    comment: '개설자 여부',
  })
  isCreator: boolean;

  @Column({
    name: 'last_heartbeat_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '마지막 연결 확인 일시',
  })
  lastHeartbeatAt: Date | null;

  @Column({
    name: 'disconnected_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '연결 끊김 일시',
  })
  disconnectedAt: Date | null;

  @Column({
    name: 'final_restoration',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
    comment: '최종 복원도 (0~1)',
    transformer: decimalToNumber,
  })
  finalRestoration: number | null;

  @Column({
    name: 'joined_at',
    type: 'datetime',
    precision: 3,
    comment: '입장 일시',
  })
  joinedAt: Date;
}
