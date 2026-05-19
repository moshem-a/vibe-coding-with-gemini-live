#!/bin/sh
set -e

KEY="${GEMINI_API_KEY:-}"
PROXY="${AGENT_PROXY_URL:-}"
escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
ESCAPED_KEY=$(escape "$KEY")
ESCAPED_PROXY=$(escape "$PROXY")
{
  printf 'window.__GEMINI_API_KEY = "%s";\n' "$ESCAPED_KEY"
  printf 'window.__AGENT_PROXY_URL = "%s";\n' "$ESCAPED_PROXY"
} > /usr/share/nginx/html/config.local.js

if [ -z "$KEY" ]; then
  echo "[start.sh] WARNING: GEMINI_API_KEY is empty; SetupCard will prompt." >&2
else
  echo "[start.sh] Injected GEMINI_API_KEY (…${KEY#"${KEY%??????}"})" >&2
fi
if [ -z "$PROXY" ]; then
  echo "[start.sh] WARNING: AGENT_PROXY_URL is empty; sub-agent calls will fail." >&2
else
  echo "[start.sh] Injected AGENT_PROXY_URL = ${PROXY}" >&2
fi

PORT="${PORT:-8080}"
sed -i "s/listen 8080;/listen ${PORT};/g" /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
