import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** 이미지 출처. DEFAULT = 서비스가 준비한 기본 이미지, UPLOAD = 사용자가 올린 이미지 */
export const IMAGE_SOURCES = ['DEFAULT', 'UPLOAD'] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

/**
 * 퍼즐 이미지 (F-008). 세션은 image_id로 이 테이블을 가리킨다.
 * 기본 이미지는 서비스 자산이라 세션이 폐기돼도 지우지 않는다.
 */
@Entity({ name: 'images', comment: '이미지' })
@Unique('uk_images_key', ['imageKey'])
export class Image {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'image_id',
    comment: '이미지 ID',
  })
  id: number;

  @Column({
    type: 'varchar',
    length: 10,
    comment: '이미지 출처: DEFAULT | UPLOAD',
  })
  source: ImageSource;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '이미지 이름 (기본 이미지)',
  })
  name: string | null;

  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '이미지 URL (기본 이미지)',
  })
  imageUrl: string | null;

  @Column({
    name: 'image_key',
    type: 'varchar',
    length: 300,
    nullable: true,
    comment: '저장소 key (업로드 이미지)',
  })
  imageKey: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '등록 일시',
  })
  createdAt: Date;
}
