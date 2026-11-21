import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** 닉네임 길이 (컬럼 participant.nickname VARCHAR(20)) */
export const NICKNAME_MAX = 20;

/** 닉네임 설정 요청 (#71) */
export class UpdateNicknameDto {
  @ApiProperty({
    description: `함께하는 사람에게 보일 이름 (앞뒤 공백 제거 후 1~${NICKNAME_MAX}자)`,
    example: '비둘기',
  })
  @Transform(trim)
  @IsString()
  @Length(1, NICKNAME_MAX)
  nickname: string;
}

/** 방 만들기·입장에 함께 보낼 수 있는 닉네임 (선택) */
export class OptionalNicknameDto {
  @ApiPropertyOptional({
    description: `함께하는 사람에게 보일 이름 (선택, 1~${NICKNAME_MAX}자). 나중에 PATCH .../participants/me로 정해도 된다`,
    example: '비둘기',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, NICKNAME_MAX)
  nickname?: string;
}

/** 닉네임 설정 응답 */
export class NicknameResponseDto {
  @ApiProperty({ example: 2 })
  participantId: number;

  @ApiProperty({ example: '비둘기' })
  nickname: string;
}

/** 세션 조회의 명단 한 줄 */
export class ParticipantSummaryDto {
  @ApiProperty({ example: 2 })
  participantId: number;

  @ApiProperty({
    description: '닉네임. 아직 정하지 않았으면 null',
    type: String,
    nullable: true,
    example: '비둘기',
  })
  nickname: string | null;

  @ApiProperty({ description: '방장 여부', example: false })
  isCreator: boolean;
}
