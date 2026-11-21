import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 기본 이미지 (F-008). 서비스 자산이라 세션이 폐기돼도 지우지 않는다. */
@Entity({ name: 'images', comment: '기본 이미지' })
export class Image {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'image_id',
    comment: '이미지 ID',
  })
  id: number;

  @Column({ type: 'varchar', length: 100, comment: '이미지 이름' })
  name: string;

  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 500,
    comment: '이미지 URL',
  })
  imageUrl: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '등록 일시',
  })
  createdAt: Date;
}
