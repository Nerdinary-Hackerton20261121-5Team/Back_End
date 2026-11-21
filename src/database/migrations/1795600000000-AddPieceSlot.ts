import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 조각이 세션 이미지의 어느 칸(slot)인지 저장한다.
 * - source_piece.slot_row·slot_col: session.grid_rows × grid_cols 격자의 칸 (1부터)
 * - assembly_piece.split_count: 원조각 분할 수 (2), slot: 원조각 안 몇 번째 조각인지 (1 ~ split_count)
 * 기존 행은 position에서 계산해 채운 뒤 NOT NULL로 바꾼다.
 */
export class AddPieceSlot1795600000000 implements MigrationInterface {
  name = 'AddPieceSlot1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. source_piece: 컬럼 추가 → position으로 채움 → NOT NULL
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD \`slot_row\` int NULL COMMENT 'slot 행 번호 (1 ~ session.grid_rows)', ADD \`slot_col\` int NULL COMMENT 'slot 열 번호 (1 ~ session.grid_cols)'`,
    );
    // 격자 열 수가 아직 없으면(시작 전) 한 행 2명 규칙으로 계산한다.
    await queryRunner.query(
      `UPDATE \`source_piece\` p JOIN \`session\` s ON s.\`session_id\` = p.\`session_id\` SET p.\`slot_row\` = CEIL(p.\`position\` / COALESCE(s.\`grid_cols\`, 2)), p.\`slot_col\` = MOD(p.\`position\` - 1, COALESCE(s.\`grid_cols\`, 2)) + 1`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` MODIFY \`slot_row\` int NOT NULL COMMENT 'slot 행 번호 (1 ~ session.grid_rows)', MODIFY \`slot_col\` int NOT NULL COMMENT 'slot 열 번호 (1 ~ session.grid_cols)'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD UNIQUE INDEX \`uk_source_piece_slot\` (\`session_id\`, \`slot_row\`, \`slot_col\`)`,
    );

    // 2. assembly_piece: 분할 수·원조각 안 slot
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD \`split_count\` int NOT NULL COMMENT '원조각 분할 수' DEFAULT 2 AFTER \`source_piece_id\`, ADD \`slot\` int NULL COMMENT '원조각 안 slot 번호 (1 ~ split_count)' AFTER \`split_count\``,
    );
    // 같은 원조각에서 나온 조각을 정답 위치 순으로 1부터 번호 매긴다.
    await queryRunner.query(
      `UPDATE \`assembly_piece\` a JOIN (SELECT \`assembly_piece_id\`, ROW_NUMBER() OVER (PARTITION BY \`source_piece_id\` ORDER BY \`position\`) AS rn FROM \`assembly_piece\`) r ON r.\`assembly_piece_id\` = a.\`assembly_piece_id\` SET a.\`slot\` = r.rn`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` MODIFY \`slot\` int NOT NULL COMMENT '원조각 안 slot 번호 (1 ~ split_count)'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD UNIQUE INDEX \`uk_assembly_piece_slot\` (\`source_piece_id\`, \`slot\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // MySQL은 FK가 자동으로 만든 인덱스를 uk_assembly_piece_slot으로 대신하며 지운다.
    // 남아 있지 않으면 FK 인덱스를 먼저 되살려야 uk_assembly_piece_slot을 지울 수 있다.
    const fkIndex = (await queryRunner.query(
      `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assembly_piece' AND INDEX_NAME = 'fk_assembly_piece_source' LIMIT 1`,
    )) as unknown[];
    if (fkIndex.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`assembly_piece\` ADD INDEX \`fk_assembly_piece_source\` (\`source_piece_id\`)`,
      );
    }
    await queryRunner.query(
      `DROP INDEX \`uk_assembly_piece_slot\` ON \`assembly_piece\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` DROP COLUMN \`slot\`, DROP COLUMN \`split_count\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_source_piece_slot\` ON \`source_piece\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP COLUMN \`slot_col\`, DROP COLUMN \`slot_row\``,
    );
  }
}
