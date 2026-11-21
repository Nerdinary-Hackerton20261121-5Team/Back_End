import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 유저(users) 테이블과 참가자의 유저 연결(participant.user_id)을 없앤다.
 * 참가자는 가입 없이 토큰으로만 식별하고, user_id를 읽는 코드가 없다.
 * down은 빈 users 테이블과 NULL인 user_id 열만 되살린다(지운 행은 복구되지 않는다).
 */
export class DropUsers1795800000000 implements MigrationInterface {
  name = 'DropUsers1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`participant\` DROP FOREIGN KEY \`fk_participant_user\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_participant_session_user\` ON \`participant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` DROP COLUMN \`user_id\``,
    );
    await queryRunner.query(`DROP INDEX \`uk_users_login_id\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`user_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '유저 ID', \`login_id\` varchar(50) NOT NULL COMMENT '로그인 아이디', \`password_hash\` varchar(255) NOT NULL COMMENT '비밀번호 해시', \`nickname\` varchar(20) NOT NULL COMMENT '닉네임', \`created_at\` datetime(3) NOT NULL COMMENT '가입 일시' DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`uk_users_login_id\` (\`login_id\`), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB COMMENT="유저"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` ADD \`user_id\` bigint NULL COMMENT '유저 ID (비회원이면 NULL)'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uk_participant_session_user\` ON \`participant\` (\`session_id\`, \`user_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` ADD CONSTRAINT \`fk_participant_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
