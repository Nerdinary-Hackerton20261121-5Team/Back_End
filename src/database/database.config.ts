import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * MySQL 접속 설정. Nest 앱(TypeOrmModule)과 TypeORM CLI(data-source.ts)가 같은 값을 쓴다.
 * 값은 모두 환경변수에서 읽는다. 비밀값을 코드에 넣지 않는다.
 */
export function createDatabaseOptions(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    charset: 'utf8mb4',
    timezone: 'Z', // 시각은 UTC로 저장한다
    // 스키마는 마이그레이션으로만 바꾼다. synchronize는 컬럼·데이터를 지울 수 있어 끈다.
    synchronize: false,
    logging: env.DB_LOGGING === 'true',
    // 컴파일된 dist 기준 경로 (CLI용). Nest 앱은 autoLoadEntities로 등록한다.
    entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    migrationsTableName: 'migrations',
  };
}
