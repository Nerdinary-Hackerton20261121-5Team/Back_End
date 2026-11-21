/** 참가자 토큰을 싣는 요청 헤더. auth 가드와 Swagger Authorize가 같은 이름을 쓴다. */
export const PARTICIPANT_TOKEN_HEADER = 'X-Participant-Token';

/** Swagger 보안 스키마 이름. 토큰이 필요한 API에 @ApiSecurity(PARTICIPANT_TOKEN_SECURITY)를 붙인다. */
export const PARTICIPANT_TOKEN_SECURITY = 'participant-token';
