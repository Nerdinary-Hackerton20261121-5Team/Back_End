import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 얼굴 기준 집중 시간 누적: participant에 focused_ms(누적 ms)·presence(마지막 heartbeat 상태)를 더한다.
 * 컬럼이 이미 있으면 건너뛴다.
 */
export class ParticipantFocusTime1796000000000 implements MigrationInterface {
  name = 'ParticipantFocusTime1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('participant', 'focused_ms'))) {
      await queryRunner.query(
        `ALTER TABLE \`participant\` ADD \`focused_ms\` int UNSIGNED NOT NULL COMMENT '누적 집중 시간(ms). 마지막 연결 확인 시각까지 얼굴이 인식된 시간의 합' DEFAULT 0`,
      );
    }
    if (!(await queryRunner.hasColumn('participant', 'presence'))) {
      await queryRunner.query(
        `ALTER TABLE \`participant\` ADD \`presence\` varchar(10) NOT NULL COMMENT '마지막 heartbeat 상태: FOCUSING | PAUSED | AWAY' DEFAULT 'FOCUSING'`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE \`participant\` MODIFY \`disconnected_at\` datetime(3) NULL COMMENT '조립 시작 때 끊겨 있던 사람의 마지막 연결 확인 일시'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`participant\` MODIFY \`disconnected_at\` datetime(3) NULL COMMENT '연결 끊김 일시'`,
    );
    if (await queryRunner.hasColumn('participant', 'presence')) {
      await queryRunner.query(
        `ALTER TABLE \`participant\` DROP COLUMN \`presence\``,
      );
    }
    if (await queryRunner.hasColumn('participant', 'focused_ms')) {
      await queryRunner.query(
        `ALTER TABLE \`participant\` DROP COLUMN \`focused_ms\``,
      );
    }
  }
}
