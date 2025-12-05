#!/usr/bin/env bash
set -euo pipefail

get_default_iface() {
  route get default 2>/dev/null | awk '/interface:/{print $2; exit}'
}

get_lan_ip() {
  local iface="$1"

  if [ -n "$iface" ] && command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr "$iface" 2>/dev/null && return 0
  fi

  if command -v ip >/dev/null 2>&1; then
    ip -4 addr show scope global | awk '/inet/{gsub(/\/.*/,"",$2); print $2; exit}' && return 0
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 !~ /127.0.0.1/{print $2; exit}'
  fi
}

iface="$(get_default_iface || true)"
lan_ip="$(get_lan_ip "${iface:-}")"

if [ -n "${lan_ip:-}" ]; then
  echo "LAN access URLs:"
  echo "  Web: http://${lan_ip}:3000"
  echo "  API: http://${lan_ip}:8000"
else
  echo "Could not auto-detect LAN IP. Check your network settings."
fi

echo
echo "Starting docker compose up $*"
exec docker compose up "$@"
