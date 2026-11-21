import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 조각을 참가자당 2개 가질 수 있게 하고, 공부 중 화면 배치 칸을 저장한다.
 * - uk_source_piece_owner(참가자당 1개)를 없애고 FK용 일반 인덱스로 바꾼다.
 * - position은 정답 칸으로 그대로 쓴다 (코멘트만 바꾼다).
 * - display_slot: 공부 중 화면에 놓이는 칸. 기존 행은 같은 세션의 다음 칸으로 한 칸씩 밀어 채운다.
 *   시작 API가 아직 값을 넣지 않으므로 NULL(미배정)을 허용한다.
 * assembly_piece는 지우지 않고 그대로 둔다.
 */
export class PieceTwoPerParticipant1795600000000 implements MigrationInterface {
  name = 'PieceTwoPerParticipant1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 참가자당 1개 제약을 푼다. FK가 쓸 인덱스를 먼저 만들어야 유니크를 지울 수 있다.
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD INDEX \`idx_source_piece_participant\` (\`participant_id\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_source_piece_owner\` ON \`source_piece\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` MODIFY \`position\` int NOT NULL COMMENT '정답 slot (왼쪽 위부터 1)'`,
    );

    // 2. display_slot
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD \`display_slot\` int NULL COMMENT '공부 중 화면 배치 slot (정답 slot과 다름, NULL = 미배정)' AFTER \`position\``,
    );
    await queryRunner.query(
      `UPDATE \`source_piece\` p JOIN (SELECT \`piece_id\`, COALESCE(LEAD(\`position\`) OVER w, FIRST_VALUE(\`position\`) OVER w) AS next_slot FROM \`source_piece\` WINDOW w AS (PARTITION BY \`session_id\` ORDER BY \`position\`)) r ON r.\`piece_id\` = p.\`piece_id\` SET p.\`display_slot\` = r.next_slot`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD UNIQUE INDEX \`uk_source_piece_display_slot\` (\`session_id\`, \`display_slot\`)`,
    );
    await queryRunner.query(`ALTER TABLE \`source_piece\` COMMENT = '조각'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`source_piece\` COMMENT = '원조각'`);
    await queryRunner.query(
      `DROP INDEX \`uk_source_piece_display_slot\` ON \`source_piece\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP COLUMN \`display_slot\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` MODIFY \`position\` int NOT NULL COMMENT '위치 번호 (왼쪽 위부터 1)'`,
    );
    // 참가자가 조각을 2개 가진 세션이 있으면 여기서 실패한다. 데이터를 지우지 않으려고 일부러 막는다.
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD UNIQUE INDEX \`uk_source_piece_owner\` (\`participant_id\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`idx_source_piece_participant\` ON \`source_piece\``,
    );
  }
}
