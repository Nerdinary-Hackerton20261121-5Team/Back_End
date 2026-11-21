import { ApiProperty } from '@nestjs/swagger';

/** 대기실 나가기 응답 */
export class LeaveSessionResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({ example: 2 })
  participantId: number;

  @ApiProperty({
    description: '나가기 완료. 이 참가자 토큰은 이제 무효',
    example: true,
  })
  left: true;
}
