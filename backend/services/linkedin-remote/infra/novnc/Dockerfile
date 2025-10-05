FROM debian:stable

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates supervisor xvfb x11vnc fluxbox \
  novnc websockify curl unzip \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && apt-get install -y google-chrome-stable && rm -rf /var/lib/apt/lists/*

# User
RUN useradd -m chrome
USER chrome
WORKDIR /home/chrome

# noVNC assets
ENV DISPLAY=:99
ENV SCREEN_GEOMETRY=1366x768x24
ENV USER_DATA_DIR=/home/chrome/user-data-dir

# Files
USER root
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER chrome

EXPOSE 8080 9222
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=10 \
  CMD curl -fsS http://localhost:8080/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]


