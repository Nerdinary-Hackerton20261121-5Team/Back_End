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

export const IMAGE_SOURCES = ['DEFAULT', 'UPLOAD'] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

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
  allowRandom: boolean;

  @Column({
    name: 'image_source',
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: '이미지 출처: DEFAULT | UPLOAD',
  })
  imageSource: ImageSource | null;

  @Column({
    name: 'default_image_id',
    type: 'bigint',
    nullable: true,
    comment: '기본 이미지 ID',
  })
  defaultImageId: number | null;

  @ManyToOne(() => Image, { nullable: true })
  @JoinColumn({
    name: 'default_image_id',
    foreignKeyConstraintName: 'fk_session_default_image',
  })
  defaultImage?: Image | null;

  @Column({
    name: 'upload_image_key',
    type: 'varchar',
    length: 300,
    nullable: true,
    comment: '업로드 이미지 키',
  })
  uploadImageKey: string | null;

  @Column({
    name: 'image_width',
    type: 'int',
    nullable: true,
    comment: '이미지 가로 크기',
  })
  imageWidth: number | null;

  @Column({
    name: 'image_height',
    type: 'int',
    nullable: true,
    comment: '이미지 세로 크기',
  })
  imageHeight: number | null;

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
