import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import {
  BoardResponseDto,
  HeartbeatResponseDto,
} from './dto/study-response.dto.js';
import { StudyService } from './study.service.js';

@ApiTags('study')
@Controller('sessions')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Post(':sessionId/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ParticipantAuth()
  @ApiOperation({
    summary: '연결 확인 (heartbeat)',
    description:
      '공부 중 heartbeatIntervalSeconds마다 보낸다. 마지막 확인 후 단절 기준 시간(기본 90초)이 지나면 끊긴 것으로 보고 ' +
      '그 시점에 복원도를 고정한다. 고정된 뒤에는 다시 보내도 바뀌지 않는다. 공부 시간이 끝난 뒤에는 아무것도 바꾸지 않는다.',
  })
  @ApiSuccessResponse(HeartbeatResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
  )
  heartbeat(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<HeartbeatResponseDto> {
    return this.study.heartbeat(sessionId, me);
  }

  @Get(':sessionId/board')
  @ParticipantAuth()
  @ApiOperation({
    summary: '진행판 조회',
    description:
      '원조각 위치·영역(0~1 좌표)과 복원도. 집중 중에는 내 조각 복원도만 주고 남의 조각은 null(블러). ' +
      '조립 단계부터 모두 공개한다.',
  })
  @ApiSuccessResponse(BoardResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
  )
  board(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<BoardResponseDto> {
    return this.study.board(sessionId, me);
  }
}
