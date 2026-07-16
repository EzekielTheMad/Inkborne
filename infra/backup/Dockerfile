# Inkborne backup runner.
#
# Base on the official postgres:15 image so pg_dump matches Supabase's
# Postgres major version. Add restic + rclone + cron + tini on top.

FROM postgres:17-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        restic \
        rclone \
        cron \
        curl \
        ca-certificates \
        jq \
        tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts/ /app/scripts/
COPY crontab /app/crontab

RUN chmod +x /app/scripts/*.sh \
    && touch /var/log/inkborne-backup.log \
    && chmod 644 /var/log/inkborne-backup.log

# tini reaps zombies and forwards signals so docker stop is graceful.
ENTRYPOINT ["/usr/bin/tini", "--", "/app/scripts/entrypoint.sh"]
