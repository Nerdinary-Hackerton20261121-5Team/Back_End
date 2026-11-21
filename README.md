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
├── health/          # GET /api/health (배포 probe·헬스체크)
└── <기능>/          # 기능별 모듈 (controller · service · dto · 테스트)
test/                # e2e 테스트
docs/                # 개발 지침 문서
Dockerfile           # 운영 이미지 (포트 3000)
.github/workflows/   # ci.yml (PR 검증) · deploy.yml (main 머지 시 자동 배포)
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

## 배포

`main`에 머지하면 홈서버 k3s(GitOps)에 자동 배포됩니다. 서버에 직접 접속하거나 손으로 올릴 일은 없습니다.

### 주소

| 용도 | 주소 |
|---|---|
| 서비스 | https://cmc-11th.bemelon.me |
| API | https://cmc-11th.bemelon.me/api |
| 헬스체크 | https://cmc-11th.bemelon.me/api/health → 200 `{"status":"ok","commit":"<배포된 커밋 sha>"}` |

게이트웨이가 `/api/*`는 경로 그대로 이 서버(컨테이너 포트 3000)로, 나머지는 프론트로 보냅니다.
그래서 `main.ts`의 `setGlobalPrefix('api')`를 지우면 안 됩니다. 파드의 probe도 `/api/health`를 씁니다.
`commit` 값으로 지금 떠 있는 빌드가 어느 커밋인지 확인할 수 있습니다.

### 배포 흐름

```
main 머지 ─▶ GitHub Actions (.github/workflows/deploy.yml)
              ├─ build: Docker 이미지(linux/amd64) → registry.bemelon.me/cmc-11th/back_end:<커밋 sha>
              └─ deploy: cluster-config 레포의 이미지 태그를 그 sha로 바꿔 커밋 "deploy(be): <image>"
                          └─ Argo CD가 변경을 감지해 롤링 업데이트
```

머지부터 반영까지 보통 1~3분 걸립니다. Actions 탭의 `Deploy` 실행이 초록이면 cluster-config에 커밋된 것이고,
이후 Argo CD가 반영하는 시간이 더해집니다. 수동으로 다시 돌리려면 Actions → `Deploy` → Run workflow에서 **`main` 브랜치만** 고르세요.
다른 브랜치를 고르면 build·deploy job이 건너뛰어져 아무것도 배포되지 않습니다.

- PR에서는 `CI`(lint·build·test)만 돌고 배포는 일어나지 않습니다.
- 홈서버가 amd64라 이미지는 항상 `linux/amd64`로 빌드합니다. Apple Silicon에서 직접 빌드한 이미지를 올리지 마세요.
- 이미지는 운영자의 사설 레지스트리 `registry.bemelon.me`(Zot)에 올라갑니다. CI 계정 `cmc-11th-ci`는 `cmc-11th/*` 저장소에만 push할 수 있고, 클러스터는 운영자 계정으로 받아 갑니다. 레이어 하나가 100MB를 넘으면 push가 `413`으로 실패하니(Cloudflare 한도) 큰 파일을 이미지에 넣지 마세요.
- 배포 대상 설정은 [cluster-config](https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config) 레포에 있습니다. 필요한 레포 secret은 `ZOT_USERNAME`·`ZOT_PASSWORD`(레지스트리)와 `CLUSTER_CONFIG_DEPLOY_KEY`(cluster-config 쓰기)이며 운영자가 등록합니다.

### 롤백

배포는 cluster-config의 커밋 하나입니다. 문제가 생기면 그 커밋을 되돌립니다(force push 금지).

```bash
git clone https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config && cd cluster-config
git log --oneline -- apps/be          # 되돌릴 "deploy(be): ..." 커밋 찾기
git revert <sha> && git push origin main
```

되돌린 커밋도 Argo CD가 똑같이 롤링 업데이트로 반영합니다. 이 레포의 코드는 별도 PR로 고칩니다.

### 운영 환경변수 (DB 포함)

운영에서는 클러스터가 환경변수를 주입합니다(`cluster-config`의 `apps/be`). `.env`나 GitHub Secrets에 따로 넣지 않습니다.
MySQL은 클러스터 안에서만 접속할 수 있고 인터넷·로컬 PC에서는 닿지 않습니다.

| 이름 | 운영 값 |
|---|---|
| `PORT` | `3000` |
| `DB_HOST` / `DB_PORT` | `mysql` / `3306` |
| `DB_USERNAME` / `DB_DATABASE` | `app` / `app` |
| `DB_PASSWORD` | cluster-config의 `apps/be/secret.yaml` 참고 |
| `DB_LOGGING` | `false` |
| `CORS_ORIGIN` | `https://cmc-11th.bemelon.me` |
| `GIT_SHA` | 이미지 빌드 때 주입되는 커밋 sha (`/api/health`에 표시) |

변수를 더하거나 바꾸려면 cluster-config의 `apps/be/secret.yaml`을 고치는 PR이 필요합니다.
Secret만 바뀌면 파드가 자동으로 재시작되지 않고 다음 배포 때 반영됩니다.

> 현재 앱 코드에는 DB 연결이 없어서 위 `DB_*` 변수는 읽지 않습니다. DB 연결 코드가 들어오면 이 이름을 그대로 쓰면 됩니다.
> 마이그레이션 실행도 아직 없고, DB 연결(#3) 이후 별도로 정합니다. 현재 배포는 마이그레이션 없이 이미지만 교체합니다.

## 팀

| 이름 | 역할 | GitHub |
|---|---|---|
| <!-- TODO --> | | |
