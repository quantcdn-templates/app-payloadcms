# Build stage
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /build

# Copy package files (.npmrc is required for npm ci: legacy-peer-deps=true)
COPY package*.json .npmrc ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build without a database: static generation is deferred to runtime (ISR).
# PAYLOAD_SECRET is only needed to load the Payload config during the build;
# this placeholder is never used at runtime.
ENV PAYLOAD_SECRET=build-placeholder-do-not-use
RUN npm run build

# Production stage
FROM ghcr.io/quantcdn-templates/app-node:${NODE_VERSION}

WORKDIR /app

# Copy entrypoint scripts
COPY quant/entrypoints/ /quant-entrypoint.d/
RUN find /quant-entrypoint.d -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Copy standalone build output
COPY --from=builder --chown=node:node /build/.next/standalone ./
COPY --from=builder --chown=node:node /build/.next/static ./.next/static
COPY --from=builder --chown=node:node /build/public ./public

# CRITICAL: App port must be 3001 (proxy runs on 3000)
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
# Persistent media (EFS on Quant Cloud, named volume locally)
ENV MEDIA_DIR=/data/media

EXPOSE 3000

CMD ["node", "server.js"]
