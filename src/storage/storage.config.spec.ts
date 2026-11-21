import { InMemoryDisk, S3Disk } from '@nestjs/storage';
import { createStorageOptions, IMAGES_DISK } from './storage.config.js';

const full = {
  S3_ENDPOINT: 'http://s3:9000',
  S3_BUCKET: 'images',
  S3_ACCESS_KEY_ID: 'id',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('createStorageOptions', () => {
  it('버킷·키가 모두 있으면 S3 디스크를 쓴다', () => {
    const options = createStorageOptions(full);

    expect(options.default).toBe(IMAGES_DISK);
    expect(options.disks[IMAGES_DISK]).toBeInstanceOf(S3Disk);
  });

  it.each(['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'])(
    '%s가 없으면 앱이 뜨도록 메모리 디스크로 대신한다',
    (missing) => {
      const options = createStorageOptions({ ...full, [missing]: '' });

      expect(options.disks[IMAGES_DISK]).toBeInstanceOf(InMemoryDisk);
    },
  );
});
