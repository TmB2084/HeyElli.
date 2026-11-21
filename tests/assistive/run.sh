#!/bin/bash
set -euo pipefail
export HOME=/tmp/assistive-home
mkdir -p "$HOME/.config"
cp -r /etc/speech-dispatcher "$HOME/.config/speech-dispatcher"
printf '\nAudioOutputMethod "alsa"\n' >> "$HOME/.config/speech-dispatcher/speechd.conf"
printf 'pcm.!default { type null }\n' > "$HOME/.asoundrc"
Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp >/tmp/a09-xvfb.log 2>&1 &
for attempt in {1..40}; do if xdotool getdisplaygeometry >/dev/null 2>&1; then break; fi; sleep 0.25; done
exec dbus-run-session -- bash <<'INNER'
set -euo pipefail
python3 -c 'from gi.repository import Gio; Gio.Settings.new("org.gnome.desktop.a11y.applications").set_boolean("screen-reader-enabled", True)'
openbox >/tmp/a09-openbox.log 2>&1 &
speech-dispatcher -d >/tmp/a09-speech.log 2>&1 || true
orca --replace --no-setup --debug --debug-file=/tmp/a09-orca.log >/tmp/a09-orca-start.log 2>&1 &
node /work/orca.mjs
INNER
