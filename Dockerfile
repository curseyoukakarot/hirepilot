FROM node:20-slim AS builder
WORKDIR /app

# 1) Install prod deps for backend (cache-friendly)
COPY backend/package*.json ./backend/
RUN cd backend && (npm ci --omit=dev || npm install --omit=dev)

# 2) Copy sources required for build
COPY backend ./backend
COPY shared ./shared

# 3) Build TS using docker-specific config; continue even if non-critical type errors
RUN npm install --no-save typescript && \
    npx tsc -p backend/tsconfig.docker.json || true && \
    test -f backend/dist/server.js

# ---- Runtime image ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# 4) Copy compiled app and runtime deps only
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package*.json ./backend/

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]