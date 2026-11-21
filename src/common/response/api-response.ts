/**
 * 모든 API가 쓰는 공통 응답 형식.
 * 성공: { success: true,  code: 'SUCCESS',            message: '요청이 성공했습니다.', data: {...} }
 * 실패: { success: false, code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다.', data: null }
 */
export interface ApiResponseBody<T> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
}

export const SUCCESS_CODE = 'SUCCESS';
export const SUCCESS_MESSAGE = '요청이 성공했습니다.';

export function successBody<T>(data: T): ApiResponseBody<T> {
  return {
    success: true,
    code: SUCCESS_CODE,
    message: SUCCESS_MESSAGE,
    // undefined(반환값 없음)도 null로 통일한다
    data: data ?? null,
  };
}

export function errorBody(code: string, message: string): ApiResponseBody<null> {
  return { success: false, code, message, data: null };
}
