import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PRESENCE_STATES, type PresenceState } from '../focus-time.js';

export class HeartbeatRequestDto {
  @ApiPropertyOptional({
    enum: PRESENCE_STATES,
    default: 'FOCUSING',
    description:
      '지금 상태. FOCUSING = 얼굴 인식됨(시간 누적), PAUSED = 일시정지 버튼, AWAY = 얼굴 인식 안 됨. ' +
      '상태가 바뀌면 주기를 기다리지 말고 바로 한 번 보낸다. 생략하면 FOCUSING',
  })
  @IsOptional()
  @IsIn(PRESENCE_STATES)
  state?: PresenceState;
}
