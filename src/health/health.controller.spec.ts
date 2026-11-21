import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const get = vi.fn();
  let controller: HealthController;

  beforeEach(async () => {
    get.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: ConfigService, useValue: { get } }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('상태 ok와 GIT_SHA를 돌려준다', () => {
    get.mockReturnValue('abc123');

    expect(controller.check()).toEqual({ status: 'ok', commit: 'abc123' });
    expect(get).toHaveBeenCalledWith('GIT_SHA');
  });

  it('GIT_SHA가 없으면 commit은 unknown', () => {
    get.mockReturnValue(undefined);

    expect(controller.check()).toEqual({ status: 'ok', commit: 'unknown' });
  });

  it('GIT_SHA가 빈 문자열이어도 unknown', () => {
    get.mockReturnValue('');

    expect(controller.check()).toEqual({ status: 'ok', commit: 'unknown' });
  });
});
