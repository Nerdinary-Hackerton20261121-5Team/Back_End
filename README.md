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

## API 명세

Swagger에서 요청·응답 예시를 보고 바로 호출할 수 있습니다.

- 로컬: http://localhost:3000/docs
- dev: https://cmc-11th-dev.bemelon.me/docs
- 운영: https://cmc-11th.bemelon.me/docs

**공통 응답 형식**

```json
{ "success": true,  "code": "SUCCESS",       "message": "요청이 성공했습니다.", "data": { } }
{ "success": false, "code": "INVALID_INPUT", "message": "요청 값이 올바르지 않습니다. (...)", "data": null }
```

| HTTP | code | 언제 |
|---|---|---|
| 200 / 201 | `SUCCESS` | 조회·수정 성공 / 생성 성공 |
| 400 | `INVALID_INPUT` | 필수 값 누락, 잘못된 형식, 정의되지 않은 필드, 깨진 JSON |
| 404 | `NOT_FOUND` 또는 기능별 코드 | 없는 경로, 없는 대상 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 (내부 메시지는 노출하지 않음) |

참가자 토큰이 필요한 API는 `X-Participant-Token` 헤더를 씁니다. Swagger에서는 **Authorize** 버튼에 토큰을 넣으면 됩니다.

### API 목록

| 메서드 | 경로 | 설명 | 토큰 | 성공 | 실패 |
|---|---|---|---|---|---|
| GET | `/api/health` | 서버 상태·배포 커밋 확인 (공통 형식으로 감싸지 않음) | - | 200 | - |
| POST | `/api/images` | 이미지 업로드 (multipart, 필드명 `file`). 저장소 key와 보여주기용·썸네일 주소 반환 | - | 201 | 400 |
| POST | `/api/sessions` | 방 만들기 (목표 시간·정원 4~6명). 세션 코드와 개설자 `participantToken` 발급. 같은 `clientRequestId` 재전송은 기존 방 반환 | - | 201 | 400 |
| POST | `/api/sessions/join` | 세션 코드로 입장. 참가자 `participantToken` 발급 | - | 201 | 400, 404, 409(시작됨·정원 참) |
| GET | `/api/sessions/{sessionId}` | 세션 조회 (단계·남은 시간·인원·내 정보·명단 `participants`, `serverNow`) | O | 200 | 400, 401, 403, 404 |
| PATCH | `/api/sessions/{sessionId}/participants/me` | 닉네임 설정 `{ nickname }` (1~20자). 링크로 입장한 뒤 "참여하기"에서 호출. 명단은 세션 조회 `participants`(입장 순서·닉네임·방장 여부) | O | 200 | 400, 401, 403, 404 |
| DELETE | `/api/sessions/{sessionId}/participants/me` | 대기실 나가기 (시작 전). 내 참가자 정보 삭제 → 토큰 무효·자리 비움. 방장이 나가면 다음 입장 순서가 방장, 마지막 한 명이면 방 삭제 | O | 200 | 400, 401, 403(다른 세션), 404, 409(시작됨) |
| POST | `/api/sessions/{sessionId}/start` | 세션 시작 (개설자, **최소 4명**). 명단 고정, 시작·종료 시각 확정, 원조각(한 행 2명)·조립 조각(원조각당 4개) 생성. 다시 보내면 처음 결과 반환 | O | 200 | 400(인원 부족 포함), 401, 403, 404 |
| POST | `/api/sessions/{sessionId}/end` | 공부 조기 종료 (방장). 종료 시각을 지금으로 당겨 모두 조립 단계로. 복원도는 원래 목표 기준. 재전송은 처음 결과 | O | 200 | 400, 401, 403, 404, 409(시작 전) |
| POST | `/api/sessions/{sessionId}/heartbeat` | 연결 확인·상태 보고 `{ state?: FOCUSING \| PAUSED \| AWAY }` (주기적으로 + 상태가 바뀔 때 바로). 직전 상태가 `FOCUSING`(얼굴 인식)인 구간만 누적, 일시정지·얼굴 미인식·끊김(기본 90초) 구간은 제외. 복원도 = 누적 집중 시간 / 목표 시간 | O | 200 | 400, 401, 403, 404 |
| GET | `/api/sessions/{sessionId}/board` | 진행판 (조각 위치·모양·모두의 복원도, 함께 하는 사람 명단 `members`: 상태 `FOCUSING\|PAUSED\|AWAY\|DISCONNECTED`·누적 집중 시간). 남의 조각 이미지는 복원도에 따라 블러 | O | 200 | 400, 401, 403, 404 |
| GET | `/api/sessions/{sessionId}/result` | 공부 결과 (공부 시간 종료 후). 참가자별 누적 집중 시간·집중 못 한 시간·최종 복원도·부재 여부, 팀 평균 복원도 | O | 200 | 400, 401, 403, 404, 409(공부 중) |
| GET | `/api/sessions/{sessionId}/assembly` | 조립판 조회. 집중 종료 후 첫 호출에 조립을 열고(최종 복원도 확정, 부재자 조각 자동 배치), 칸 배치(`slots`)·조각 목록 반환. 놓이기 전 정답 위치는 숨김 | O | 200 | 400, 401, 403, 404, 409(집중 중) |
| PATCH | `/api/sessions/{sessionId}/assembly/pieces/{pieceId}` | 조각 놓기 `{ targetPosition }`. 자기 조각만, 정답 칸이면 저장(`correct: true`), 틀린·찬 칸이면 저장 안 함(직전 위치로 복귀). 모두 놓이면 팀 통과(`COMPLETED`) | O | 200 | 400, 401, 403, 404, 409 |
| DELETE | `/api/sessions/{sessionId}` | 방 종료·폐기 (개설자). 세션·참가자·조각 전부 삭제, 이후 토큰 무효 | O | 200 | 400, 401, 403, 404 |

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
.github/workflows/   # ci.yml (PR 검증) · deploy.yml (dev·main 머지 시 자동 배포)
```

## 주요 설계

- **API 경로 통일**: 모든 API는 `/api` 접두사로 시작합니다.
- **요청 검증**: 모든 요청 바디는 DTO로 검증하고, 정의되지 않은 필드가 들어오면 400 에러로 거부합니다.
- **API 문서 자동화**: 코드에서 Swagger 문서를 자동 생성하며, JWT(Bearer) 인증을 지원합니다.
- **기능별 모듈 분리**: 기능마다 독립된 모듈로 나눠 팀원 간 작업 충돌을 줄였습니다.

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

## 배포·운영 한눈에 보기

Back_End · Frontend · cluster-config 세 레포 README가 같은 표를 쓴다.

인프라 전체 구성: https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config/blob/main/docs/INFRA.md

| 항목 | 내용 |
|---|---|
| 서버 주소 | **dev** https://cmc-11th-dev.bemelon.me · **운영** https://cmc-11th.bemelon.me. 두 주소 모두 `/api/*`·`/docs*`는 BE로, 나머지는 FE로 가므로 FE와 API가 같은 origin이다 |
| API · 문서 · 버전 확인 | `<주소>/api` · Swagger `<주소>/docs`(dev·운영 둘 다 열린다) · `<주소>/api/health` → 200 `{"status":"ok","commit":"<배포된 커밋 sha>"}`. `commit`으로 그 서버에 떠 있는 빌드를 확인한다 |
| 브랜치 흐름 | 기능 브랜치 → PR(권장, base `dev`) → `dev` 머지 = dev 서버 배포 → dev에서 확인 → `dev`→`main` PR로 승격 → `main` 머지 = 운영 배포. Back_End·Frontend의 기본 브랜치는 `dev`이고, `dev`·`main` 모두 PR 승인은 필요 없다. 보호 규칙은 force push·브랜치 삭제 금지뿐이다. cluster-config는 `main`에 직접 push한다 |
| 배포 | 앱 레포(Back_End·Frontend)에 push(머지)되면 GitHub Actions `Deploy`가 이미지 `registry.bemelon.me/cmc-11th/back_end:<커밋 sha>`(BE) 또는 `.../frontend:<커밋 sha>`(FE)를 올리고 [cluster-config](https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config)에 커밋한다. `dev` push → `apps/be-dev`·`apps/fe-dev`에 `deploy(be-dev)`·`deploy(fe-dev)`, `main` push → `apps/be`·`apps/fe`에 `deploy(be)`·`deploy(fe)`. 그 뒤 Argo CD가 자동 반영한다(보통 1~3분). 배포는 머지로만 일어나고 서버에 직접 올리는 일은 없다 |
| 롤백 | cluster-config에서 해당 `deploy(...)` 커밋을 `git revert` 후 push (force push 금지). 앱 코드는 별도 PR로 고친다 |
| 상태·로그 | Argo CD https://cmc-11th-argocd.bemelon.me · 계정 `cmc-11th` · 비밀번호는 운영자에게. 앱 6개(`cmc-11th-be`·`-fe`·`-be-dev`·`-fe-dev`·`-gateway`·`-mysql`)의 상태 조회·SYNC·파드 로그만 가능하다 |
| DB | 같은 MySQL 8.4 서버에 DB가 둘이다. 운영은 사용자 `app` · DB `app`, dev는 사용자 `app_dev` · DB `app_dev`이며 서로의 DB에는 접근할 수 없다. 클러스터 안에서는 `mysql:3306`이고 BE 파드(`be`·`be-dev`)에 `DB_HOST` 등이 주입된다. 비밀번호는 운영자에게. root는 외부 접속 불가. 노트북에서는 [DB 외부 접속](#db-외부-접속) |
| CORS | BE `CORS_ORIGIN`: 운영 `be`는 `https://cmc-11th.bemelon.me`, `be-dev`는 `https://cmc-11th-dev.bemelon.me`. FE는 같은 origin이라 CORS 없이 상대 경로 `/api/...`를 부른다 |
| 마이그레이션 | TypeORM `synchronize: false`라 스키마는 마이그레이션으로만 바뀐다. 마이그레이션은 앱 시작 때 자동 실행되지 않고 `npm run migration:run`으로 직접 돌린다(DB 연결 코드 Back_End PR #3이 머지된 뒤부터). 배포는 이미지만 교체한다 |

### DB 외부 접속

노트북의 MySQL 클라이언트(DBeaver·DataGrip·`mysql` CLI)로 DB에 붙는 방법은 두 가지다. 운영 DB는 사용자 `app` · 데이터베이스 `app`, dev DB는 사용자 `app_dev` · 데이터베이스 `app_dev`이고(아래 예시는 dev, 운영은 `app`으로 바꾼다), 비밀번호는 운영자에게 받는다. 비밀번호는 `.env` 같은 로컬 파일에만 두고 레포·이슈·PR·공개 채팅에 쓰지 않는다(이 주소는 인터넷에 열려 있고 보호막은 비밀번호뿐이다. 새어 나가면 바로 운영자에게 알린다). 백업이 없으니 `DROP`·대량 `DELETE` 전에 한 번 더 확인한다. 해커톤이 끝나면 닫힌다.

1. **cloudflared** (누구나, 비밀번호만 있으면 된다). 설치는 macOS `brew install cloudflared`, Windows `winget install --id Cloudflare.cloudflared`. 터미널 하나를 켜 둔 채로 쓴다.

   ```sh
   cloudflared access tcp --hostname cmc-11th-db.bemelon.me --url 127.0.0.1:13306
   mysql -h 127.0.0.1 -P 13306 -u app_dev -p app_dev    # 다른 터미널에서
   ```

2. **Tailscale** (운영자가 `bemelon` 노드를 공유한 사람만). Tailscale 앱을 켠 상태(tailnet 안)에서만 열리고 cloudflared 없이 바로 접속한다. 이름이 안 풀리면 호스트에 `100.105.208.85`를 쓴다.

   ```sh
   mysql -h bemelon.tailc71c61.ts.net -P 30306 -u app_dev -p app_dev
   ```

## 배포 상세 (Back_End)

`dev`에 머지하면 dev 서버(https://cmc-11th-dev.bemelon.me)에, `main`에 머지하면 운영(https://cmc-11th.bemelon.me)에 홈서버 k3s(GitOps)로 자동 배포됩니다. 서버에 직접 접속하거나 손으로 올릴 일은 없습니다.

게이트웨이가 두 주소 모두 `/api/*`와 `/docs*`(Swagger)를 경로 그대로 이 서버(컨테이너 포트 3000)로, 나머지는 프론트로 보냅니다.
그래서 `main.ts`의 `setGlobalPrefix('api')`를 지우면 안 됩니다. 파드의 probe도 `/api/health`를 씁니다.
`commit` 값으로 그 서버에 지금 떠 있는 빌드가 어느 커밋인지 확인할 수 있습니다.

> **Swagger**: 앱의 `/docs`가 dev(https://cmc-11th-dev.bemelon.me/docs)와 운영(https://cmc-11th.bemelon.me/docs) 공개 주소에서 그대로 열립니다.
> 로컬에서는 `http://localhost:3000/docs`입니다.

### 배포 흐름

```
dev 머지  ─▶ GitHub Actions (.github/workflows/deploy.yml)
main 머지 ─▶   ├─ build: Docker 이미지(linux/amd64) → registry.bemelon.me/cmc-11th/back_end:<커밋 sha>
                └─ deploy: cluster-config 레포의 이미지 태그를 그 sha로 바꿔 커밋
                            ├─ dev  → "deploy(be-dev): <image>" (apps/be-dev) → Argo CD가 dev 서버에 롤링 업데이트
                            └─ main → "deploy(be): <image>"     (apps/be)     → Argo CD가 운영에 롤링 업데이트
```

머지부터 반영까지 보통 1~3분 걸립니다. Actions 탭의 `Deploy` 실행이 초록이면 cluster-config에 커밋된 것이고,
이후 Argo CD가 반영하는 시간이 더해집니다. dev와 main 배포는 서로 막지 않습니다. 수동으로 다시 돌리려면 Actions → `Deploy` → Run workflow에서 **`dev` 또는 `main` 브랜치만** 고르세요.
다른 브랜치를 고르면 build·deploy job이 건너뛰어져 아무것도 배포되지 않습니다.

- PR에서는 `CI`(lint·build·test)만 돌고 배포는 일어나지 않습니다.
- 운영 반영은 dev에서 확인한 뒤 `dev`→`main` PR을 머지하는 것뿐입니다. 이 PR에는 `dev`에만 있는 커밋이 모두 실리니 머지 전에 커밋 목록을 확인하세요.
- 홈서버가 amd64라 이미지는 항상 `linux/amd64`로 빌드합니다. Apple Silicon에서 직접 빌드한 이미지를 올리지 마세요.
- 이미지는 운영자의 사설 레지스트리 `registry.bemelon.me`(Zot)에 올라갑니다. CI 계정 `cmc-11th-ci`는 `cmc-11th/*` 저장소에만 push할 수 있고, 클러스터는 운영자 계정으로 받아 갑니다. 레이어 하나가 100MB를 넘으면 push가 `413`으로 실패하니(Cloudflare 한도) 큰 파일을 이미지에 넣지 마세요.
- 배포 대상 설정은 [cluster-config](https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config) 레포에 있습니다. 필요한 레포 secret은 `ZOT_USERNAME`·`ZOT_PASSWORD`(레지스트리)와 `CLUSTER_CONFIG_DEPLOY_KEY`(cluster-config 쓰기)이며 운영자가 등록합니다.

### 롤백

배포는 cluster-config의 커밋 하나입니다. 문제가 생기면 그 커밋을 되돌립니다(force push 금지).

```bash
git clone https://github.com/Nerdinary-Hackerton20261121-5Team/cluster-config && cd cluster-config
git log --oneline -- apps/be apps/be-dev   # 되돌릴 "deploy(be): ..."(운영) 또는 "deploy(be-dev): ..."(dev) 커밋 찾기
git revert <sha> && git push origin main
```

되돌린 커밋도 Argo CD가 똑같이 롤링 업데이트로 반영합니다. 이 레포의 코드는 별도 PR로 고칩니다.

### 환경변수 (DB 포함)

운영과 dev 모두 클러스터가 환경변수를 주입합니다(`cluster-config`의 `apps/be`·`apps/be-dev`). `.env`나 GitHub Secrets에 따로 넣지 않습니다.
이 레포는 공개라서 비밀번호 같은 값은 코드·문서·PR 어디에도 쓰지 않고 변수 이름만 적습니다.

| 이름 | 운영 (`be`) | dev (`be-dev`) |
|---|---|---|
| `PORT` | `3000` | `3000` |
| `DB_HOST` / `DB_PORT` | `mysql` / `3306` | `mysql` / `3306` |
| `DB_USERNAME` / `DB_DATABASE` | `app` / `app` | `app_dev` / `app_dev` |
| `DB_PASSWORD` | 운영자가 클러스터 Secret(`be-db`)으로 주입 | 운영자가 클러스터 Secret(`be-dev-db`)으로 주입 |
| `DB_LOGGING` | `false` | `false` |
| `CORS_ORIGIN` | `https://cmc-11th.bemelon.me` | `https://cmc-11th-dev.bemelon.me` |
| `GIT_SHA` | 이미지 빌드 때 주입되는 커밋 sha (`/api/health`에 표시) | 같음 |

`DB_PASSWORD`는 레포에 없고 값은 운영자에게 받습니다. 변수를 더하거나 바꾸려면 cluster-config의 `apps/be/secret.yaml`(운영)·`apps/be-dev/secret.yaml`(dev)을 고치는 커밋이 필요합니다.
`be-env`·`be-dev-env` Secret만 바뀌면 파드가 자동으로 재시작되지 않고 다음 배포 때 반영됩니다. 급하면 운영자에게 재시작을 요청하세요.

> `dev` 브랜치에 DB 연결 코드(PR #3)가 머지되기 전까지는 위 `DB_*` 변수를 읽지 않습니다. 연결 코드는 이 이름을 그대로 읽습니다.
> TypeORM은 `synchronize: false`라 테이블은 마이그레이션으로만 만들어집니다. PR #3이 머지된 뒤 `npm run migration:run`으로 실행하며 앱 시작 때 자동으로 실행되지 않습니다.
> 현재 배포는 마이그레이션 없이 이미지만 교체합니다.
> 기여 규칙(브랜치·PR, 하면 안 되는 것)은 [AGENTS.md](AGENTS.md)에 있습니다.

## 팀

| 이름 | 역할 | GitHub |
|---|---|---|
| 황규도 | 백엔드 | <!-- TODO --> |
| 이건하 | 백엔드 | <!-- TODO --> |
