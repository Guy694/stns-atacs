# syntax=docker/dockerfile:1.7
# ATACS (Next.js) production image: standalone server, non-root user.
# Build:  docker compose build app

ARG NODE_IMAGE=node:22-bookworm-slim

# ── 1) Install dependencies (cached while package-lock.json is unchanged) ──
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ── 2) Build ──
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Public URL baked into the client bundle (agent install commands). Example: https://atacs.example.go.th
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3) Runtime ──
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Bangkok

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && apt-get update && apt-get install -y --no-install-recommends curl tzdata \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Maintenance scripts (check-database, migrate) and SQL files, runnable with `docker compose exec app ...`
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# SEC-05: ไฟล์ seed/ดัมป์ถูกกันไว้ใน .dockerignore แล้ว image จึงมีเฉพาะสคริปต์ migration
COPY --from=builder --chown=nextjs:nodejs /app/database ./database

# Uploaded asset photos (UPLOAD_DIR) live outside public/ and are served only to signed-in users.
ENV UPLOAD_DIR=/app/storage/uploads
RUN mkdir -p /app/storage/uploads/assets && chown -R nextjs:nodejs /app/storage
VOLUME ["/app/storage/uploads"]

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
