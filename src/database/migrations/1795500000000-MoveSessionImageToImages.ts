import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * session의 이미지 컬럼을 images로 옮기고 session은 image_id FK 하나만 갖는다.
 * - image_source → images.source, upload_image_key → images.image_key (업로드 1건 = images 1행)
 * - default_image_id → session.image_id (fk_session_default_image → fk_session_image)
 * - image_width·image_height는 쓰는 곳이 없어 옮기지 않고 지운다.
 */
export class MoveSessionImageToImages1795500000000 implements MigrationInterface {
  name = 'MoveSessionImageToImages1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. images에 출처·저장소 key를 더한다. 기존 행은 모두 기본 이미지다.
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`source\` varchar(10) NOT NULL COMMENT '이미지 출처: DEFAULT | UPLOAD' DEFAULT 'DEFAULT' AFTER \`image_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` ALTER \`source\` DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD \`image_key\` varchar(300) NULL COMMENT '저장소 key (업로드 이미지)' AFTER \`image_url\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` ADD UNIQUE INDEX \`uk_images_key\` (\`image_key\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` MODIFY \`name\` varchar(100) NULL COMMENT '이미지 이름 (기본 이미지)'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` MODIFY \`image_url\` varchar(500) NULL COMMENT '이미지 URL (기본 이미지)'`,
    );
    await queryRunner.query(`ALTER TABLE \`images\` COMMENT = '이미지'`);

    // 2. session.image_id를 만들고 기존 값을 옮긴다.
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD \`image_id\` bigint NULL COMMENT '퍼즐 이미지 ID' AFTER \`allow_random\``,
    );
    await queryRunner.query(
      `UPDATE \`session\` SET \`image_id\` = \`default_image_id\` WHERE \`image_source\` = 'DEFAULT' AND \`default_image_id\` IS NOT NULL`,
    );
    // 업로드 key는 UUID라 key로 다시 조인하면 세션과 1:1로 맞는다.
    await queryRunner.query(
      `INSERT INTO \`images\` (\`source\`, \`image_key\`, \`created_at\`) SELECT 'UPLOAD', \`upload_image_key\`, \`created_at\` FROM \`session\` WHERE \`image_source\` = 'UPLOAD' AND \`upload_image_key\` IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE \`session\` s JOIN \`images\` i ON i.\`image_key\` = s.\`upload_image_key\` SET s.\`image_id\` = i.\`image_id\` WHERE s.\`image_source\` = 'UPLOAD'`,
    );

    // 3. 옛 FK·컬럼을 지우고 새 FK를 건다.
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP FOREIGN KEY \`fk_session_default_image\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP COLUMN \`image_source\`, DROP COLUMN \`default_image_id\`, DROP COLUMN \`upload_image_key\`, DROP COLUMN \`image_width\`, DROP COLUMN \`image_height\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD CONSTRAINT \`fk_session_image\` FOREIGN KEY (\`image_id\`) REFERENCES \`images\`(\`image_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP FOREIGN KEY \`fk_session_image\``,
    );
    // 지운 이미지 크기는 되살릴 수 없어 NULL로 둔다.
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD \`image_source\` varchar(10) NULL COMMENT '이미지 출처: DEFAULT | UPLOAD' AFTER \`allow_random\`, ADD \`default_image_id\` bigint NULL COMMENT '기본 이미지 ID' AFTER \`image_source\`, ADD \`upload_image_key\` varchar(300) NULL COMMENT '업로드 이미지 키' AFTER \`default_image_id\`, ADD \`image_width\` int NULL COMMENT '이미지 가로 크기' AFTER \`upload_image_key\`, ADD \`image_height\` int NULL COMMENT '이미지 세로 크기' AFTER \`image_width\``,
    );
    await queryRunner.query(
      `UPDATE \`session\` s JOIN \`images\` i ON i.\`image_id\` = s.\`image_id\` SET s.\`image_source\` = i.\`source\`, s.\`default_image_id\` = IF(i.\`source\` = 'DEFAULT', i.\`image_id\`, NULL), s.\`upload_image_key\` = IF(i.\`source\` = 'UPLOAD', i.\`image_key\`, NULL)`,
    );
    await queryRunner.query(`ALTER TABLE \`session\` DROP COLUMN \`image_id\``);
    // 업로드 행은 session.upload_image_key로 돌아갔으므로 images에서 지운다.
    await queryRunner.query(
      `DELETE FROM \`images\` WHERE \`source\` = 'UPLOAD'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD CONSTRAINT \`fk_session_default_image\` FOREIGN KEY (\`default_image_id\`) REFERENCES \`images\`(\`image_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE \`images\` COMMENT = '기본 이미지'`);
    await queryRunner.query(
      `ALTER TABLE \`images\` MODIFY \`image_url\` varchar(500) NOT NULL COMMENT '이미지 URL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`images\` MODIFY \`name\` varchar(100) NOT NULL COMMENT '이미지 이름'`,
    );
    await queryRunner.query(`DROP INDEX \`uk_images_key\` ON \`images\``);
    await queryRunner.query(`ALTER TABLE \`images\` DROP COLUMN \`image_key\``);
    await queryRunner.query(`ALTER TABLE \`images\` DROP COLUMN \`source\``);
  }
}
