import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Image } from '../../storage/entities/image.entity.js';

/** 진행 단계. WAITING → FOCUSING → ASSEMBLING → COMPLETED */
export const SESSION_STATUSES = [
  'WAITING',
  'FOCUSING',
  'ASSEMBLING',
  'COMPLETED',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** 세션(방). 삭제하면 참가자·원조각·조립 조각이 함께 삭제된다 (AC-020). */
@Entity({ name: 'session', comment: '세션' })
@Unique('uk_session_code', ['sessionCode'])
@Unique('uk_session_create_request', ['createRequestId'])
export class Session {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'session_id',
    comment: '세션 ID',
  })
  id: number;

  @Column({
    name: 'session_code',
    type: 'varchar',
    length: 16,
    comment: '세션 코드',
  })
  sessionCode: string;

  @Column({
    name: 'create_request_id',
    type: 'varchar',
    length: 64,
    comment: '생성 요청 ID',
  })
  createRequestId: string;

  @Column({
    name: 'max_participants',
    type: 'int',
    nullable: true,
    comment: '정원 (Q-006 미정)',
  })
  maxParticipants: number | null;

  @Column({ name: 'goal_seconds', type: 'int', comment: '목표 시간(초)' })
  goalSeconds: number;

  @Column({ name: 'split_count', type: 'int', comment: '조립 분할 수' })
  splitCount: number;

  @Column({
    name: 'allow_random',
    type: 'boolean',
    default: false,
    comment: '랜덤 참가 허용 여부',
  })
  /** @deprecated 랜덤 매칭 제외(#59). API에서 쓰지 않고, 컬럼은 운영 반영 후 마이그레이션으로 삭제 예정 */
  allowRandom: boolean;

  @Column({
    name: 'image_id',
    type: 'bigint',
    nullable: true,
    comment: '퍼즐 이미지 ID',
  })
  imageId: number | null;

  @ManyToOne(() => Image, { nullable: true })
  @JoinColumn({
    name: 'image_id',
    foreignKeyConstraintName: 'fk_session_image',
  })
  image?: Image | null;

  @Column({
    name: 'grid_rows',
    type: 'int',
    nullable: true,
    comment: '원조각 행 수 (시작 때 확정)',
  })
  gridRows: number | null;

  @Column({
    name: 'grid_cols',
    type: 'int',
    nullable: true,
    comment: '원조각 열 수 (시작 때 확정)',
  })
  gridCols: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    comment: '진행 단계: WAITING | FOCUSING | ASSEMBLING | COMPLETED',
  })
  status: SessionStatus;

  @Column({
    name: 'started_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '집중 시작 일시',
  })
  startedAt: Date | null;

  @Column({
    name: 'ends_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '집중 종료 예정 일시',
  })
  endsAt: Date | null;

  @Column({
    name: 'assembly_started_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '조립 시작 일시',
  })
  assemblyStartedAt: Date | null;

  @Column({
    name: 'completed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '팀 통과 일시',
  })
  completedAt: Date | null;

  @Column({ type: 'bigint', default: 0, comment: '버전' })
  version: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '생성 일시',
  })
  createdAt: Date;
}
