import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { participantFromContext } from './current-participant.decorator.js';

const contextWith = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('CurrentParticipant', () => {
  it('가드가 넣어 둔 참가자를 돌려준다', () => {
    const participant = { participantId: 7, sessionId: 3 };

    expect(participantFromContext(contextWith({ participant }))).toBe(
      participant,
    );
  });

  it('참가자가 없으면 401', () => {
    expect(() => participantFromContext(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });
});
