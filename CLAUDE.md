@AGENTS.md
@docs/Coding/NESTJS.md

# 프로젝트 초기 구조 (백엔드)

팀원 누구나 AI 에이전트로 작업을 시작할 때 이 구조를 기준으로 삼는다.
구조·스크립트·전역 설정을 바꾸면 이 절도 함께 고친다.

- 원격: https://github.com/Nerdinary-Hackerton20261121-5Team/Back_End (기본 브랜치 `main`)
- 스택: NestJS 12 · TypeScript 6 · ESM(`"type": "module"`) · Express 플랫폼 · Vitest · oxlint · Prettier

## 폴더·파일

| 경로 | 역할 | Git |
|---|---|---|
| `src/main.ts` | 앱 생성·전역 설정·Swagger·listen | O |
| `src/app.module.ts` | 루트 모듈. Config(전역)·Observe 등록, 기능 모듈을 여기서 import | O |
| `src/app.controller.ts`, `src/app.service.ts` | 샘플. 실제 기능은 `src/<기능>/` 모듈로 추가 | O |
| `src/health/` | `GET /api/health` → 200 `{status, commit}`. 클러스터 probe가 쓰므로 경로·200 응답을 유지 | O |
| `Dockerfile`, `.dockerignore` | 운영 이미지(포트 3000, `GIT_SHA` build-arg) | O |
| `.github/workflows/` | `ci.yml` PR 검증, `deploy.yml` main 머지 시 registry.bemelon.me/cmc-11th push → cluster-config 태그 갱신 → Argo CD 배포 | O |
| `src/**/*.spec.ts` | 단위 테스트(코드 옆에 둠) | O |
| `test/` | e2e 테스트 (`vitest.config.e2e.ts`) | O |
| `docs/Coding/NESTJS.md` | NestJS 기술 지침 | O |
| `AGENTS.md` | 팀 공통 에이전트 규칙 (개인 역할로 덮어쓰지 않음) | O |
| `CLAUDE.md` | Claude Code 진입 파일 (위 두 문서 import + 이 구조 안내) | O |
| `.claude/skills/`, `.agents/skills/` | NestJS 공식 스킬(`@nestjs/skills`). 두 폴더 내용 동일, 각각 Claude Code·기타 에이전트용 | O |
| `.env.example` | 환경변수 예시 (`PORT`, `CORS_ORIGIN`) | O |
| `.env` | 실제 환경변수·비밀값 (Observe 키 포함) | X |
| `.local/` | 개인 역할 설정(`role.yaml`) | X |
| `dist/`, `node_modules/`, `*.tsbuildinfo` | 빌드·의존성 산출물 | X |

## 전역 설정 (src/main.ts)

- 모든 API 경로 앞에 `/api` 접두사 (`app.setGlobalPrefix('api')`)
- Swagger 문서: `http://localhost:3000/api/docs` (Bearer 인증 스키마 등록됨)
- CORS: `CORS_ORIGIN`(콤마 구분), 비어 있으면 모든 origin 허용, `credentials: true`
- 전역 `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform` → DTO에 없는 필드는 400
- 포트: `PORT` 환경변수, 기본 3000

## 시작 방법

1. `git clone` 후 `npm install`
2. `.env.example`을 복사해 `.env` 생성
3. `npm run start:dev` → `http://localhost:3000/api`

## 스크립트

| 명령 | 용도 |
|---|---|
| `npm run start:dev` | 개발 서버(watch) |
| `npm run build` / `npm run start:prod` | 빌드 / 빌드 결과 실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | e2e 테스트 |
| `npm run lint` | oxlint (type-aware) |
| `npm run format` | Prettier |

## 기능 추가 규칙

- 기능별 모듈 폴더 `src/<기능>/` 에 module·controller·service·dto·spec을 두고 `AppModule`에 import한다.
- 상대 import는 `.js`로 끝낸다 (ESM). 목은 `vi.fn()`.
- 요청 검증은 class-validator DTO(전역 ValidationPipe)를 기본으로 한다.
- 줄바꿈은 LF (`.gitattributes`).
- 커밋·PR에 AI 공동작성자(Co-Authored-By) 표시를 넣지 않는다.
