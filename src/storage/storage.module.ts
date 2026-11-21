import { Module } from '@nestjs/common';
import { StorageModule as NestStorageModule } from '@nestjs/storage';
import { ImageUrlService } from './image-url.service.js';
import { ImagesController } from './images.controller.js';
import { createStorageOptions } from './storage.config.js';

/**
 * 파일 저장소(S3 호환) + 이미지 주소(imgproxy).
 * 다른 모듈은 이 모듈을 import하고 다음을 주입해 쓴다.
 * - `@InjectDisk(IMAGES_DISK) disk: StorageDisk` : put/get/delete/signedUrl
 * - `ImageUrlService` : 저장된 key → 리사이즈된 이미지 주소
 */
@Module({
  imports: [
    NestStorageModule.forRootAsync({
      useFactory: () => createStorageOptions(),
    }),
  ],
  controllers: [ImagesController],
  providers: [ImageUrlService],
  exports: [ImageUrlService],
})
export class StorageModule {}
