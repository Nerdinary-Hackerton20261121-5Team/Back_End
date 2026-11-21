import { ExecutionContext } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { BusinessException } from '../common/exception/business.exception.js';
import type { Participant } from '../sessions/entities/participant.entity.js';
import { hashParticipantToken } from './participant-token.js';
import { ParticipantGuard } from './participant.guard.js';

const TOKEN = 'valid-token';
const stored = { id: 7, sessionId: 3, isCreator: true } as Participant;

function setup(found: Participant | null = stored) {
  const findOne = vi.fn().mockResolvedValue(found);
  const guard = new ParticipantGuard({
    findOne,
  } as unknown as Repository<Participant>);
  return { guard, findOne };
}

function contextWith(
  headers: Record<string, string>,
  params: Record<string, string> = {},
) {
  const request: Record<string, unknown> = { headers, params };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e instanceof BusinessException ? e.error.code : String(e);
  }
  return 'NO_ERROR';
}

describe('ParticipantGuard', () => {
  it('토큰을 해시로 찾아 request.participant를 채운다', async () => {
    const { guard, findOne } = setup();
    const { context, request } = contextWith({
      'x-participant-token': TOKEN,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashParticipantToken(TOKEN) },
      }),
    );
    expect(request.participant).toEqual({
      participantId: 7,
      sessionId: 3,
      isCreator: true,
    });
  });

  it('헤더가 없으면 401 TOKEN_REQUIRED', async () => {
    const { guard } = setup();
    const { context } = contextWith({});
    expect(await errorCode(guard.canActivate(context))).toBe('TOKEN_REQUIRED');
  });

  it('맞는 참가자가 없으면 401 TOKEN_INVALID', async () => {
    const { guard } = setup(null);
    const { context } = contextWith({ 'x-participant-token': 'wrong' });
    expect(await errorCode(guard.canActivate(context))).toBe('TOKEN_INVALID');
  });

  it('AC-006 경로의 세션이 토큰의 세션과 다르면 403', async () => {
    const { guard } = setup();
    const { context } = contextWith(
      { 'x-participant-token': TOKEN },
      { sessionId: '99' },
    );
    expect(await errorCode(guard.canActivate(context))).toBe(
      'NOT_SESSION_PARTICIPANT',
    );
  });

  it('경로의 세션이 같으면 통과', async () => {
    const { guard } = setup();
    const { context } = contextWith(
      { 'x-participant-token': TOKEN },
      { sessionId: '3' },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
