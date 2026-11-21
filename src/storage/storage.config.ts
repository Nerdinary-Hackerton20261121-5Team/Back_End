import { Logger } from '@nestjs/common';
import {
  InMemoryDisk,
  S3Disk,
  type StorageModuleOptions,
} from '@nestjs/storage';

/** 이미지 원본을 두는 디스크 이름. `@InjectDisk(IMAGES_DISK)`로 주입한다. */
export const IMAGES_DISK = 'images';

/**
 * S3 호환 저장소 설정. 값은 모두 환경변수에서 읽는다.
 * 운영·dev 서버는 클러스터의 RustFS(http://s3:9000, cluster-config apps/s3)를 쓰고,
 * 버킷 이름·주소는 be-env/be-dev-env, 키는 운영자가 만든 Secret storage-auth가 주입한다.
 *
 * 버킷이나 키가 없으면(로컬, 또는 Secret이 아직 없는 서버) 메모리 디스크로 대신한다.
 * 저장소 설정이 빠져도 앱과 /api/health는 뜨게 하려는 것으로, 재시작하면 파일이 사라지니 경고를 남긴다.
 */
export function createStorageOptions(
  env: NodeJS.ProcessEnv = process.env,
): StorageModuleOptions {
  const bucket = env.S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    new Logger('Storage').warn(
      'S3_BUCKET·S3_ACCESS_KEY_ID·S3_SECRET_ACCESS_KEY 중 빠진 값이 있어 메모리 디스크를 씁니다. 업로드한 파일은 재시작하면 사라집니다.',
    );
    return {
      default: IMAGES_DISK,
      disks: { [IMAGES_DISK]: new InMemoryDisk() },
    };
  }

  return {
    default: IMAGES_DISK,
    disks: {
      [IMAGES_DISK]: new S3Disk({
        bucket,
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION || 'us-east-1',
        // RustFS·MinIO 같은 자체 호스팅 저장소는 path-style 주소가 필요하다
        forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
        credentials: { accessKeyId, secretAccessKey },
      }),
    },
  };
}
