import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** 유저 (F-010 가입·로그인, 후순위). 비회원 참가자는 이 테이블과 연결되지 않는다. */
@Entity({ name: 'users', comment: '유저' })
@Unique('uk_users_login_id', ['loginId'])
export class User {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'user_id',
    comment: '유저 ID',
  })
  id: number;

  @Column({
    name: 'login_id',
    type: 'varchar',
    length: 50,
    comment: '로그인 아이디',
  })
  loginId: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    comment: '비밀번호 해시',
  })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, comment: '닉네임' })
  nickname: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '가입 일시',
  })
  createdAt: Date;
}
