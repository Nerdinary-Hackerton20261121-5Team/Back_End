import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InMemoryDisk, StorageModule } from '@nestjs/storage';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ParticipantGuard } from '../auth/participant.guard.js';
import { Image } from './entities/image.entity.js';
import { ImageUrlService } from './image-url.service.js';
import { ImagesController, MAX_IMAGE_SIZE } from './images.controller.js';
import { ImagesService } from './images.service.js';
import { IMAGES_DISK } from './storage.config.js';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

describe('ImagesController (POST /images)', () => {
  let app: INestApplication;
  let disk: InMemoryDisk;
  const images = {
    create: vi.fn((data: Partial<Image>) => data),
    save: vi.fn(async (data: Partial<Image>) => ({ ...data, id: 7 })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
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
      providers: [
        ImageUrlService,
        ImagesService,
        { provide: getRepositoryToken(Image), useValue: images },
      ],
    })
      // 토큰 확인은 auth 쪽 테스트가 맡는다. 여기서는 통과시킨다
      .overrideGuard(ParticipantGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('이미지를 저장소에 올리고 images에 UPLOAD로 등록, imageId·주소를 돌려준다 (key는 숨김)', async () => {
    const res = await request(app.getHttpServer())
      .post('/images')
      .attach('file', PNG, 'a.png')
      .expect(201);

    expect(Object.keys(res.body).sort()).toEqual([
      'imageId',
      'source',
      'thumbnailUrl',
      'url',
    ]);
    expect(res.body).toMatchObject({ imageId: 7, source: 'UPLOAD' });

    const saved = images.save.mock.calls[0][0];
    expect(saved.source).toBe('UPLOAD');
    expect(saved.imageKey).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(await disk.exists(saved.imageKey!)).toBe(true);

    expect(res.body.url).toMatch(
      /^https:\/\/x\/img\/insecure\/rs:fit:1920:1920\/[\w-]+\.webp$/,
    );
    // 미리보기도 자르지 않는다 (퍼즐은 이미지 전체를 쓴다)
    expect(res.body.thumbnailUrl).toMatch(
      /^https:\/\/x\/img\/insecure\/rs:fit:400:400\/[\w-]+\.webp$/,
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
    expect(images.save).not.toHaveBeenCalled();
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
