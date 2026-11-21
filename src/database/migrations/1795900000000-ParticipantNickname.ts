import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * participant에 nickname(VARCHAR(20) NULL)을 더한다.
 * 일부 DB에는 이미 손으로 추가했으므로, 컬럼이 있으면 건너뛴다.
 */
export class ParticipantNickname1795900000000 implements MigrationInterface {
  name = 'ParticipantNickname1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('participant', 'nickname')) return;
    await queryRunner.query(
      `ALTER TABLE \`participant\` ADD \`nickname\` varchar(20) NULL COMMENT '닉네임'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('participant', 'nickname'))) return;
    await queryRunner.query(
      `ALTER TABLE \`participant\` DROP COLUMN \`nickname\``,
    );
  }
}
