# Production Multi-Stage Dockerfile for BarberLoo Node.js Backend
# Website: https://barberloo.in
# Supports: Cloud Run, Render, Railway, Fly.io, AWS ECS, DigitalOcean, VPS

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend assets for static serving / WP Pusher bundle sync
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy built application and required assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/wp-assets ./wp-assets
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["tsx", "server.ts"]
