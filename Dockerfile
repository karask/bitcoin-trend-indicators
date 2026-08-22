FROM node:22-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    REGIME_DB=/data/regimes.duckdb \
    REGIME_SQLITE=/data/bitcoin-regime.sqlite

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
    && python3 -m pip install --break-system-packages ./backend

VOLUME ["/data"]
EXPOSE 3000 8000
CMD ["sh", "backend/run-container.sh"]
