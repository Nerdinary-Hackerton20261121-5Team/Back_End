# syntax=docker/dockerfile:1

# ---- build: 의존성 설치 + TypeScript 빌드 ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: 운영 의존성 + 빌드 결과만 ----
FROM node:24-alpine AS runtime
WORKDIR /app
# 배포된 커밋 sha. /api/health 응답에 실려 어떤 빌드가 떠 있는지 확인할 수 있다.
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    GIT_SHA=$GIT_SHA
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
