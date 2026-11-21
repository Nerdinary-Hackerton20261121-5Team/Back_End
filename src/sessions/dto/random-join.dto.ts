import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RandomJoinDto {
  @ApiProperty({
    description:
      '매칭 요청 ID. 같은 값으로 다시 보내면 새로 배정하지 않고 이미 배정된 방의 같은 참가자를 돌려준다',
    example: 'a7e4c2d1-5b3f-4e8a-9c6d-0f1e2d3c4b5a',
  })
  @IsString()
  @Length(1, 64)
  clientRequestId: string;
}
