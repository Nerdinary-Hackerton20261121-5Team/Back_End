import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InMemoryDisk, StorageModule } from '@nestjs/storage';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ImageUrlService } from './image-url.service.js';
import { ImagesController, MAX_IMAGE_SIZE } from './images.controller.js';
import { IMAGES_DISK } from './storage.config.js';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

describe('ImagesController (POST /images)', () => {
  let app: INestApplication;
  let disk: InMemoryDisk;

  beforeEach(async () => {
    disk = new InMemoryDisk();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ IMGPROXY_URL: 'https://x/img', S3_BUCKET: 'b' })],
        }),
        StorageModule.forRoot({
          default: IMAGES_DISK,
          disks: { [IMAGES_DISK]: disk },
        }),
      ],
      controllers: [ImagesController],
      providers: [ImageUrlService],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('이미지를 저장하고 key·주소를 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .post('/images')
      .attach('file', PNG, 'a.png')
      .expect(201);

    expect(res.body.key).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(res.body.contentType).toBe('image/png');
    expect(await disk.exists(res.body.key)).toBe(true);
    expect(res.body.url).toMatch(
      /^https:\/\/x\/img\/insecure\/rs:fit:1920:1920\/[\w-]+\.webp$/,
    );
    expect(res.body.thumbnailUrl).toMatch(
      /^https:\/\/x\/img\/insecure\/rs:fill-down:400:400\//,
    );
  });

  it('이미지가 아니면 415, 아무것도 저장하지 않는다', async () => {
    await request(app.getHttpServer())
      .post('/images')
      .attach('file', Buffer.from('<svg/>'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(415);

    expect((await disk.list()).entries).toHaveLength(0);
  });

  it('크기 제한을 넘으면 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_SIZE)]);
    await request(app.getHttpServer())
      .post('/images')
      .attach('file', big, 'big.png')
      .expect(413);
  });

  it('파일이 없으면 400', async () => {
    await request(app.getHttpServer()).post('/images').expect(400);
  });
});
