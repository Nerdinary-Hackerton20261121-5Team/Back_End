import {
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
import {
  BoardResponseDto,
  HeartbeatResponseDto,
} from './dto/study-response.dto.js';
import { PieceImageService } from './piece-image.service.js';
import { StudyErrors } from './study.errors.js';
import { StudyService } from './study.service.js';

@ApiTags('study')
@Controller('sessions')
export class StudyController {
  constructor(
    private readonly study: StudyService,
    private readonly pieceImages: PieceImageService,
  ) {}

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

  @Get(':sessionId/pieces/:position/image')
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
