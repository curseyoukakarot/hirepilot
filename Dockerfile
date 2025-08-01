# Use a Debian-based Node image (glibc-compatible, avoids Alpine issues)
FROM node:20-bookworm-slim

# Install Playwright system dependencies (equivalent to --with-deps)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Debug: List files in build context root
RUN ls -la /tmp || echo "No /tmp" && ls -la / || echo "No root access"

# Add files to check context
ADD . /tmp/build-context
RUN ls -la /tmp/build-context

# Copy package.json and install deps (including Playwright)
COPY backend/package*.json ./
RUN npm ci --production

# Install Chromium browser explicitly during build
RUN npx playwright install chromium

# Copy all backend files
COPY backend/ ./

# Build the TypeScript application
RUN npm run build:production

# Expose port for Railway
EXPOSE 3000

# Start command
CMD ["npm", "start"]