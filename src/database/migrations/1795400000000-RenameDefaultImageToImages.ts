import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * default_image 테이블을 images로 바꾸고 width·height 컬럼을 없앤다.
 * RENAME이라 기존 행은 유지되고, session.default_image_id FK는 MySQL이 새 이름으로 따라간다.
 */
export class RenameDefaultImageToImages1795400000000 implements MigrationInterface {
  name = 'RenameDefaultImageToImages1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`RENAME TABLE \`default_image\` TO \`images\``);
    await queryRunner.query(
      `ALTER TABLE \`images\` CHANGE \`default_image_id\` \`image_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '이미지 ID'`,
    );
    await queryRunner.query(`ALTER TABLE \`images\` DROP COLUMN \`width\``);
    await queryRunner.query(`ALTER TABLE \`images\` DROP COLUMN \`height\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 지운 크기 값은 되살릴 수 없어 0으로 채운다.
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`height\` int NOT NULL COMMENT '세로 크기' DEFAULT 0 AFTER \`image_url\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`width\` int NOT NULL COMMENT '가로 크기' DEFAULT 0 AFTER \`image_url\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` ALTER \`width\` DROP DEFAULT, ALTER \`height\` DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` CHANGE \`image_id\` \`default_image_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '기본 이미지 ID'`,
    );
    await queryRunner.query(`RENAME TABLE \`images\` TO \`default_image\``);
  }
}
