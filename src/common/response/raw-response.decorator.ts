import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'common:raw-response';

/**
 * 공통 응답 형식으로 감싸지 않고 반환값을 그대로 내보낸다.
 * 응답 모양이 외부와 약속된 경로(예: 배포 probe가 쓰는 GET /api/health)에만 쓴다.
 * 컨트롤러 클래스 또는 핸들러에 붙인다.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
