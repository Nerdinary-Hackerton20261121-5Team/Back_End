import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiPiecePositionParam,
  ApiSessionIdParam,
} from '../common/swagger/api-params.decorators.js';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
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
import { RawResponse } from '../common/response/raw-response.decorator.js';
import { SessionErrors } from '../sessions/sessions.errors.js';
import { HeartbeatRequestDto } from './dto/heartbeat.dto.js';
import {
  BoardResponseDto,
  HeartbeatResponseDto,
  ResultResponseDto,
} from './dto/study-response.dto.js';
import { PieceImageService } from './piece-image.service.js';
import { StudyErrors } from './study.errors.js';
import { StudyService } from './study.service.js';

@ApiTags('study')
@ApiSessionIdParam()
@Controller('sessions')
export class StudyController {
  constructor(
    private readonly study: StudyService,
    private readonly pieceImages: PieceImageService,
  ) {}

  @Post(':sessionId/heartbeat')
  // 1초 주기라 같은 와이파이 여러 명이면 IP당 한도에 닿을 수 있어 제한에서 뺀다 (#84). 토큰 필요, 본인 기록만 갱신
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ParticipantAuth()
  @ApiOperation({
    summary: '연결 확인·상태 보고 (heartbeat)',
    description:
      '공부 중 heartbeatIntervalSeconds마다, 그리고 상태(state)가 바뀔 때 바로 보낸다. ' +
      '서버는 직전 heartbeat의 상태가 FOCUSING(얼굴 인식)이었던 구간만 서버 시각으로 재서 누적한다. ' +
      'PAUSED(일시정지)·AWAY(얼굴 인식 안 됨)인 구간과, 단절 기준 시간(기본 90초)을 넘겨 끊긴 구간은 쌓이지 않는다. ' +
      '끊겼다가 다시 보내면 그때부터 이어서 쌓인다. 복원도 = 누적 집중 시간 / 목표 시간. 공부 시간이 끝난 뒤에는 아무것도 바꾸지 않는다.',
  })
  @ApiSuccessResponse(HeartbeatResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
  )
  heartbeat(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
    @Body() body: HeartbeatRequestDto,
  ): Promise<HeartbeatResponseDto> {
    return this.study.heartbeat(sessionId, me, body?.state);
  }

  @Get(':sessionId/board')
  @ParticipantAuth()
  @ApiOperation({
    summary: '진행판 조회',
    description:
      '조각 위치·모양과 복원도, 함께 하는 사람 명단(상태·누적 집중 시간). ' +
      '복원도(진행 링)는 모두 공개하고, 남의 조각 이미지는 복원도에 따라 블러로 준다. 조회는 아무것도 저장하지 않는다.',
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

  @Get(':sessionId/result')
  @ParticipantAuth()
  @ApiOperation({
    summary: '공부 결과',
    description:
      '공부 시간이 끝난 뒤(ASSEMBLING·COMPLETED) 참가자별 누적 집중 시간·집중하지 못한 시간·최종 복원도. ' +
      '공부 중이거나 시작 전이면 409 STUDY_NOT_FINISHED.',
  })
  @ApiSuccessResponse(ResultResponseDto)
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
    StudyErrors.STUDY_NOT_FINISHED,
  )
  result(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentParticipant() me: RequestParticipant,
  ): Promise<ResultResponseDto> {
    return this.study.result(sessionId, me);
  }

  @Get(':sessionId/pieces/:position/image')
  @ApiPiecePositionParam()
  @ParticipantAuth()
  // 이미지 바이트를 그대로 보낸다 (공통 { data } 응답으로 감싸지 않음)
  @RawResponse()
  // 블러 단계가 진행도에 따라 바뀌므로 오래 캐시하지 않는다
  @Header('Cache-Control', 'private, max-age=10')
  @ApiOperation({
    summary: '조각 이미지',
    description:
      '정답 칸 position(1부터) 조각을 직소 모양으로 오린 투명 배경 WebP. 크기는 칸보다 사방으로 ' +
      'padRatio(진행판 응답)만큼 크다. 내 조각은 선명하게, 남의 조각은 주인의 복원도에 따라 흐리게 주며 ' +
      '100%여도 원본은 주지 않는다. 같은 사람의 조각 2개는 같은 단계로 흐려진다. ' +
      '응답 헤더 X-Piece-Blur-Level: none(내 조각) 또는 0~10(높을수록 덜 흐림).',
  })
  @ApiProduces('image/webp')
  @ApiOkResponse({
    description: '조각 이미지 (image/webp)',
    content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiErrorResponses(
    CommonErrors.INVALID_INPUT,
    SessionErrors.SESSION_NOT_FOUND,
    StudyErrors.PIECE_NOT_FOUND,
    StudyErrors.SESSION_IMAGE_NOT_SET,
  )
  async pieceImage(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('position', ParseIntPipe) position: number,
    @CurrentParticipant() me: RequestParticipant,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const image = await this.pieceImages.render(sessionId, position, me);
    res.setHeader('X-Piece-Blur-Level', image.blurLevel ?? 'none');
    // @Header로 Content-Type을 주면 Express가 charset을 붙이므로 여기서 지정한다
    return new StreamableFile(image.body, { type: 'image/webp' });
  }
}
