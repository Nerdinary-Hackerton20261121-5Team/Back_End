import { ApiProperty } from '@nestjs/swagger';

export class DeleteSessionResponseDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({ description: '삭제 완료', example: true })
  deleted: true;
}
