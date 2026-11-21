import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
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

  @ApiPropertyOptional({
    description: '랜덤 참가 허용 여부',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  allowRandom?: boolean;

  @ApiProperty({
    description:
      '생성 요청 ID. 같은 값으로 다시 보내면 방을 새로 만들지 않고 기존 방을 돌려준다 (AC-002)',
    example: '6f1c2a5e-4b7d-4e1a-9f3c-2d8b7a6e5f40',
  })
  @IsString()
  @Length(1, 64)
  clientRequestId: string;
}
