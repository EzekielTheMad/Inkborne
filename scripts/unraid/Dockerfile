FROM mcr.microsoft.com/playwright:v1.61.1-noble
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072
CMD ["node", "--import", "tsx", "scripts/unraid/run.mjs"]
