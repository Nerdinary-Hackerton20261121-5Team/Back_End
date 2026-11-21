import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BusinessException } from './business.exception.js';
import { CommonErrors } from './error-code.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function mockHost() {
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BusinessException은 정의된 code·status·message로 응답한다', () => {
    const { host, res } = mockHost();
    const SESSION_NOT_FOUND = {
      code: 'SESSION_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
      message: '세션을 찾을 수 없습니다.',
    };

    filter.catch(new BusinessException(SESSION_NOT_FOUND), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'SESSION_NOT_FOUND',
      message: '세션을 찾을 수 없습니다.',
      data: null,
    });
  });

  it('BusinessException의 메시지를 바꿀 수 있다', () => {
    const { host, res } = mockHost();

    filter.catch(
      new BusinessException(CommonErrors.CONFLICT, '이미 시작된 세션입니다.'),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CONFLICT',
        message: '이미 시작된 세션입니다.',
      }),
    );
  });

  it('ValidationPipe의 400은 INVALID_INPUT과 검증 사유를 담는다', () => {
    const { host, res } = mockHost();

    filter.catch(
      new BadRequestException([
        'goalSeconds must be a positive number',
        'property foo should not exist',
      ]),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'INVALID_INPUT',
      message:
        '요청 값이 올바르지 않습니다. (goalSeconds must be a positive number, property foo should not exist)',
      data: null,
    });
  });

  it('사유 없는 400은 기본 메시지만 쓴다', () => {
    const { host, res } = mockHost();

    filter.catch(new BadRequestException(), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: '요청 값이 올바르지 않습니다.',
      }),
    );
  });

  it('없는 경로(NotFoundException)는 404 NOT_FOUND', () => {
    const { host, res } = mockHost();

    filter.catch(new NotFoundException('Cannot GET /api/nope'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: '요청한 리소스를 찾을 수 없습니다.',
      }),
    );
  });

  it('가드의 403은 FORBIDDEN', () => {
    const { host, res } = mockHost();

    filter.catch(new ForbiddenException(), host);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('공통 코드에 없는 4xx는 HTTP_<상태>로 응답한다', () => {
    const { host, res } = mockHost();

    filter.catch(new HttpException('Gone', HttpStatus.GONE), host);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HTTP_410' }),
    );
  });

  it('알 수 없는 예외는 500이고 내부 메시지를 노출하지 않는다', () => {
    const { host, res } = mockHost();

    filter.catch(new Error('DB password is wrong: secret'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
      data: null,
    });
    expect(logError).toHaveBeenCalled();
  });

  it('이미 응답을 보냈으면 아무것도 하지 않는다', () => {
    const { host, res } = mockHost();
    res.headersSent = true;

    filter.catch(new Error('late'), host);

    expect(res.status).not.toHaveBeenCalled();
  });
});
