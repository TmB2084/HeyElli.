# HeyElli als Produktions-Build (next start), Mehrstufig. Gebaut wird in der Pipeline, nicht auf dem Server.
# Laufzeit: Node 24 (siehe .node-version) führt die Hintergrunddienste direkt aus src/*.ts aus (Type-Stripping),
# deshalb enthält das Laufzeit-Image src/, scripts/ und database/ zusätzlich zu .next.
ARG NODE_IMAGE=node:24.11.1-trixie-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .node-version ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build \
 && npm prune --omit=dev --no-fund --no-audit

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HEYELLI_SERVER_BETRIEB=1 \
    PORT=3000
WORKDIR /app
# Nicht-root-Benutzer mit fester UID/GID; state (Einstellungen, Schlüssel), .local (Laufzeitdateien) und .next/cache sind Volumes bzw. tmpfs
RUN groupadd --system --gid 10002 heyelli \
 && useradd --system --uid 10002 --gid 10002 --home-dir /app --shell /usr/sbin/nologin heyelli \
 && mkdir -p /app/.local /app/state /app/.next/cache \
 && chown -R heyelli:heyelli /app
COPY --from=build --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/.next ./.next
COPY --from=build --chown=root:root /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=root:root /app/src ./src
COPY --from=build --chown=root:root /app/scripts ./scripts
COPY --from=build --chown=root:root /app/database ./database
COPY --from=build --chown=root:root /app/public ./public
USER heyelli
EXPOSE 3000
VOLUME ["/app/state", "/app/.local"]
# Nur Port-Prüfung: Jede Seite außer der Anmeldung verlangt eine Sitzung.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "-e", "require('net').connect(3000,'127.0.0.1').once('connect',()=>process.exit(0)).once('error',()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
