FROM mcr.microsoft.com/playwright:v1.44.1-focal

WORKDIR /app

# Install deps first (better caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --include=dev

# Browsers are preinstalled in the Playwright base image; keep this to ensure versions are present
RUN cd backend && npx playwright install chromium

# Copy app
COPY backend ./backend
COPY shared ./shared

# If your backend is TypeScript and needs build:
# RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080

# Adjust if your start script differs
WORKDIR /app/backend
CMD ["npm","run","start"]

