import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database.config.js';

// TypeORM CLI 전용 DataSource. `npm run migration:*` 스크립트가 빌드된 dist/database/data-source.js를 사용한다.
export default new DataSource(createDatabaseOptions());
