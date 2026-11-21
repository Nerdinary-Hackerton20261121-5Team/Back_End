@AGENTS.md
@docs/Coding/NESTJS.md

# 백엔드 저장소 작업 안내 (팀 공통)

이 저장소를 클론해 Claude Code를 연 팀원은 아래 규칙대로 바로 작업한다.
구조·스크립트·전역 설정·협업 규칙을 바꾸면 이 파일도 함께 고친다.

- 원격: https://github.com/Nerdinary-Hackerton20261121-5Team/Back_End
- 스택: NestJS 12 · TypeScript 6 · ESM(`"type": "module"`) · Express · TypeORM + MySQL · Vitest · oxlint · Prettier
- 답변·문서·커밋 메시지는 한국어로 쓴다.

## 1. 작업 시작 체크리스트 (에이전트가 먼저 확인)

1. `git status`로 현재 브랜치와 미커밋 변경을 확인한다. 다른 사람의 미커밋 변경은 건드리지 않는다.
2. 작업 브랜치가 아니면 `dev` 최신본에서 새 브랜치를 만든다.
   `git switch dev && git pull && git switch -c feat/<요약>`
3. 브랜치를 바꾼 뒤 `package.json`이 달라졌으면 `npm install`을 다시 한다.
   (브랜치마다 의존성이 다를 수 있어, 안 하면 `Cannot find module` 오류가 난다)
4. `.env`가 없으면 `.env.example`을 복사해 만들고, 비어 있는 `DB_*` 값은 사용자에게 받는다. 값을 지어내지 않는다.

## 2. 브랜치·커밋·PR 규칙

```
feat/<요약> ──PR(리뷰 1명 승인)──▶ dev ──PR(리뷰 1명 승인)──▶ main ──▶ 자동 배포
```

- 기본 브랜치는 `dev`. `dev`·`main`은 보호 브랜치라 직접 push하지 않고 PR로만 병합한다.
  승인 1개 필수, 승인 후 새 커밋을 올리면 승인이 초기화된다.
- 브랜치 이름: `feat/<요약>`, `fix/<요약>`, `docs/<요약>`, `chore/<요약>` (영문 소문자·하이픈)
- 커밋 메시지: `타입: 한국어 설명` 한 줄. 예) `feat: 세션 생성 API 추가`
  - 타입: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
  - 스코프·이슈 번호를 괄호로 붙이지 않는다 (이슈 연결은 PR 본문 `closes #번호`로).
  - 작은 단위로 여러 번 커밋한다. **커밋·push·PR 생성 전에는 사용자에게 메시지와 포함 파일을 보여주고 확인을 받는다.**
- 커밋·PR에 AI 공동작성자(`Co-Authored-By: Claude ...`)나 "Generated with Claude Code" 문구를 넣지 않는다.
- 이슈: `.github/ISSUE_TEMPLATE/feature.md` 양식(제목 `[FEAT] ...`, 라벨 `feature`)으로 먼저 만든다.
- PR: `dev` 대상으로 `.github/PULL_REQUEST_TEMPLATE.md` 양식을 채운다.
  체크리스트는 실제로 확인한 항목만 체크하고, 확인 못 한 것은 "미검증"으로 적는다.
- 커밋 전 로컬에서 `npm run lint`, `npm run build`, `npm test`를 통과시킨다 (CI와 같은 명령).

## 3. 폴더·파일

| 경로 | 역할 | Git |
|---|---|---|
| `src/main.ts` | 앱 생성·전역 설정·Swagger·listen | O |
| `src/app.module.ts` | 루트 모듈. Config(전역)·Database·Observe 등록, 기능 모듈을 여기서 import | O |
| `src/app.controller.ts`, `src/app.service.ts` | 샘플. 실제 기능은 `src/<기능>/` 모듈로 추가 | O |
| `src/database/` | DB 접속 설정(`database.config.ts`), `DatabaseModule`, CLI용 `data-source.ts`, `migrations/` | O |
| `src/**/*.spec.ts` | 단위 테스트(코드 옆에 둠) | O |
| `test/` | e2e 테스트 (`vitest.config.e2e.ts`, MySQL 필요) | O |
| `Dockerfile`, `.dockerignore` | 운영 이미지 (node:24-alpine 멀티 스테이지) | O |
| `.github/workflows/ci.yml` | `dev`·`main` PR/push 시 lint → build → 단위 테스트 | O |
| `.github/workflows/deploy.yml` | `main` push 시 이미지 빌드 → GHCR → EC2 배포 → 마이그레이션 (배포 담당 관리) | O |
| `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` | 이슈·PR 양식 | O |
| `docs/Coding/NESTJS.md` | NestJS 기술 지침 | O |
| `AGENTS.md` | 팀 공통 에이전트 규칙 (개인 역할로 덮어쓰지 않음) | O |
| `.claude/skills/`, `.agents/skills/` | NestJS 공식 스킬. 두 폴더 내용 동일 (Claude Code용 / 기타 에이전트용) | O |
| `README.md` | 심사위원·외부용 소개 문서. 내부 작업 규칙은 여기 쓰지 않는다 | O |
| `.env.example` | 환경변수 이름 목록 (값 없음) | O |
| `.env` | 실제 환경변수·비밀값 | **X** |
| `.local/` | 개인 역할 설정(`role.yaml`) | **X** |
| `dist/`, `node_modules/`, `*.tsbuildinfo` | 빌드·의존성 산출물 | **X** |

## 4. 전역 설정 (src/main.ts)

- 모든 API 경로 앞에 `/api` 접두사
- Swagger 문서: `http://localhost:3000/docs` (Bearer 인증 스키마 등록됨)
- CORS: `CORS_ORIGIN`(콤마 구분), 비어 있으면 모든 origin 허용, `credentials: true`
- 전역 `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform` → DTO에 없는 필드는 400
- 포트: `PORT` 환경변수, 기본 3000

## 5. 로컬 실행

1. `npm install`
2. `.env.example`을 복사해 `.env` 생성 후 `DB_*` 값 입력
3. 로컬 MySQL에 빈 DB와 계정 준비 (테이블은 만들지 않는다 → 마이그레이션이 만든다)
4. `npm run migration:run` → `npm run start:dev` → `http://localhost:3000/api`, `/docs`

앱은 시작할 때 MySQL에 접속한다. DB 없이 띄우면 재시도 후 실패한다.

## 6. DB 규칙 (TypeORM + MySQL)

- 접속 정보는 `.env`의 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_LOGGING`에서만 읽는다.
- `synchronize`는 항상 `false`. **테이블은 손으로 만들지 않고 마이그레이션으로만 바꾼다.**
- 엔티티는 `src/<기능>/entities/*.entity.ts`에 두고, 기능 모듈에서 `TypeOrmModule.forFeature([...])`로 등록한다 (`autoLoadEntities`가 모은다).
- 스키마 변경 순서: 엔티티 수정 → `npm run migration:generate -- src/database/migrations/<이름>` → 생성된 SQL 확인 → `npm run migration:run` → 마이그레이션 파일도 함께 커밋
- 되돌리기 `npm run migration:revert`, 상태 확인 `npm run migration:show`
- 시각은 UTC로 저장한다 (`timezone: 'Z'`), 문자셋 utf8mb4.
- 수정은 `save()` 대신 `update()`/`delete()`에 소유자 조건을 넣고 `affected`로 404를 판단한다. 중복은 UNIQUE 제약 위반을 잡아 409로 응답한다.

## 7. 배포 (배포 담당 관리)

- `main` 병합 시 `deploy.yml`이 실행된다. `EC2_HOST` Secret이 없으면 배포 단계를 건너뛴다.
- 필요한 GitHub Secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `CORS_ORIGIN`
- 운영 비밀값은 GitHub Secrets에만 두고 저장소·코드·로그에 넣지 않는다.
- AWS 리소스 생성·보안그룹·포트 변경, DB 스키마 삭제·초기화는 반드시 사용자 확인 후 진행한다.

## 8. 기능 개발 규칙

- 기능별 모듈 폴더 `src/<기능>/`에 module·controller·service·dto·entities·spec을 두고 `AppModule`에 import한다.
- Controller에는 비즈니스 로직을 넣지 않는다 (Controller → Service → Repository).
- 상대 import는 `.js`로 끝낸다 (ESM). 테스트 목은 `vi.fn()`.
- 요청 검증은 class-validator DTO(전역 ValidationPipe)를 기본으로 한다.
- 모든 API에 Swagger 설명·요청 예시·성공/실패 응답 예시를 단다. 구현하지 못한 API는 Swagger에 노출하지 않는다.
- 공통 응답 형식·전역 예외처리는 공통 모듈로 한 번만 만들고 모든 API가 재사용한다 (담당자를 정하고 공통 파일은 한 사람씩 수정).
- 기획(Notion)에서 확정되지 않은 값은 임의로 확정하지 않고 설정값으로 빼고 `TODO`를 단다.
- 줄바꿈은 LF (`.gitattributes`).

## 9. 스크립트

| 명령 | 용도 |
|---|---|
| `npm run start:dev` | 개발 서버(watch) |
| `npm run build` / `npm run start:prod` | 빌드 / 빌드 결과 실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | e2e 테스트 (MySQL 필요) |
| `npm run lint` | oxlint (type-aware) |
| `npm run format` | Prettier |
| `npm run migration:generate -- src/database/migrations/<이름>` | 엔티티 기준 마이그레이션 생성 |
| `npm run migration:create -- src/database/migrations/<이름>` | 빈 마이그레이션 생성 |
| `npm run migration:run` / `migration:revert` / `migration:show` | 적용 / 되돌리기 / 상태 |
