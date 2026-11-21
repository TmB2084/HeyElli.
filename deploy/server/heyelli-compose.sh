#!/bin/bash
# Admin-Wrapper für Compose-Befehle der HeyElli-Instanzen auf ELOMHWEB12.
# Installation durch die IT: /usr/local/sbin/heyelli-compose.sh (root:root, 0755). Nur als root (Admin) benutzen.
#
#   heyelli-compose.sh <test|prod> <compose-Befehl ...>
#   Beispiele:  heyelli-compose.sh prod ps
#               heyelli-compose.sh test logs --tail 100 -f app
#               heyelli-compose.sh prod exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > dump.dump
#
# Setzt dieselben festen Pfade, das Compose-Projekt und die --env-file-Reihenfolge (.env, .env.tag) wie das Deploy-Skript,
# damit manuelle Befehle nicht an der fehlenden HEYELLI_TAG-Variable scheitern.
# "config" ohne --quiet, --images oder --services wird abgelehnt, weil es die .env-Werte ausgeben würde.

set -euo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
umask 077
for v in $(compgen -e); do
    case "$v" in
        COMPOSE_* | HEYELLI_* | DOCKER_*) unset "$v" ;;
    esac
done
export DOCKER_CONFIG=/root/.docker-heyelli

[ "$(id -u)" -eq 0 ] || { echo "Nur als root ausführen." >&2; exit 2; }
[ "$#" -ge 2 ] || { echo "Aufruf: $0 <test|prod> <compose-Befehl ...>" >&2; exit 2; }

case "$1" in
    test) DIR=/opt/heyelli-test; PROJEKT=heyelli-test ;;
    prod) DIR=/opt/heyelli-prod; PROJEKT=heyelli-prod ;;
    *) echo "Umgebung muss test oder prod sein." >&2; exit 2 ;;
esac
shift

if [ "$1" = "config" ]; then
    case " $* " in
        *" --quiet "* | *" -q "* | *" --images "* | *" --services "*) ;;
        *) echo "config ohne --quiet/--images/--services würde Werte aus .env ausgeben und wird abgelehnt." >&2; exit 2 ;;
    esac
fi

cd "$DIR" 2> /dev/null || { echo "Verzeichnis $DIR fehlt." >&2; exit 1; }
[ -f .env.tag ] || { echo "$DIR/.env.tag fehlt (Erstbefüllung, siehe docs/ci-deploy.md)." >&2; exit 1; }
exec docker compose -p "$PROJEKT" --env-file .env --env-file .env.tag -f compose.yaml "$@"
