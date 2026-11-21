import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';
import { CommonErrors, type ErrorDefinition } from '../exception/error-code.js';
import {
  errorBody,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from '../response/api-response.js';

function envelope(
  data: SchemaObject | ReferenceObject,
  example: { success: boolean; code: string; message: string },
): SchemaObject {
  return {
    type: 'object',
    required: ['success', 'code', 'message', 'data'],
    properties: {
      success: { type: 'boolean', example: example.success },
      code: { type: 'string', example: example.code },
      message: { type: 'string', example: example.message },
      data,
    },
  };
}

interface SuccessOptions {
  /** 200(기본) 또는 201(생성) */
  status?: HttpStatus.OK | HttpStatus.CREATED;
  description?: string;
  /** data가 model의 배열일 때 */
  isArray?: boolean;
}

/**
 * 성공 응답 문서. data 자리에 model(응답 DTO 클래스)의 스키마를 넣는다.
 *   @ApiSuccessResponse(SessionResponseDto, { status: HttpStatus.CREATED })
 * 반환값이 없으면 model에 null을 준다 (data: null).
 */
export function ApiSuccessResponse(
  model: Type | null,
  options: SuccessOptions = {},
) {
  const ref = model ? { $ref: getSchemaPath(model) } : undefined;
  const data: SchemaObject | ReferenceObject = !ref
    ? { type: 'object', nullable: true, example: null }
    : options.isArray
      ? { type: 'array', items: ref }
      : ref;

  return applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description ?? SUCCESS_MESSAGE,
      schema: envelope(data, {
        success: true,
        code: SUCCESS_CODE,
        message: SUCCESS_MESSAGE,
      }),
    }),
  );
}

/**
 * 실패 응답 문서. 상태 코드별로 묶어 에러 코드마다 예시를 붙인다.
 *   @ApiErrorResponses(CommonErrors.INVALID_INPUT, SessionErrors.SESSION_NOT_FOUND)
 * 500(INTERNAL_ERROR)은 항상 함께 붙는다.
 */
export function ApiErrorResponses(...errors: ErrorDefinition[]) {
  const all = [...errors, CommonErrors.INTERNAL_ERROR];
  const byStatus = new Map<number, ErrorDefinition[]>();
  for (const error of all) {
    const list = byStatus.get(error.status) ?? [];
    if (!list.some((e) => e.code === error.code)) list.push(error);
    byStatus.set(error.status, list);
  }

  return applyDecorators(
    ...[...byStatus].map(([status, list]) =>
      ApiResponse({
        status,
        description: list.map((e) => `${e.code}: ${e.message}`).join(' / '),
        content: {
          'application/json': {
            schema: envelope(
              { type: 'object', nullable: true, example: null },
              { success: false, code: list[0].code, message: list[0].message },
            ),
            examples: Object.fromEntries(
              list.map((e) => [
                e.code,
                { summary: e.message, value: errorBody(e.code, e.message) },
              ]),
            ),
          },
        },
      }),
    ),
  );
}
