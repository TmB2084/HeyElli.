FROM node:24.11.1-bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends chromium orca xvfb xauth openbox dbus-x11 at-spi2-core speech-dispatcher speech-dispatcher-espeak-ng espeak-ng procps xdotool && rm -rf /var/lib/apt/lists/*
ENV DISPLAY=:99 GTK_MODULES=gail:atk-bridge NO_AT_BRIDGE=0
USER node
WORKDIR /work
ENTRYPOINT ["bash","/work/run.sh"]
