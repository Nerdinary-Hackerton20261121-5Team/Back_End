import {
  Body,
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
import { CreateSessionDto } from './dto/create-session.dto.js';
import { JoinSessionDto } from './dto/join-session.dto.js';
import {
  SessionDetailResponseDto,
  SessionEntryResponseDto,
} from './dto/session-response.dto.js';
import { StartSessionResponseDto } from './dto/start-session-response.dto.js';
import { SessionStartService } from './session-start.service.js';
import { SessionErrors } from './sessions.errors.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly starter: SessionStartService,
  ) {}

  @Post(':sessionId/start')
  @HttpCode(HttpStatus.OK)
  @ParticipantAuth()
  @ApiOperation({
    summary: '세션 시작 (개설자)',
    description:
      '지금 입장한 인원으로 명단을 고정하고 시작·종료 시각을 확정한다. 인원수만큼 원조각(한 행에 2명)과 조립 조각(원조각당 4개)을 만든다. ' +
      '이미 시작된 세션에 다시 보내면 처음 시작한 결과를 그대로 돌려준다. 시작 후에는 새로 입장할 수 없다.',
  })
  @ApiSuccessResponse(StartSessionResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.NOT_CREATOR,
    SessionErrors.SESSION_NOT_FOUND,
  )
  start(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<StartSessionResponseDto> {
    return this.starter.start(sessionId, me);
  }

  @Post()
  @ApiOperation({
    summary: '방 만들기',
    description:
      '목표 시간·정원·랜덤 허용 여부로 방을 만든다. 개설자도 참가자로 등록되며 응답의 participantToken을 Authorize에 넣는다. ' +
      '1명으로 시작하면 개인 세션이 된다 (같은 입구).',
  })
  @ApiSuccessResponse(SessionEntryResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(CommonErrors.INVALID_INPUT)
  create(@Body() dto: CreateSessionDto): Promise<SessionEntryResponseDto> {
    return this.sessions.create(dto);
  }

  @Post('join')
  @ApiOperation({
    summary: '코드로 입장',
    description:
      '세션 코드로 시작 전 방에 입장한다. 시작된 방·정원이 찬 방은 거절된다.',
  })
  @ApiSuccessResponse(SessionEntryResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
    SessionErrors.SESSION_ALREADY_STARTED,
    SessionErrors.SESSION_FULL,
  )
  join(@Body() dto: JoinSessionDto): Promise<SessionEntryResponseDto> {
    return this.sessions.join(dto);
  }

  @Get(':sessionId')
  @ParticipantAuth()
  @ApiOperation({
    summary: '세션 조회',
    description:
      '진행 단계·남은 시간·인원을 조회한다. 단계와 시간은 서버 시각(serverNow)으로 계산한다.',
  })
  @ApiSuccessResponse(SessionDetailResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
  )
  findOne(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<SessionDetailResponseDto> {
    return this.sessions.findOne(sessionId, me);
  }
}
