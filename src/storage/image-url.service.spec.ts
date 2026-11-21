import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ImageUrlService } from './image-url.service.js';

function create(env: Record<string, string>) {
  return new ImageUrlService({
    get: (name: string) => env[name],
  } as unknown as ConfigService);
}

const encoded = (s: string) => Buffer.from(s).toString('base64url');

describe('ImageUrlService', () => {
  it('키가 없으면 서명 없는 insecure 주소를 만든다', () => {
    const service = create({ IMGPROXY_URL: 'http://img/', S3_BUCKET: 'b' });

    expect(service.url('a/b.png')).toBe(
      `http://img/insecure/${encoded('s3://b/a/b.png')}.webp`,
    );
  });

  it('크기·자르기·형식 옵션을 경로에 넣는다', () => {
    const service = create({ S3_BUCKET: 'b' });

    expect(
      service.url('k.jpg', { width: 300, resize: 'fill', format: 'webp' }),
    ).toBe(`/img/insecure/rs:fill:300:0/${encoded('s3://b/k.jpg')}.webp`);
  });

  it('키·솔트가 있으면 HMAC-SHA256(salt + path) base64url로 서명한다', () => {
    const key = 'aa'.repeat(32);
    const salt = 'bb'.repeat(32);
    const service = create({ IMGPROXY_KEY: key, IMGPROXY_SALT: salt });

    const url = service.url('k.png', { width: 100, height: 100 });
    const path = `/rs:fit:100:100/${encoded('s3://images/k.png')}.webp`;
    const signature = createHmac('sha256', Buffer.from(key, 'hex'))
      .update(Buffer.from(salt, 'hex'))
      .update(path)
      .digest('base64url');

    expect(url).toBe(`/img/${signature}${path}`);
  });

  it("format 'original'이면 확장자를 붙이지 않는다", () => {
    const service = create({ S3_BUCKET: 'b' });

    expect(service.url('k.gif', { format: 'original' })).toBe(
      `/img/insecure/${encoded('s3://b/k.gif')}`,
    );
  });
});
