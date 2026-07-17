# 프론트(Ionic Vue) 배포용 이미지: 빌드 후 nginx 로 정적 서빙
FROM node:20-alpine AS build

WORKDIR /app

# 도커 환경에서는 같은 오리진의 nginx 가 /api 를 백엔드로 프록시하므로 상대경로 사용
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
