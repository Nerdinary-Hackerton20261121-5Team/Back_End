import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParticipantAuth } from '../auth/participant-auth.decorator.js';
import {
  CurrentParticipant,
  type RequestParticipant,
} from '../common/decorators/current-participant.decorator.js';
import { CommonErrors } from '../common/exception/error-code.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/swagger/api-response.decorators.js';
import { SessionErrors } from '../sessions/sessions.errors.js';
import { AssemblyErrors } from './assembly.errors.js';
import { AssemblyService } from './assembly.service.js';
import {
  AssemblyBoardResponseDto,
  PlacePieceDto,
  PlacePieceResponseDto,
} from './dto/assembly.dto.js';

@ApiTags('assembly')
@Controller('sessions')
export class AssemblyController {
  constructor(private readonly assembly: AssemblyService) {}

  @Get(':sessionId/assembly')
  @ParticipantAuth()
  @ApiOperation({
    summary: '조립판 조회',
    description:
      '집중 시간이 끝난 뒤 처음 호출되면 조립을 연다: 최종 복원도 확정, 접속해 있지 않은 사람의 조각을 정답 칸에 자동 배치. ' +
      '조각의 정답 위치는 놓이기 전까지 알려주지 않는다. 실시간 반영은 이 API를 주기적으로 조회한다.',
  })
  @ApiSuccessResponse(AssemblyBoardResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
    AssemblyErrors.ASSEMBLY_NOT_OPEN,
  )
  board(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<AssemblyBoardResponseDto> {
    return this.assembly.board(sessionId, me);
  }

  @Patch(':sessionId/assembly/pieces/:pieceId')
  @ParticipantAuth()
  @ApiOperation({
    summary: '조각 놓기',
    description:
      '자기 원조각에서 나온 조각만 옮길 수 있다(개설자도 동일). 정답 칸이면 저장하고 correct: true. ' +
      '틀린 칸·이미 찬 칸이면 저장하지 않고 correct: false → 클라이언트가 직전 위치로 되돌린다. ' +
      '모든 조각이 정답 칸에 놓이면 팀 통과(COMPLETED).',
  })
  @ApiSuccessResponse(PlacePieceResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    AssemblyErrors.NOT_PIECE_OWNER,
    AssemblyErrors.PIECE_NOT_FOUND,
    SessionErrors.SESSION_NOT_FOUND,
    AssemblyErrors.ASSEMBLY_NOT_OPEN,
  )
  place(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('pieceId', ParseIntPipe) pieceId: number,
    @Body() dto: PlacePieceDto,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<PlacePieceResponseDto> {
    return this.assembly.place(sessionId, pieceId, dto.targetPosition, me);
  }
}
