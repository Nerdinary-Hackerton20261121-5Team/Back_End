import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSessionIdParam } from '../common/swagger/api-params.decorators.js';
import { Throttle } from '@nestjs/throttler';
import { ParticipantAuth } from '../auth/participant-auth.decorator.js';
import {
  CurrentParticipant,
  type RequestParticipant,
} from '../common/decorators/current-participant.decorator.js';
import { CommonErrors } from '../common/exception/error-code.js';
import { throttlePolicy } from '../config/policy.js';
import { ThrottleErrors } from '../throttle/throttle.errors.js';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
} from '../common/swagger/api-response.decorators.js';
import { ImageDto } from '../storage/dto/image.dto.js';
import { ImageErrors } from '../storage/images.errors.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SetSessionImageDto } from './dto/set-session-image.dto.js';
import { JoinSessionDto } from './dto/join-session.dto.js';
import {
  SessionDetailResponseDto,
  SessionEntryResponseDto,
} from './dto/session-response.dto.js';
import { DeleteSessionResponseDto } from './dto/delete-session-response.dto.js';
import { EndFocusResponseDto } from './dto/end-focus-response.dto.js';
import { LeaveSessionResponseDto } from './dto/leave-session-response.dto.js';
import { NicknameResponseDto, UpdateNicknameDto } from './dto/nickname.dto.js';
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

  @Delete(':sessionId')
  @ApiSessionIdParam()
  @ParticipantAuth()
  @ApiOperation({
    summary: '방 종료·폐기 (개설자)',
    description:
      '세션과 참가자·조각 등 모든 자료를 지운다. 이후 이 방의 토큰으로 하는 요청은 401로 거절된다.',
  })
  @ApiSuccessResponse(DeleteSessionResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.NOT_CREATOR,
    SessionErrors.SESSION_NOT_FOUND,
  )
  remove(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<DeleteSessionResponseDto> {
    return this.sessions.remove(sessionId, me);
  }

  @Patch(':sessionId/participants/me')
  @ApiSessionIdParam()
  @ParticipantAuth()
  @ApiOperation({
    summary: '닉네임 설정',
    description:
      '함께하는 사람에게 보일 이름을 정하거나 바꾼다(앞뒤 공백 제거 후 1~20자). ' +
      '초대 링크를 열 때 입장하고, "참여하기"를 누를 때 부르면 된다. 명단은 세션 조회의 participants로 본다.',
  })
  @ApiSuccessResponse(NicknameResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
  )
  updateNickname(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
    @Body() dto: UpdateNicknameDto,
  ): Promise<NicknameResponseDto> {
    return this.sessions.updateNickname(sessionId, me, dto.nickname);
  }

  @Delete(':sessionId/participants/me')
  @ApiSessionIdParam()
  @ParticipantAuth()
  @ApiOperation({
    summary: '대기실 나가기 (시작 전)',
    description:
      '시작 전 방에서 나간다. 내 참가자 정보를 지우므로 이 토큰은 이후 401로 거절되고, 빈자리에 다른 사람이 들어올 수 있다. ' +
      '방장이 나가면 입장 순서상 다음 사람이 방장이 된다(newCreatorId). 마지막 한 명이 나가면 방이 지워진다(sessionDeleted). ' +
      '시작된 방은 명단이 고정돼 나갈 수 없다(409).',
  })
  @ApiSuccessResponse(LeaveSessionResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
    SessionErrors.CANNOT_LEAVE_AFTER_START,
  )
  leave(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<LeaveSessionResponseDto> {
    return this.sessions.leave(sessionId, me);
  }

  @Post(':sessionId/end')
  @ApiSessionIdParam()
  @HttpCode(HttpStatus.OK)
  @ParticipantAuth()
  @ApiOperation({
    summary: '공부 조기 종료 (방장)',
    description:
      '모두의 공부를 지금 끝내고 조립 단계로 넘긴다(Figma 07 "종료"). 종료 시각을 지금으로 당기며, ' +
      '복원도는 원래 목표 시간 기준이다(50분 목표에서 20분에 끝내면 40%). 이후 조립판 조회로 조립을 시작한다. ' +
      '이미 끝난 세션에 다시 보내면 처음 끝난 시각을 그대로 돌려준다. 방을 지우는 것은 DELETE(방 삭제)다.',
  })
  @ApiSuccessResponse(EndFocusResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.NOT_CREATOR,
    SessionErrors.SESSION_NOT_FOUND,
    SessionErrors.FOCUS_NOT_STARTED,
  )
  endFocus(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<EndFocusResponseDto> {
    return this.sessions.endFocus(sessionId, me);
  }

  @Post(':sessionId/start')
  @ApiSessionIdParam()
  @HttpCode(HttpStatus.OK)
  @ParticipantAuth()
  @ApiOperation({
    summary: '세션 시작 (개설자)',
    description:
      '최소 4명이 입장해야 시작할 수 있다. 지금 입장한 인원(4~6명)으로 명단을 고정하고 시작·종료 시각을 확정한다. ' +
      '인원수만큼 원조각(한 행에 2명)과 조립 조각(원조각당 4개)을 만든다. ' +
      '이미 시작된 세션에 다시 보내면 처음 시작한 결과를 그대로 돌려준다. 시작 후에는 새로 입장할 수 없다.',
  })
  @ApiSuccessResponse(StartSessionResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.NOT_ENOUGH_PARTICIPANTS,
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
  // 남용 방지: 사용자 IP별 방 만들기 횟수 제한 (#67)
  @Throttle({
    default: {
      limit: () => throttlePolicy().createLimit,
      ttl: () => throttlePolicy().windowSeconds * 1000,
    },
  })
  @ApiOperation({
    summary: '방 만들기',
    description:
      '목표 시간·정원(4~6명)으로 방을 만든다. 개설자도 참가자로 등록되며 응답의 participantToken을 Authorize에 넣는다. ' +
      '최소 4명이 모이면 개설자가 시작할 수 있다.',
  })
  @ApiSuccessResponse(SessionEntryResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    ThrottleErrors.TOO_MANY_REQUESTS,
  )
  create(@Body() dto: CreateSessionDto): Promise<SessionEntryResponseDto> {
    return this.sessions.create(dto);
  }

  @Post('join')
  // 남용 방지: 사용자 IP별 입장 횟수 제한 (#67)
  @Throttle({
    default: {
      limit: () => throttlePolicy().joinLimit,
      ttl: () => throttlePolicy().windowSeconds * 1000,
    },
  })
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
    ThrottleErrors.TOO_MANY_REQUESTS,
  )
  join(@Body() dto: JoinSessionDto): Promise<SessionEntryResponseDto> {
    return this.sessions.join(dto);
  }

  @Patch(':sessionId/image')
  @ApiSessionIdParam()
  @ParticipantAuth()
  @ApiOperation({
    summary: '방 이미지 지정 (개설자, 시작 전)',
    description:
      '업로드한 사진(POST /images 응답의 imageId)이나 기본 이미지를 방 이미지로 정한다. 다시 보내면 바꾼다. ' +
      '시작한 뒤에는 바꿀 수 없다(409). 다른 방이 쓰고 있는 업로드 이미지는 지정할 수 없다(409).',
  })
  @ApiSuccessResponse(ImageDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.NOT_CREATOR,
    SessionErrors.SESSION_NOT_FOUND,
    ImageErrors.IMAGE_NOT_FOUND,
    SessionErrors.IMAGE_LOCKED_AFTER_START,
    ImageErrors.IMAGE_IN_USE,
  )
  setImage(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: SetSessionImageDto,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<ImageDto> {
    return this.sessions.setImage(sessionId, dto.imageId, me);
  }

  @Get(':sessionId')
  @ApiSessionIdParam()
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
