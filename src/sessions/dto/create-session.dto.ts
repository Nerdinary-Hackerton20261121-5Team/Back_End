import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ALLOWED_CAPACITIES } from '../../config/policy.js';

export class CreateSessionDto {
  @ApiProperty({
    description: '공통 목표 시간(초). 허용 범위는 정책 설정값(기본 60초~4시간)',
    example: 60,
  })
  @IsInt()
  @IsPositive()
  goalSeconds: number;

  @ApiProperty({
    description: '방 정원',
    enum: ALLOWED_CAPACITIES,
    example: 4,
  })
  @IsIn(ALLOWED_CAPACITIES)
  maxParticipants: number;

  @ApiProperty({
    description:
      '생성 요청 ID. 같은 값으로 다시 보내면 방을 새로 만들지 않고 기존 방을 돌려준다 (AC-002)',
    example: '6f1c2a5e-4b7d-4e1a-9f3c-2d8b7a6e5f40',
  })
  @IsString()
  @Length(1, 64)
  clientRequestId: string;

  @ApiPropertyOptional({
    description:
      '퍼즐 이미지: 업로드 API(POST /api/images)가 돌려준 key. imageId와 함께 보낼 수 없다',
    example: '3f2a1c9e-8b7d-4e6f-a5c4-1d2e3f4a5b6c.jpg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f-]{36}\.[a-z0-9]+$/, {
    message: 'imageKey는 업로드 API가 돌려준 key여야 합니다.',
  })
  imageKey?: string;

  @ApiPropertyOptional({
    description: '퍼즐 이미지: 기본 이미지 ID. imageKey와 함께 보낼 수 없다',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  imageId?: number;
}
