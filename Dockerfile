FROM node:20-slim
WORKDIR /app

# Install backend production deps and minimal TypeScript runtime
COPY backend/package*.json ./backend/
RUN cd backend && (npm ci --omit=dev || npm install --omit=dev) && npm install --no-save ts-node typescript

# Copy sources
COPY backend ./backend
COPY shared ./shared

ENV NODE_ENV=production
EXPOSE 8080

# Start with ts-node (avoids compile step and unblocks deploy)
CMD ["node", "-r", "ts-node/register", "backend/server.ts"]