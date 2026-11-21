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

  @ApiProperty({
    description:
      '방장이 나가서 방장이 된 참가자 ID (입장 순서상 다음 사람). 방장이 아닌 사람이 나갔거나 방이 지워졌으면 null',
    type: Number,
    nullable: true,
    example: null,
  })
  newCreatorId: number | null;

  @ApiProperty({
    description: '마지막 남은 사람(방장)이 나가 방이 지워졌는지',
    example: false,
  })
  sessionDeleted: boolean;
}
