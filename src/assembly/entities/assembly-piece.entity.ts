import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SourcePiece } from '../../puzzle/entities/source-piece.entity.js';
import { Session } from '../../sessions/entities/session.entity.js';

/** 원조각 하나를 조립 조각 2개로 나눈다 */
export const ASSEMBLY_SPLIT_COUNT = 2;

/**
 * 조립 조각 (F-006). 틀린 칸에 놓으면 저장하지 않고 되돌리므로,
 * 조각은 대기 영역(placed_at NULL)이거나 정답 위치(position)에 놓인 상태 둘 중 하나다.
 * 옮길 수 있는 주인은 원조각(source_piece)의 소유자다.
 * 원조각 하나를 split_count(=2)개로 나누고, 그중 몇 번째인지를 slot으로 갖는다.
 */
@Entity({ name: 'assembly_piece', comment: '조립 조각' })
@Unique('uk_assembly_piece_position', ['sessionId', 'position'])
@Unique('uk_assembly_piece_slot', ['sourcePieceId', 'slot'])
export class AssemblyPiece {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'assembly_piece_id',
    comment: '조립 조각 ID',
  })
  id: number;

  @Column({ name: 'session_id', type: 'bigint', comment: '세션 ID' })
  sessionId: number;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_assembly_piece_session',
  })
  session?: Session;

  @Column({ name: 'source_piece_id', type: 'bigint', comment: '원조각 ID' })
  sourcePieceId: number;

  @ManyToOne(() => SourcePiece, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'source_piece_id',
    foreignKeyConstraintName: 'fk_assembly_piece_source',
  })
  sourcePiece?: SourcePiece;

  @Column({
    name: 'split_count',
    type: 'int',
    default: ASSEMBLY_SPLIT_COUNT,
    comment: '원조각 분할 수',
  })
  splitCount: number;

  @Column({ type: 'int', comment: '원조각 안 slot 번호 (1 ~ split_count)' })
  slot: number;

  @Column({ type: 'int', comment: '정답 위치 번호 (조립판 왼쪽 위부터 1)' })
  position: number;

  @Column({
    name: 'placed_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
    comment: '놓인 일시 (NULL = 대기 영역)',
  })
  placedAt: Date | null;

  @Column({
    name: 'auto_placed',
    type: 'boolean',
    default: false,
    comment: '자동 배치 여부',
  })
  autoPlaced: boolean;
}
