# Inkborne backup runner.
#
# Base on the official Postgres 17 image so pg_dump matches the hosted
# Inkborne database major version. Add restic + rclone + cron + tini on top.

FROM postgres:17-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        restic \
        rclone \
        cron \
        logrotate \
        util-linux \
        curl \
        ca-certificates \
        jq \
        tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts/ /app/scripts/
COPY crontab /app/crontab
COPY logrotate.conf /etc/logrotate.d/inkborne-backup

RUN chmod +x /app/scripts/*.sh \
    && chmod 644 /etc/logrotate.d/inkborne-backup \
    && mkdir -p /backup-staging /run/lock \
    && chmod 700 /backup-staging \
    && touch /var/log/inkborne-backup.log \
    && chmod 644 /var/log/inkborne-backup.log

# tini reaps zombies and forwards signals so docker stop is graceful.
ENTRYPOINT ["/usr/bin/tini", "--", "/app/scripts/entrypoint.sh"]
