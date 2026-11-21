#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker fehlt. Bitte zuerst Docker installieren.' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo 'Docker Compose fehlt. Bitte Compose v2 installieren.' >&2
    exit 1
  fi
  HOMEBREW_NO_AUTO_UPDATE=1 brew install docker-compose
  compose_prefix=$(brew --prefix docker-compose)
  plugin_directory="$HOME/.docker/cli-plugins"
  mkdir -p "$plugin_directory"
  if [ -e "$plugin_directory/docker-compose" ] || [ -L "$plugin_directory/docker-compose" ]; then
    echo 'Ein Compose-Plugin existiert bereits, funktioniert aber nicht. Bitte dessen Installation prüfen.' >&2
    exit 1
  fi
  ln -s "$compose_prefix/bin/docker-compose" "$plugin_directory/docker-compose"
  docker compose version
fi

if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    colima start
  else
    echo 'Docker-Engine ist nicht erreichbar. Bitte Docker Desktop oder Colima starten.' >&2
    exit 1
  fi
  docker info >/dev/null
fi

if [ ! -e .env ]; then
  cp .env.example .env
fi
npm run db:up
npm run db:migrate
npm run db:seed
# Zweiter Lauf prüft, dass Migrationen und Seed wiederholbar sind.
npm run db:migrate
npm run db:seed
npm run db:verify
# Container ersetzen, Volume behalten und gespeicherte Daten erneut prüfen.
docker compose up -d --force-recreate --wait db
npm run db:verify
echo 'PostgreSQL ist bereit. Migrationen, Beispieldaten und Volume-Persistenz wurden geprüft.'
