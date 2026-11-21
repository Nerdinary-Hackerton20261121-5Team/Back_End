import {
  Controller,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { uploadToDisk, type StoredUpload } from '@nestjs/storage';
import { BusinessException } from '../common/exception/business.exception.js';
import { CommonErrors } from '../common/exception/error-code.js';
import { ParticipantAuth } from '../auth/participant-auth.decorator.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/swagger/api-response.decorators.js';
import { ImageDto } from './dto/image.dto.js';
import { ImagesService } from './images.service.js';
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

@ApiTags('images')
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @ParticipantAuth()
  @ApiOperation({
    summary: '이미지 업로드 (multipart, 필드명 file)',
    description:
      '방에 들어온 참가자만 올릴 수 있다. 올린 사진을 images에 등록하고 imageId와 주소를 돌려준다. ' +
      '방 이미지로 쓰려면 개설자가 PATCH /sessions/:sessionId/image 에 imageId를 보낸다. ' +
      'jpeg·png·webp·gif·avif·heic, 최대 10MB. 형식은 파일 내용으로 판별한다(아니면 415, 크면 413).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiSuccessResponse(ImageDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(CommonErrors.INVALID_INPUT)
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
  upload(@UploadedFile() file: StoredUpload | undefined): Promise<ImageDto> {
    if (!file) {
      throw new BusinessException(
        CommonErrors.INVALID_INPUT,
        '이미지를 file 필드로 첨부해 주세요.',
      );
    }
    return this.images.registerUpload(file.key);
  }
}
