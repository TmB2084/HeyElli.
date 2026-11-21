#!/bin/bash
# Deploy-Skript HeyElli für ELOMHWEB12.
# Installation durch die IT: /usr/local/sbin/heyelli-deploy.sh (root:root, 0755). Beschreibung: docs/ci-deploy.md
#
# Aufruf (nur über sudo vom Benutzer gitlab-deploy, Forced Command je Schlüssel):
#   heyelli-deploy.sh <test|prod> <Commit-Kurz-Hash>
# sudoers erlaubt nur:  ^test [0-9a-f]{7,40}$  bzw.  ^prod [0-9a-f]{7,40}$
#
# Ablauf: Instanz prüfen -> PostgreSQL sichern -> Tag setzen -> Image ziehen -> Compose-Datei gegen Image-Label prüfen
#         -> starten (Migration läuft als eigener Dienst) -> HTTPS-Prüfung -> bei Fehler automatischer Rollback.
# Der Server baut nichts und nutzt kein Git. Es werden nie .env-Inhalte oder die aufgelöste Compose-Konfiguration ausgegeben.
# Container-Logs erscheinen nur bei Fehlern (sie können personenbezogene Daten enthalten und landen sonst im Job-Log).
#
# Der Platzhalter 0000000 (Erstbefüllung von .env.tag) gilt NICHT als gültiges bisheriges Tag.
# Exit-Codes: 0 ok, 1 Deploy fehlgeschlagen (ggf. nach Rollback), 2 falscher Aufruf.

set -euo pipefail

# ---------------------------------------------------------------- feste Umgebung (nichts aus dem Aufrufer übernehmen)
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root
umask 077
for v in $(compgen -e); do
    case "$v" in
        COMPOSE_* | HEYELLI_* | DOCKER_*) unset "$v" ;;
    esac
done
export DOCKER_CONFIG=/root/.docker-heyelli   # Registry-Login mit Deploy-Token (read_registry)

PLATZHALTER=0000000
log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- Aufruf prüfen
[ "$#" -eq 2 ] || { echo "Aufruf: $0 <test|prod> <Commit-Hash>" >&2; exit 2; }
UMGEBUNG=$1
TAG=$2
[[ "$TAG" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Ungültiger Tag (erlaubt: 7 bis 40 Hex-Zeichen, klein)." >&2; exit 2; }
[ "$TAG" != "$PLATZHALTER" ] || { echo "Der Platzhalter $PLATZHALTER ist kein gültiger Tag." >&2; exit 2; }

case "$UMGEBUNG" in
    test)
        DIR=/opt/heyelli-test
        PROJEKT=heyelli-test
        HOST=heyelli-test.elomech.de
        BACKUP=/var/backups/heyelli-test
        ;;
    prod)
        DIR=/opt/heyelli-prod
        PROJEKT=heyelli-prod
        HOST=heyelli.elomech.de
        BACKUP=/var/backups/heyelli-prod
        ;;
    *) echo "Umgebung muss test oder prod sein." >&2; exit 2 ;;
esac

# ---------------------------------------------------------------- Sperre je Instanz
exec 9> "/run/lock/heyelli-deploy-$UMGEBUNG.lock"
flock -n 9 || fail "Es läuft schon ein Deploy für $UMGEBUNG."

log "Deploy $UMGEBUNG: Tag $TAG, Projekt $PROJEKT, $HOST"

# ---------------------------------------------------------------- Instanz prüfen (nur Namen und Rechte, keine Werte ausgeben)
cd "$DIR" 2> /dev/null || fail "Verzeichnis $DIR fehlt (Erstbefüllung durch die IT, siehe docs/ci-deploy.md)."
for f in compose.yaml .env .env.tag; do
    [ -f "$f" ] || fail "$DIR/$f fehlt."
done
[ "$(stat -c '%U:%G %a' .env)" = "root:root 600" ] || fail "$DIR/.env muss root:root 600 sein."

wert() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
for k in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB HEYELLI_PORT HEYELLI_BRIDGE_INTERN HEYELLI_BRIDGE_EXTERN HEYELLI_PUBLIC_ORIGIN; do
    [ -n "$(wert "$k")" ] || fail "In $DIR/.env fehlt der Pflichtwert $k."
done
if [ "$UMGEBUNG" = "test" ]; then
    # Eine Testinstanz darf nie echte Personen anschreiben und nicht in Microsoft 365 schreiben.
    [ -n "$(wert HEYELLI_INSTANZ_HINWEIS)" ] || fail "Testinstanz: HEYELLI_INSTANZ_HINWEIS muss in .env gesetzt sein (z. B. TESTINSTANZ)."
    modus="$(wert HEYELLI_MAIL_MODUS | tr '[:upper:]' '[:lower:]')"
    case "$modus" in
        aus) ;;
        umleiten) [ -n "$(wert HEYELLI_MAIL_UMLEITUNG)" ] || fail "Testinstanz: HEYELLI_MAIL_MODUS=umleiten braucht HEYELLI_MAIL_UMLEITUNG." ;;
        *) fail "Testinstanz: HEYELLI_MAIL_MODUS muss aus oder umleiten sein." ;;
    esac
    [ "$(wert HEYELLI_EXTERN_SCHREIBEN | tr '[:upper:]' '[:lower:]')" = "aus" ] || fail "Testinstanz: HEYELLI_EXTERN_SCHREIBEN=aus fehlt (keine Schreibzugriffe auf Microsoft 365)."
fi
[ -f "$DOCKER_CONFIG/config.json" ] || fail "Registry-Login fehlt ($DOCKER_CONFIG/config.json)."

# Aktive Schalter, nur mit Namen (keine Werte, nichts Geheimes).
SCHALTER=""
for k in HEYELLI_ELLI_AKTIV HEYELLI_INSTANZ_HINWEIS HEYELLI_MAIL_MODUS HEYELLI_EXTERN_SCHREIBEN; do
    [ -z "$(wert "$k")" ] || SCHALTER="$SCHALTER $k"
done
log "Aktive Schalter:${SCHALTER:- keine}"
# Anmeldung: heyelli-Konten mit Passwort bis zur Aktivierung der Microsoft-Anmeldung (Migration 047). Erster Administrator:
# heyelli-compose.sh <instanz> exec app node scripts/bootstrap-admin.mjs  (gibt das Startpasswort einmal aus)
for k in AUTH_MODE HEYELLI_SIMULATOR_ANMELDUNG DEMO_DIRECTORY_USERS_FILE SIMULATOR_PASSWORD; do
    [ -z "$(wert "$k")" ] || log "Hinweis: $k wird nicht mehr verwendet und kann aus $DIR/.env entfernt werden."
done

DC=(docker compose -p "$PROJEKT" --env-file .env --env-file .env.tag -f compose.yaml)

ALT_TAG="$(grep -E '^HEYELLI_TAG=' .env.tag | tail -n 1 | cut -d= -f2- || true)"
if [[ ! "$ALT_TAG" =~ ^[0-9a-f]{7,40}$ ]] || [ "$ALT_TAG" = "$PLATZHALTER" ]; then
    log "Hinweis: kein gültiges bisheriges Tag in .env.tag (leer oder Platzhalter), ein Rollback ist dann nicht möglich."
    ALT_TAG=""
fi
log "Bisheriges Tag: ${ALT_TAG:-keines}"

tag_schreiben() { # atomar
    printf 'HEYELLI_TAG=%s\n' "$1" > .env.tag.neu
    mv -f .env.tag.neu .env.tag
}
# Zurück auf das bisherige Tag; ohne Vorgänger wird der Platzhalter zurückgeschrieben (nie ein halb ausgerolltes Tag stehen lassen).
tag_zurueck() { tag_schreiben "${ALT_TAG:-$PLATZHALTER}"; }

pruefen() { # HTTPS-Prüfung der Anmeldeseite mit normaler Zertifikatsprüfung, bis zu 12 Versuche à 5 s
    local i code
    for i in $(seq 1 12); do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve "$HOST:443:127.0.0.1" "https://$HOST/anmeldung" || true)"
        if [ "$code" = "200" ]; then
            log "Gesundheitsprüfung ok (Versuch $i)."
            return 0
        fi
        log "Gesundheitsprüfung Versuch $i/12: HTTP ${code:-000}"
        sleep 5
    done
    return 1
}

fehler_logs() { # nur bei Fehlern (Datenschutz im Job-Log)
    "${DC[@]}" ps || true
    "${DC[@]}" logs --tail 50 app migrate || true
}

# ---------------------------------------------------------------- PostgreSQL sichern (Dump aus dem laufenden Datenbankdienst)
if "${DC[@]}" ps --status running --services 2> /dev/null | grep -qx db; then
    install -d -m 700 -o root -g root "$BACKUP"
    ZIEL="$BACKUP/heyelli-$(date '+%Y-%m-%d_%H%M%S')-${ALT_TAG:-ohne-tag}.dump"
    # shellcheck disable=SC2016  # die Variablen sollen erst im Datenbank-Container expandiert werden
    if ! "${DC[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$ZIEL"; then
        rm -f -- "$ZIEL"
        fail "pg_dump fehlgeschlagen, kein Deploy."
    fi
    chmod 600 "$ZIEL"
    # Plausibilitätsprüfung: nicht leer und als Archiv lesbar
    if [ ! -s "$ZIEL" ] || ! "${DC[@]}" exec -T db pg_restore --list < "$ZIEL" > /dev/null; then
        rm -f -- "$ZIEL"
        fail "Datenbanksicherung nicht lesbar (leer oder kein gültiges Archiv), kein Deploy."
    fi
    log "Datenbanksicherung geprüft: $ZIEL"
    # nur die letzten 10 Sicherungen behalten
    find "$BACKUP" -maxdepth 1 -type f -name 'heyelli-*.dump' -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- | while IFS= read -r alt; do rm -f -- "$alt"; done
else
    log "Hinweis: Datenbankdienst läuft nicht (Erstinstallation?), keine Sicherung."
fi

# ---------------------------------------------------------------- neues Tag setzen, Image ziehen
tag_schreiben "$TAG"
log "Image ziehen ..."
if ! "${DC[@]}" pull app; then
    tag_zurueck
    fail "docker compose pull fehlgeschlagen, Tag wieder auf ${ALT_TAG:-$PLATZHALTER} gesetzt, nichts gestartet."
fi
"${DC[@]}" pull db > /dev/null 2>&1 || log "Hinweis: Datenbank-Image konnte nicht aktualisiert werden (vorhandenes wird genutzt)."

# ---------------------------------------------------------------- Compose-Datei gegen das Image-Label prüfen
IMAGE="$("${DC[@]}" config --images | grep -v '^postgres:' | sed -n '1p')"
SOLL="$(docker image inspect --format '{{ index .Config.Labels "de.elomech.heyelli.sha.compose" }}' "$IMAGE" 2> /dev/null || true)"
IST="$(sha256sum compose.yaml | cut -d' ' -f1)"
if [ -z "$SOLL" ] || [ "$SOLL" != "$IST" ]; then
    tag_zurueck
    fail "compose.yaml auf dem Server (sha256 ${IST:0:12}) passt nicht zum Image (Label ${SOLL:0:12}). Tag zurückgesetzt, nichts gestartet. compose.server.yaml aus dem Commit $TAG als compose.yaml installieren."
fi
log "compose.yaml passt zum Image."

# Elli aktiv: Ollama muss im gemeinsamen Netz erreichbar sein und ein Modell haben, sonst nichts ausrollen (Instanz läuft unverändert weiter).
if [ "$(wert HEYELLI_ELLI_AKTIV)" = "1" ]; then
    OLLAMA_NETZ="$(wert OLLAMA_NETWORK)"; OLLAMA_NETZ="${OLLAMA_NETZ:-heyelli-ollama}"
    OLLAMA_URL="$(wert OLLAMA_BASE_URL)"; OLLAMA_URL="${OLLAMA_URL:-http://ollama:11434}"
    if ! docker run --rm --network "$OLLAMA_NETZ" --read-only --cap-drop ALL --security-opt no-new-privileges:true --entrypoint node "$IMAGE" \
        -e "fetch(process.argv[1]+'/api/tags',{signal:AbortSignal.timeout(8000)}).then(r=>r.json()).then(j=>process.exit(Array.isArray(j.models)&&j.models.length?0:3)).catch(()=>process.exit(2))" "$OLLAMA_URL" > /dev/null 2>&1; then
        tag_zurueck
        fail "Elli ist aktiv (HEYELLI_ELLI_AKTIV=1), aber Ollama ist im Netz $OLLAMA_NETZ nicht erreichbar oder hat kein Modell. Tag zurückgesetzt, nichts gestartet. Ollama-Stack prüfen (deploy/server/ollama/, docs/ci-deploy.md)."
    fi
    log "Ollama erreichbar (Netz $OLLAMA_NETZ), Modell vorhanden."
fi

# ---------------------------------------------------------------- starten und prüfen
log "Starten (Migration läuft als eigener Dienst vor der Anwendung) ..."
if "${DC[@]}" up -d && pruefen; then
    log "Deploy ok: $UMGEBUNG läuft mit Tag $TAG."
    "${DC[@]}" ps
    exit 0
fi

# ---------------------------------------------------------------- Fehler: automatischer Rollback
printf 'FEHLER: %s antwortet nach dem Start mit Tag %s nicht mit HTTP 200.\n' "$HOST" "$TAG" >&2
fehler_logs
if [ -n "$ALT_TAG" ] && [ "$ALT_TAG" != "$TAG" ]; then
    log "Rollback auf Tag $ALT_TAG ..."
    tag_schreiben "$ALT_TAG"
    "${DC[@]}" up -d || true
    if pruefen; then
        fail "Deploy von $TAG fehlgeschlagen. Rollback auf $ALT_TAG erfolgreich, die Instanz läuft mit dem alten Stand. Hinweis: Wurde eine Migration angewendet, passt der Datenbankstand ggf. nicht zum alten Image (Sicherung in $BACKUP)."
    fi
    fail "Deploy von $TAG fehlgeschlagen UND der Rollback auf $ALT_TAG antwortet nicht. Manuell prüfen: heyelli-compose.sh $UMGEBUNG ps"
fi
tag_zurueck
fail "Deploy von $TAG fehlgeschlagen. Kein Rollback möglich (kein gültiges bisheriges Tag), .env.tag steht wieder auf dem Platzhalter."
