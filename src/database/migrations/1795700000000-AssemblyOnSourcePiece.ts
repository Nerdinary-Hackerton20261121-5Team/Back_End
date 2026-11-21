import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 조립 상태를 조각(source_piece)에 직접 저장하고 조립 조각(assembly_piece)을 없앤다.
 * 조각이 참가자당 2개로 바뀐 뒤(PieceTwoPerParticipant) 시작 API가 assembly_piece를 만들지 않아
 * 조립판이 비어 있었다. 이제 조립판에 놓는 단위는 source_piece 자체다.
 * - source_piece에 placed_at(정답 칸에 놓인 일시)·auto_placed(부재 자동 배치)를 더한다.
 * - assembly_piece를 지운다. 남은 행은 이전 방식으로 시작한 세션의 것뿐이라 옮기지 않는다.
 * down은 빈 assembly_piece 테이블만 되살린다(지운 행은 복구되지 않는다).
 */
export class AssemblyOnSourcePiece1795700000000 implements MigrationInterface {
  name = 'AssemblyOnSourcePiece1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD \`placed_at\` datetime(3) NULL COMMENT '조립판 정답 칸에 놓인 일시 (NULL = 대기 영역)'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD \`auto_placed\` tinyint NOT NULL COMMENT '집중 종료 때 부재로 자동 배치됐는지' DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` DROP FOREIGN KEY \`fk_assembly_piece_source\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` DROP FOREIGN KEY \`fk_assembly_piece_session\``,
    );
    await queryRunner.query(`DROP TABLE \`assembly_piece\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`assembly_piece\` (\`assembly_piece_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '조립 조각 ID', \`session_id\` bigint NOT NULL COMMENT '세션 ID', \`source_piece_id\` bigint NOT NULL COMMENT '원조각 ID', \`position\` int NOT NULL COMMENT '정답 위치 번호 (조립판 왼쪽 위부터 1)', \`placed_at\` datetime(3) NULL COMMENT '놓인 일시 (NULL = 대기 영역)', \`auto_placed\` tinyint NOT NULL COMMENT '자동 배치 여부' DEFAULT 0, UNIQUE INDEX \`uk_assembly_piece_position\` (\`session_id\`, \`position\`), PRIMARY KEY (\`assembly_piece_id\`)) ENGINE=InnoDB COMMENT="조립 조각"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD CONSTRAINT \`fk_assembly_piece_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD CONSTRAINT \`fk_assembly_piece_source\` FOREIGN KEY (\`source_piece_id\`) REFERENCES \`source_piece\`(\`piece_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP COLUMN \`auto_placed\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP COLUMN \`placed_at\``,
    );
  }
}
