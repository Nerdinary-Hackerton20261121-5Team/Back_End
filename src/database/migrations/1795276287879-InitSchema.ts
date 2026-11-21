import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1795276287879 implements MigrationInterface {
  name = 'InitSchema1795276287879';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`user_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '유저 ID', \`login_id\` varchar(50) NOT NULL COMMENT '로그인 아이디', \`password_hash\` varchar(255) NOT NULL COMMENT '비밀번호 해시', \`nickname\` varchar(20) NOT NULL COMMENT '닉네임', \`created_at\` datetime(3) NOT NULL COMMENT '가입 일시' DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`uk_users_login_id\` (\`login_id\`), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB COMMENT="유저"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`default_image\` (\`default_image_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '기본 이미지 ID', \`name\` varchar(100) NOT NULL COMMENT '이미지 이름', \`image_url\` varchar(500) NOT NULL COMMENT '이미지 URL', \`width\` int NOT NULL COMMENT '가로 크기', \`height\` int NOT NULL COMMENT '세로 크기', \`created_at\` datetime(3) NOT NULL COMMENT '등록 일시' DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (\`default_image_id\`)) ENGINE=InnoDB COMMENT="기본 이미지"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`session\` (\`session_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '세션 ID', \`session_code\` varchar(16) NOT NULL COMMENT '세션 코드', \`create_request_id\` varchar(64) NOT NULL COMMENT '생성 요청 ID', \`max_participants\` int NULL COMMENT '정원 (Q-006 미정)', \`goal_seconds\` int NOT NULL COMMENT '목표 시간(초)', \`split_count\` int NOT NULL COMMENT '조립 분할 수', \`allow_random\` tinyint NOT NULL COMMENT '랜덤 참가 허용 여부' DEFAULT 0, \`image_source\` varchar(10) NULL COMMENT '이미지 출처: DEFAULT | UPLOAD', \`default_image_id\` bigint NULL COMMENT '기본 이미지 ID', \`upload_image_key\` varchar(300) NULL COMMENT '업로드 이미지 키', \`image_width\` int NULL COMMENT '이미지 가로 크기', \`image_height\` int NULL COMMENT '이미지 세로 크기', \`grid_rows\` int NULL COMMENT '원조각 행 수 (시작 때 확정)', \`grid_cols\` int NULL COMMENT '원조각 열 수 (시작 때 확정)', \`status\` varchar(20) NOT NULL COMMENT '진행 단계: WAITING | FOCUSING | ASSEMBLING | COMPLETED', \`started_at\` datetime(3) NULL COMMENT '집중 시작 일시', \`ends_at\` datetime(3) NULL COMMENT '집중 종료 예정 일시', \`assembly_started_at\` datetime(3) NULL COMMENT '조립 시작 일시', \`completed_at\` datetime(3) NULL COMMENT '팀 통과 일시', \`version\` bigint NOT NULL COMMENT '버전' DEFAULT '0', \`created_at\` datetime(3) NOT NULL COMMENT '생성 일시' DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX \`uk_session_create_request\` (\`create_request_id\`), UNIQUE INDEX \`uk_session_code\` (\`session_code\`), PRIMARY KEY (\`session_id\`)) ENGINE=InnoDB COMMENT="세션"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`participant\` (\`participant_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '참가자 ID', \`session_id\` bigint NOT NULL COMMENT '세션 ID', \`user_id\` bigint NULL COMMENT '유저 ID (비회원이면 NULL)', \`token_hash\` char(64) NOT NULL COMMENT '참가 토큰 해시', \`join_request_id\` varchar(64) NOT NULL COMMENT '입장 요청 ID', \`is_creator\` tinyint NOT NULL COMMENT '개설자 여부' DEFAULT 0, \`last_heartbeat_at\` datetime(3) NULL COMMENT '마지막 연결 확인 일시', \`disconnected_at\` datetime(3) NULL COMMENT '연결 끊김 일시', \`final_restoration\` decimal(5,4) NULL COMMENT '최종 복원도 (0~1)', \`joined_at\` datetime(3) NOT NULL COMMENT '입장 일시', UNIQUE INDEX \`uk_participant_session_user\` (\`session_id\`, \`user_id\`), UNIQUE INDEX \`uk_participant_join_request\` (\`session_id\`, \`join_request_id\`), UNIQUE INDEX \`uk_participant_token\` (\`token_hash\`), PRIMARY KEY (\`participant_id\`)) ENGINE=InnoDB COMMENT="참가자"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`source_piece\` (\`piece_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '조각 ID', \`session_id\` bigint NOT NULL COMMENT '세션 ID', \`participant_id\` bigint NOT NULL COMMENT '소유자 참가자 ID', \`position\` int NOT NULL COMMENT '위치 번호 (왼쪽 위부터 1)', UNIQUE INDEX \`uk_source_piece_owner\` (\`participant_id\`), UNIQUE INDEX \`uk_source_piece_position\` (\`session_id\`, \`position\`), PRIMARY KEY (\`piece_id\`)) ENGINE=InnoDB COMMENT="원조각"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assembly_piece\` (\`assembly_piece_id\` bigint NOT NULL AUTO_INCREMENT COMMENT '조립 조각 ID', \`session_id\` bigint NOT NULL COMMENT '세션 ID', \`source_piece_id\` bigint NOT NULL COMMENT '원조각 ID', \`position\` int NOT NULL COMMENT '정답 위치 번호 (조립판 왼쪽 위부터 1)', \`placed_at\` datetime(3) NULL COMMENT '놓인 일시 (NULL = 대기 영역)', \`auto_placed\` tinyint NOT NULL COMMENT '자동 배치 여부' DEFAULT 0, UNIQUE INDEX \`uk_assembly_piece_position\` (\`session_id\`, \`position\`), PRIMARY KEY (\`assembly_piece_id\`)) ENGINE=InnoDB COMMENT="조립 조각"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD CONSTRAINT \`fk_session_default_image\` FOREIGN KEY (\`default_image_id\`) REFERENCES \`default_image\`(\`default_image_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` ADD CONSTRAINT \`fk_participant_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` ADD CONSTRAINT \`fk_participant_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`user_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD CONSTRAINT \`fk_source_piece_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` ADD CONSTRAINT \`fk_source_piece_participant\` FOREIGN KEY (\`participant_id\`) REFERENCES \`participant\`(\`participant_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD CONSTRAINT \`fk_assembly_piece_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`session_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` ADD CONSTRAINT \`fk_assembly_piece_source\` FOREIGN KEY (\`source_piece_id\`) REFERENCES \`source_piece\`(\`piece_id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` DROP FOREIGN KEY \`fk_assembly_piece_source\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assembly_piece\` DROP FOREIGN KEY \`fk_assembly_piece_session\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP FOREIGN KEY \`fk_source_piece_participant\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`source_piece\` DROP FOREIGN KEY \`fk_source_piece_session\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` DROP FOREIGN KEY \`fk_participant_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`participant\` DROP FOREIGN KEY \`fk_participant_session\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP FOREIGN KEY \`fk_session_default_image\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_assembly_piece_position\` ON \`assembly_piece\``,
    );
    await queryRunner.query(`DROP TABLE \`assembly_piece\``);
    await queryRunner.query(
      `DROP INDEX \`uk_source_piece_position\` ON \`source_piece\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_source_piece_owner\` ON \`source_piece\``,
    );
    await queryRunner.query(`DROP TABLE \`source_piece\``);
    await queryRunner.query(
      `DROP INDEX \`uk_participant_token\` ON \`participant\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_participant_join_request\` ON \`participant\``,
    );
    await queryRunner.query(
      `DROP INDEX \`uk_participant_session_user\` ON \`participant\``,
    );
    await queryRunner.query(`DROP TABLE \`participant\``);
    await queryRunner.query(`DROP INDEX \`uk_session_code\` ON \`session\``);
    await queryRunner.query(
      `DROP INDEX \`uk_session_create_request\` ON \`session\``,
    );
    await queryRunner.query(`DROP TABLE \`session\``);
    await queryRunner.query(`DROP TABLE \`default_image\``);
    await queryRunner.query(`DROP INDEX \`uk_users_login_id\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
