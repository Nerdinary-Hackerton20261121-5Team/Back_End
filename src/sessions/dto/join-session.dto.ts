import { OptionalNicknameDto } from './nickname.dto.js';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class JoinSessionDto extends OptionalNicknameDto {
  @ApiProperty({
    description: '세션 코드 (대소문자 구분 없음)',
    example: 'K7PX2Q',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(1, 16)
  sessionCode: string;

  @ApiProperty({
    description:
      '입장 요청 ID. 같은 값으로 다시 보내면 새 참가자를 만들지 않고 기존 참가자를 돌려준다',
    example: 'c3d9e0b1-8a2f-4c6d-b5e4-1f7a9c2d3e60',
  })
  @IsString()
  @Length(1, 64)
  clientRequestId: string;
}
