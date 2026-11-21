# Hackathon Back-End

> Nerdinary 해커톤 5팀 백엔드 서버

<!-- TODO: 서비스 한 줄 소개와 핵심 기능은 기획 확정 후 채운다 -->

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | NestJS 12 (Express) |
| 언어 | TypeScript 6 (ESM) |
| API 문서 | Swagger (`@nestjs/swagger`) |
| 요청 검증 | class-validator / class-transformer |
| 설정 관리 | `@nestjs/config` (.env) |
| 모니터링 | NestJS Observe (트레이스·로그·에러) |
| 테스트 | Vitest, Supertest |
| 코드 품질 | oxlint, Prettier |

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 파일 생성
cp .env.example .env

# 3. 개발 서버 실행
npm run start:dev
```

실행 후 아래 주소로 접속할 수 있습니다.

- API 서버: http://localhost:3000/api
- API 문서(Swagger): http://localhost:3000/docs

### 환경변수

| 이름 | 설명 | 기본값 |
|---|---|---|
| `PORT` | 서버 포트 | `3000` |
| `CORS_ORIGIN` | 허용할 프론트엔드 주소 (콤마로 여러 개) | 비워두면 전체 허용 |

## 프로젝트 구조

```
src/
├── main.ts          # 앱 시작점: 전역 설정, Swagger, CORS
├── app.module.ts    # 루트 모듈: 기능 모듈을 등록
└── <기능>/          # 기능별 모듈 (controller · service · dto · 테스트)
test/                # e2e 테스트
docs/                # 개발 지침 문서
```

## 주요 설계

- **API 경로 통일**: 모든 API는 `/api` 접두사로 시작합니다.
- **요청 검증**: 모든 요청 바디는 DTO로 검증하고, 정의되지 않은 필드가 들어오면 400 에러로 거부합니다.
- **API 문서 자동화**: 코드에서 Swagger 문서를 자동 생성하며, JWT(Bearer) 인증을 지원합니다.
- **기능별 모듈 분리**: 기능마다 독립된 모듈로 나눠 팀원 간 작업 충돌을 줄였습니다.
- **모니터링**: 요청 추적, 로그, 에러를 NestJS Observe로 수집할 수 있도록 구성했습니다.

## 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run start:dev` | 개발 서버 (코드 변경 시 자동 재시작) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start:prod` | 빌드 결과 실행 |
| `npm test` | 단위 테스트 |
| `npm run test:e2e` | e2e 테스트 |
| `npm run test:cov` | 테스트 커버리지 |
| `npm run lint` | 린트 검사 |
| `npm run format` | 코드 포맷팅 |

## 팀

| 이름 | 역할 | GitHub |
|---|---|---|
| <!-- TODO --> | | |
