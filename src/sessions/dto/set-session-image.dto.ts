import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class SetSessionImageDto {
  @ApiProperty({
    description:
      '방 이미지로 쓸 이미지 ID. 업로드 응답(POST /images)이나 기본 이미지의 imageId',
    example: 12,
  })
  @IsInt()
  @IsPositive()
  imageId: number;
}
