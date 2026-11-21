import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ImageDto } from './dto/image.dto.js';
import { Image } from './entities/image.entity.js';
import { ImageUrlService } from './image-url.service.js';

/** 보여주기용 주소의 긴 변 상한. 원본 해상도 그대로 변환하면 2400만 화소 사진에 수 초가 걸린다 */
export const DISPLAY_MAX = 1920;
/** 미리보기 주소의 긴 변 상한 */
export const THUMBNAIL_MAX = 400;

/**
 * 이미지 행(images)과 응답 주소. 업로드 1건 = images 1행(source UPLOAD, image_key)이고,
 * 세션은 image_id로 기본 이미지·업로드 이미지를 똑같이 가리킨다.
 * 주소는 저장하지 않고 응답할 때 key로 만든다 (서명 키·리사이즈 규칙이 바뀌어도 그대로 쓸 수 있다).
 */
@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image) private readonly images: Repository<Image>,
    private readonly urls: ImageUrlService,
  ) {}

  /** 저장소에 올린 파일을 업로드 이미지로 등록한다 */
  async registerUpload(key: string): Promise<ImageDto> {
    const image = await this.images.save(
      this.images.create({ source: 'UPLOAD', imageKey: key }),
    );
    return this.toDto(image);
  }

  toDto(image: Image): ImageDto {
    // 기본 이미지는 등록된 주소를 그대로 쓴다
    if (image.source === 'DEFAULT' || !image.imageKey) {
      const url = image.imageUrl ?? '';
      return {
        imageId: image.id,
        source: image.source,
        url,
        thumbnailUrl: url,
      };
    }
    return {
      imageId: image.id,
      source: image.source,
      url: this.urls.url(image.imageKey, {
        width: DISPLAY_MAX,
        height: DISPLAY_MAX,
      }),
      thumbnailUrl: this.urls.url(image.imageKey, {
        width: THUMBNAIL_MAX,
        height: THUMBNAIL_MAX,
      }),
    };
  }
}
