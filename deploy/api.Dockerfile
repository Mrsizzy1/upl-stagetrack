# API UPL StageTrack — image de production.
# Construction depuis la racine du dépôt :  docker build -f deploy/api.Dockerfile -t upl-stagetrack-api .
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --include-workspace-root
COPY backend backend
RUN npx --workspace backend prisma generate \
 && npm run build --workspace backend \
 && npm prune --omit=dev --workspace backend --include-workspace-root

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home /app stagetrack
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=stagetrack /app/node_modules ./node_modules
COPY --from=build --chown=stagetrack /app/backend/package.json ./backend/package.json
COPY --from=build --chown=stagetrack /app/backend/dist ./backend/dist
COPY --from=build --chown=stagetrack /app/backend/prisma ./backend/prisma
# Logo officiel UPL (fichier unique du dépôt) : en-tête des PDF et des exports Excel.
COPY --chown=stagetrack frontend/public/brand/upl-logo.png ./frontend/public/brand/upl-logo.png
RUN mkdir -p /app/backend/storage && chown stagetrack /app/backend/storage
USER stagetrack
WORKDIR /app/backend
EXPOSE 3000
# Les migrations sont appliquées à chaque démarrage (idempotent), puis l'API démarre.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
