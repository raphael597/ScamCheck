# syntax=docker/dockerfile:1.7

# ── 1. Build frontend and backend ──────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY server server
COPY web web
RUN npm run build && npm test

# ── 2. Production dependencies only ────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace server --include-workspace-root --no-audit --no-fund

# ── 3. Runtime ─────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist \
    PROMPTS_DIR=/app/server/prompts
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=deps --chown=node:node /app/node_modules node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server/package.json server/
COPY --from=build --chown=node:node /app/server/dist server/dist
COPY --chown=node:node server/prompts server/prompts
COPY --from=build --chown=node:node /app/web/dist web/dist

USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
# The server handles SIGTERM itself; use `docker run --init` / `init: true` if you want an init process.
CMD ["node", "server/dist/index.js"]

LABEL org.opencontainers.image.title="ScamCheck" \
      org.opencontainers.image.description="Prüft verdächtige Anzeigen, Nachrichten und Beiträge auf Betrug" \
      org.opencontainers.image.source="https://github.com/raphael597/scamcheck"
