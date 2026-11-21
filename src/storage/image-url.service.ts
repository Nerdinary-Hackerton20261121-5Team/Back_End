import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ImageVariant {
  /** 0이면 비율에 맞춰 자동 */
  width?: number;
  height?: number;
  /**
   * fit: 비율 유지하며 안에 맞춤
   * fill: 잘라서 꽉 채움(원본이 작으면 확대하지 않아 요청 비율이 안 나올 수 있다)
   * fill-down: fill과 같지만 원본이 작으면 요청 비율대로 잘라 더 작게 낸다(썸네일 정사각형 보장)
   */
  resize?: 'fit' | 'fill' | 'fill-down';
  /**
   * 기본 webp. 주소마다 결과 형식이 하나로 정해져야 Cloudflare 같은 캐시가 안전하게 저장한다
   * (브라우저 Accept에 따라 형식을 바꾸면 같은 주소에 다른 형식이 섞인다). 'original'은 원본 형식 그대로.
   */
  format?: 'webp' | 'avif' | 'jpg' | 'png' | 'original';
}

/**
 * 저장소에 있는 이미지 key를 imgproxy 주소로 바꾼다.
 * imgproxy가 S3에서 원본을 읽어 크기·형식을 바꿔 내보내므로 API 서버는 이미지를 만지지 않는다.
 * imgproxy는 결과를 저장하지 않는다. 응답의 Cache-Control(1년)과 `.webp` 확장자 덕분에
 * 브라우저와 Cloudflare가 캐시하고, 같은 주소는 imgproxy까지 다시 오지 않는다.
 *
 * IMGPROXY_KEY·IMGPROXY_SALT(hex)가 있으면 HMAC-SHA256으로 서명한 주소를,
 * 없으면 서명 없는 `/insecure/...` 주소를 만든다(로컬 개발용).
 */
@Injectable()
export class ImageUrlService {
  private readonly baseUrl: string;
  private readonly bucket: string;
  private readonly key?: Buffer;
  private readonly salt?: Buffer;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('IMGPROXY_URL') || '/img').replace(
      /\/+$/,
      '',
    );
    this.bucket = config.get<string>('S3_BUCKET') || 'images';
    const key = config.get<string>('IMGPROXY_KEY');
    const salt = config.get<string>('IMGPROXY_SALT');
    if (key && salt) {
      this.key = Buffer.from(key, 'hex');
      this.salt = Buffer.from(salt, 'hex');
    }
  }

  url(objectKey: string, variant: ImageVariant = {}): string {
    const options: string[] = [];
    if (variant.width || variant.height) {
      options.push(
        `rs:${variant.resize ?? 'fit'}:${variant.width ?? 0}:${variant.height ?? 0}`,
      );
    }
    // 원본 주소는 base64url로 넣는다. key에 /·?·공백이 있어도 깨지지 않는다.
    const source = Buffer.from(`s3://${this.bucket}/${objectKey}`).toString(
      'base64url',
    );
    const format = variant.format ?? 'webp';
    const ext = format === 'original' ? '' : `.${format}`;
    const path = `/${[...options, source].join('/')}${ext}`;
    return `${this.baseUrl}/${this.sign(path)}${path}`;
  }

  private sign(path: string): string {
    if (!this.key || !this.salt) return 'insecure';
    return createHmac('sha256', this.key)
      .update(this.salt)
      .update(path)
      .digest('base64url');
  }
}
