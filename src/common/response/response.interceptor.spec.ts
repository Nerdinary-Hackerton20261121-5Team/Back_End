import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor.js';

function contextWith(meta: Record<string, unknown>, type = 'http') {
  const handler = () => undefined;
  class Ctrl {}
  for (const [key, value] of Object.entries(meta)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => Ctrl,
  } as unknown as ExecutionContext;
}

const handlerReturning = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('반환값을 { success, code, message, data }로 감싼다', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextWith({}), handlerReturning({ id: 1 })),
    );
    expect(result).toEqual({
      success: true,
      code: 'SUCCESS',
      message: '요청이 성공했습니다.',
      data: { id: 1 },
    });
  });

  it('반환값이 없으면 data는 null', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextWith({}), handlerReturning(undefined)),
    );
    expect(result).toMatchObject({ success: true, data: null });
  });

  it('@RawResponse()가 붙은 핸들러는 감싸지 않는다', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextWith({ 'common:raw-response': true }),
        handlerReturning({ status: 'ok' }),
      ),
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('SSE 핸들러는 감싸지 않는다', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(
        contextWith({ __sse__: true }),
        handlerReturning({ data: 'event' }),
      ),
    );
    expect(result).toEqual({ data: 'event' });
  });
});
