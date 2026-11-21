import { ApiProperty } from '@nestjs/swagger';
import { IMAGE_SOURCES, type ImageSource } from '../entities/image.entity.js';

/** 이미지 응답. 저장소 key는 내부 값이라 내보내지 않고, 주소는 응답할 때마다 만든다. */
export class ImageDto {
  @ApiProperty({
    description:
      '이미지 ID. 세션 이미지 지정(PATCH /sessions/:id/image)에 쓴다',
    example: 12,
  })
  imageId: number;

  @ApiProperty({
    enum: IMAGE_SOURCES,
    description: 'DEFAULT = 기본 이미지, UPLOAD = 업로드한 사진',
    example: 'UPLOAD',
  })
  source: ImageSource;

  @ApiProperty({
    description: '보여주기용 주소. 비율을 유지하며 긴 변 최대 1920px (WebP)',
    example:
      'https://cmc-11th-dev.bemelon.me/img/<서명>/rs:fit:1920:1920/<원본>.webp',
  })
  url: string;

  @ApiProperty({
    description:
      '미리보기용 작은 주소. 자르지 않고 비율 유지, 긴 변 최대 400px (WebP)',
    example:
      'https://cmc-11th-dev.bemelon.me/img/<서명>/rs:fit:400:400/<원본>.webp',
  })
  thumbnailUrl: string;
}
