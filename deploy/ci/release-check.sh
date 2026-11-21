#!/bin/bash
# Prüfungen der Release-Pipeline (Tag vX.Y.Z). Wird von .gitlab-ci.yml aufgerufen, nicht vom Server.
#
#   release-check.sh check     Release-Voraussetzungen: Tag-Commit liegt in main, das zugehörige Image existiert und
#                              stammt aus genau diesem Commit; legt danach das Zusatz-Tag app:vX.Y.Z an (ohne Neubau).
#                              Schlägt etwas fehl, gibt es keinen Prod-Deploy.
#   release-check.sh version   Hinweis (Exit 2 = Warnung, blockiert nie): Code seit dem letzten Release geändert, aber
#                              app-releases.ts nicht.
#
# Erwartete CI-Variablen: CI_COMMIT_TAG, CI_COMMIT_SHA, CI_COMMIT_SHORT_SHA, CI_DEFAULT_BRANCH, CI_REGISTRY,
# CI_REGISTRY_IMAGE, CI_JOB_TOKEN. Es werden keine Geheimnisse ausgegeben.

set -euo pipefail

VERSIONSDATEI=src/platform/shell/app-releases.ts
COMPOSE_DATEI=compose.server.yaml
SEMVER='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'

log() { printf '%s\n' "$*"; }
fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }
braucht() { local n; for n in "$@"; do [ -n "${!n:-}" ] || fail "Variable $n fehlt (läuft das Skript in einer GitLab-Tag-Pipeline?)."; done; }

# Liest ein Label eines Image-Tags aus der Registry (ohne das Image zu laden). Bei Index und Einzel-Image gleich.
image_label() { # <Image:Tag> <Label>
    docker buildx imagetools inspect "$1" --format '{{json .Image}}' 2> /dev/null \
        | jq -r --arg l "$2" '(.["linux/amd64"] // .) | .config.Labels[$l] // empty' 2> /dev/null || true
}

# ---------------------------------------------------------------- check
pruefe_release() {
    braucht CI_COMMIT_TAG CI_COMMIT_SHA CI_COMMIT_SHORT_SHA CI_DEFAULT_BRANCH CI_REGISTRY CI_REGISTRY_IMAGE CI_JOB_TOKEN
    local img="$CI_REGISTRY_IMAGE/app" kurz="$CI_COMMIT_SHORT_SHA"

    log "== 1. Versionsnummer des Tags"
    [[ "$CI_COMMIT_TAG" =~ $SEMVER ]] || fail "Der Tag '$CI_COMMIT_TAG' ist keine gültige Version vX.Y.Z (ohne führende Nullen, z. B. v1.0.0)."
    log "  ok: $CI_COMMIT_TAG"

    log "== 2. Der Tag-Commit muss in $CI_DEFAULT_BRANCH liegen"
    if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then git fetch --quiet --unshallow --no-tags origin; fi
    git fetch --quiet --no-tags origin "+refs/heads/$CI_DEFAULT_BRANCH:refs/remotes/origin/$CI_DEFAULT_BRANCH" \
        || fail "origin/$CI_DEFAULT_BRANCH konnte nicht geladen werden."
    git cat-file -e "$CI_COMMIT_SHA^{commit}" 2> /dev/null || fail "Der Tag-Commit $kurz ist nicht vorhanden."
    git merge-base --is-ancestor "$CI_COMMIT_SHA" "origin/$CI_DEFAULT_BRANCH" \
        || fail "Der Commit $kurz liegt NICHT in $CI_DEFAULT_BRANCH. Releases gibt es nur für Commits aus main (erst per Merge Request nach main bringen, dann den Tag setzen)."
    log "  ok: $kurz ist in origin/$CI_DEFAULT_BRANCH enthalten"

    log "== 3. Das Image $img:$kurz muss existieren und aus diesem Commit stammen"
    echo "$CI_JOB_TOKEN" | docker login -u gitlab-ci-token --password-stdin "$CI_REGISTRY" > /dev/null 2>&1 || fail "Anmeldung an der Registry fehlgeschlagen."
    local digest config revision label_compose soll_compose
    digest="$(docker buildx imagetools inspect "$img:$kurz" --format '{{.Manifest.Digest}}' 2> /dev/null || true)"
    [ -n "$digest" ] || fail "Das Image $img:$kurz gibt es nicht. Ist die main-Pipeline für diesen Commit grün (build_image)? Oder hat die Registry-Aufräumregel es gelöscht? Ohne Image kein Prod-Deploy."
    config="$(docker buildx imagetools inspect "$img:$kurz" --format '{{json .Image}}' 2> /dev/null || true)"
    [ -n "$config" ] || fail "Die Image-Daten von $img:$kurz konnten nicht gelesen werden."
    revision="$(printf '%s' "$config" | jq -r '(.["linux/amd64"] // .) | .config.Labels["org.opencontainers.image.revision"] // empty')"
    [ "$revision" = "$CI_COMMIT_SHA" ] || fail "Das Image wurde aus einem anderen Commit gebaut (Label ${revision:0:8}, erwartet ${CI_COMMIT_SHA:0:8})."
    label_compose="$(printf '%s' "$config" | jq -r '(.["linux/amd64"] // .) | .config.Labels["de.elomech.heyelli.sha.compose"] // empty')"
    soll_compose="$(git show "$CI_COMMIT_SHA:$COMPOSE_DATEI" | sha256sum | cut -d' ' -f1)"
    [ "$label_compose" = "$soll_compose" ] || fail "$COMPOSE_DATEI im Tag-Commit passt nicht zum Image-Label (sha256 ${soll_compose:0:12} gegen ${label_compose:0:12})."
    log "  ok: $img:$kurz (Digest ${digest#sha256:}) stammt aus Commit $kurz, Compose-Label passt"

    log "== 4. Zusatz-Tag $img:$CI_COMMIT_TAG (ohne Neubau, ein Release-Tag wird nie überschrieben)"
    # "imagetools create" legt eine neue Manifestliste an (anderer Digest, gleicher Inhalt). Verglichen wird deshalb das Commit-Label.
    local vorhanden vorhanden_rev
    vorhanden="$(docker buildx imagetools inspect "$img:$CI_COMMIT_TAG" --format '{{.Manifest.Digest}}' 2> /dev/null || true)"
    if [ -n "$vorhanden" ]; then
        vorhanden_rev="$(image_label "$img:$CI_COMMIT_TAG" org.opencontainers.image.revision)"
        [ "$vorhanden_rev" = "$CI_COMMIT_SHA" ] || fail "Das Image-Tag $CI_COMMIT_TAG gibt es schon und gehört zu einem anderen Commit (${vorhanden_rev:0:8}). Release-Tags werden nicht überschrieben; eine neue Version vergeben."
        log "  ok: $CI_COMMIT_TAG gibt es schon und gehört zu diesem Commit"
    else
        docker buildx imagetools create --tag "$img:$CI_COMMIT_TAG" "$img:$kurz" > /dev/null 2>&1 || fail "Das Zusatz-Tag $CI_COMMIT_TAG konnte nicht angelegt werden."
        [ "$(image_label "$img:$CI_COMMIT_TAG" org.opencontainers.image.revision)" = "$CI_COMMIT_SHA" ] || fail "Das Zusatz-Tag gehört nicht zum Tag-Commit."
        log "  ok: $img:$CI_COMMIT_TAG angelegt (Inhalt wie $kurz, kein Neubau)"
    fi
    log ""
    log "Release $CI_COMMIT_TAG ist freigegeben. Prod bekommt das Image mit dem Tag $kurz."
}

# ---------------------------------------------------------------- version
hinweis_version() {
    braucht CI_COMMIT_TAG CI_COMMIT_SHA
    local plattform hoechste
    plattform="$(sed -nE "s/.*platformRelease:AppRelease=\{year:([0-9]+),publication:([0-9]+),publishedOn:'([0-9-]+)'.*/\1.\2 (\3)/p" "$VERSIONSDATEI" | head -n 1)"
    hoechste="$(awk -F'publication:' '/^ .\/[^:]*.:\{year:/ {split($2,a,","); if (a[1]+0>m) m=a[1]+0; j=$0; sub(/.*year:/,"",j); sub(/,.*/,"",j)} END{if (m>0) print j "." m}' "$VERSIONSDATEI")"
    log "Release-Tag:               $CI_COMMIT_TAG"
    log "App-Version im Code:       Plattform ${plattform:-unbekannt}, höchste App-Version ${hoechste:-unbekannt} (Schema JJ.V je App, siehe AGENTS.md)"
    log "Hinweis: Tag (SemVer) und App-Version (JJ.V) sind verschiedene Schemata und werden nicht verglichen."
    git fetch --quiet --tags --force origin 2> /dev/null || true
    local vorher
    vorher="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | grep -vxF "$CI_COMMIT_TAG" | head -n 1 || true)"
    if [ -z "$vorher" ]; then
        log "Dies ist das erste Release, es gibt nichts zu vergleichen."
        return 0
    fi
    log "Vorheriges Release:        $vorher"
    if git diff --quiet "$vorher" "$CI_COMMIT_SHA" -- src database; then
        log "Seit $vorher hat sich im Code (src, database) nichts geändert."
        return 0
    fi
    if git diff --quiet "$vorher" "$CI_COMMIT_SHA" -- "$VERSIONSDATEI"; then
        log "WARNUNG: Seit $vorher hat sich der Code geändert, aber $VERSIONSDATEI nicht."
        log "Laut AGENTS.md wird die Versionsnummer der betroffenen App bei jeder abgeschlossenen Änderung erhöht. Bitte prüfen, ob das vergessen wurde."
        log "Das Release wird dadurch nicht blockiert."
        return 2
    fi
    log "ok: $VERSIONSDATEI wurde seit $vorher angepasst."
}

case "${1:-}" in
    check) pruefe_release ;;
    version) hinweis_version ;;
    *) echo "Aufruf: $0 <check|version>" >&2; exit 64 ;;
esac
