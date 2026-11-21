import { ApiParam } from '@nestjs/swagger';

/**
 * 경로 파라미터 Swagger 설명·예시 (#89). 여러 컨트롤러가 같은 문구를 쓰도록 한곳에 둔다.
 * 컨트롤러 클래스에 붙이면 그 컨트롤러의 모든 라우트에 적용된다.
 */
export const ApiSessionIdParam = () =>
  ApiParam({
    name: 'sessionId',
    type: Number,
    description: '방 만들기·입장 응답의 sessionId',
    example: 1,
  });

export const ApiPieceIdParam = () =>
  ApiParam({
    name: 'pieceId',
    type: Number,
    description: '조립판 조회 응답 pieces[]의 pieceId (내 조각만 옮길 수 있음)',
    example: 1,
  });

export const ApiPiecePositionParam = () =>
  ApiParam({
    name: 'position',
    type: Number,
    description:
      '조각 정답 칸 번호 (왼쪽 위부터 1). 진행판 응답 pieces[]의 position',
    example: 1,
  });
