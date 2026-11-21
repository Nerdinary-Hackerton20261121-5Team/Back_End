import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BusinessException } from '../common/exception/business.exception.js';
import { ThrottleErrors } from './throttle.errors.js';

/**
 * 사용자 IP별 요청 횟수 제한 (#67).
 * 요청은 Cloudflare → 터널 → nginx(gateway) → BE로 들어와 접속 IP가 항상 nginx이므로,
 * Cloudflare가 넣는 실제 사용자 IP(CF-Connecting-IP)로 센다. 없으면(로컬 등) 접속 IP.
 * 초과하면 공통 응답 형식의 429 TOO_MANY_REQUESTS.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, unknown>;
    const cfIp = headers['cf-connecting-ip'];
    const ip =
      typeof cfIp === 'string' && cfIp.trim() ? cfIp.trim() : String(req.ip);
    return Promise.resolve(ip);
  }

  protected override throwThrottlingException(): Promise<void> {
    throw new BusinessException(ThrottleErrors.TOO_MANY_REQUESTS);
  }
}
