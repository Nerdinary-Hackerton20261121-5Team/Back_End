import { ApiProperty } from '@nestjs/swagger';

/** 방장 조기 종료 응답 (#78) */
export class EndFocusResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({
    description:
      '종료 뒤 단계. 공부가 끝났으므로 ASSEMBLING (이미 팀 통과면 COMPLETED)',
    example: 'ASSEMBLING',
  })
  status: string;

  @ApiProperty({
    description: '공부가 끝난 시각 (조기 종료한 시각)',
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:20:00.000Z',
  })
  endsAt: Date;

  @ApiProperty({
    description:
      '이미 끝난 세션이라 처음 끝난 시각을 그대로 돌려줬는지 (재전송 안전)',
    example: false,
  })
  alreadyEnded: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-22T03:20:00.000Z',
  })
  serverNow: Date;
}
