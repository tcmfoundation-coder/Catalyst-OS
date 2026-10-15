FROM node:22-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv build-essential libgomp1 \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

COPY processor/requirements-runtime.txt ./processor/requirements-runtime.txt
RUN python3 -m venv /opt/processor-venv \
  && /opt/processor-venv/bin/pip install --no-cache-dir -r processor/requirements-runtime.txt

FROM deps AS builder

COPY . .
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=build-only-not-a-runtime-secret
RUN npm run build

FROM base AS prod-deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PROCESSOR_PYTHON_BIN=/opt/processor-venv/bin/python3
ENV VECTOR_INDEX_DIR=/data/vector-index
ENV EMBEDDING_MODEL_CACHE_DIR=/data/embedding-models

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 libgomp1 libstdc++6 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/processor/ ./processor/
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=prod-deps --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nextjs:nodejs /opt/processor-venv /opt/processor-venv
RUN mkdir -p /data/vector-index /data/embedding-models \
  && chown -R nextjs:nodejs /data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./node_modules/.bin/next", "start"]
