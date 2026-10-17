# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# nova-app — multi-stage Docker build
#
# Stage 1 (deps):    install production + dev dependencies from lock file
# Stage 2 (builder): compile the Next.js app with `next build`
# Stage 3 (runner):  minimal runtime image using Next.js standalone output
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine

# ── 1. deps ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps

# libc6-compat is needed by some native add-ons on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy manifests first so Docker layer-caches the install step
COPY package.json package-lock.json .npmrc ./

# Install ALL deps (dev included — needed by `next build`)
# RUN npm ci
RUN npm install --legacy-peer-deps

# ── 2. builder ───────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Bring in node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source
COPY . .

# Build-time env vars that Next.js bakes into the client bundle.
# Values are consumed from docker-compose / --build-arg; they must be set or
# the public Supabase client will fail to initialise at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Disable Next.js telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── 3. runner ────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user/group for the process
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Static assets
COPY --from=builder /app/public ./public

# `output: 'standalone'` (next.config.ts) produces a self-contained server
# plus a minimal node_modules tree. Copy both, plus the pre-rendered pages.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

# The seed script + data directory are useful for one-off container runs
COPY --from=builder /app/data    ./data
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `server.js` is emitted by Next.js standalone output
CMD ["node", "server.js"]
