import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { uploadToDisk, type StoredUpload } from '@nestjs/storage';
import { BusinessException } from '../common/exception/business.exception.js';
import { CommonErrors } from '../common/exception/error-code.js';
import { ImageUrlService } from './image-url.service.js';
import { IMAGES_DISK } from './storage.config.js';

/** 받는 이미지 형식. 파일 앞부분 바이트로 판별하므로 확장자·Content-Type을 속여도 걸러진다. */
export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MiB
/** 보여주기용 주소의 긴 변 상한. 원본 해상도 그대로 변환하면 2400만 화소 사진에 수 초가 걸린다 */
export const DISPLAY_MAX = 1920;

export interface UploadedImage {
  /** 저장소 key. DB에는 이 값을 저장하고, 주소는 응답할 때 ImageUrlService로 만든다. */
  key: string;
  contentType: string;
  size: number;
  /** 보여주기용 WebP 주소. 긴 변 최대 1920px(작은 원본은 그대로) */
  url: string;
  /** 정사각 썸네일 WebP 주소. 최대 400px, 원본이 작으면 원본 짧은 변 크기 */
  thumbnailUrl: string;
}

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imageUrls: ImageUrlService) {}

  @Post()
  @ApiOperation({ summary: '이미지 업로드 (multipart, 필드명 file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // 메모리·임시 폴더를 거치지 않고 저장소로 바로 스트리밍한다
      storage: uploadToDisk({
        disk: IMAGES_DISK,
        contentTypes: IMAGE_TYPES,
        // key가 매번 새 UUID라 내용이 바뀌지 않으므로 오래 캐시해도 된다
        cacheControl: 'public, max-age=31536000, immutable',
      }),
      limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
    }),
  )
  upload(@UploadedFile() file: StoredUpload | undefined): UploadedImage {
    if (!file) {
      throw new BusinessException(
        CommonErrors.INVALID_INPUT,
        '이미지를 file 필드로 첨부해 주세요.',
      );
    }
    return {
      key: file.key,
      contentType: file.contentType,
      size: file.size,
      url: this.imageUrls.url(file.key, {
        width: DISPLAY_MAX,
        height: DISPLAY_MAX,
      }),
      thumbnailUrl: this.imageUrls.url(file.key, {
        width: 400,
        height: 400,
        resize: 'fill-down',
      }),
    };
  }
}
