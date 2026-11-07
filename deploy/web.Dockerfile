# Interface + Nginx (HTTPS, proxy vers l'API).
# Construction depuis la racine du dépôt :  docker build -f deploy/web.Dockerfile -t upl-stagetrack-web .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend frontend
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80 443
