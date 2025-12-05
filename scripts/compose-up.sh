#!/usr/bin/env bash
set -euo pipefail

# Show LAN-friendly URLs so the stack is discoverable from other devices.

get_default_iface() {
  # macOS: "route get" shows the outbound interface.
  route get default 2>/dev/null | awk '/interface:/{print $2; exit}' && return 0

  # Linux: parse the primary interface from the routing table.
  ip route show default 2>/dev/null | awk '/default/{print $5; exit}'
}

get_lan_ip() {
  local iface="$1"

  # macOS prefers ipconfig with a specific interface.
  if [ -n "$iface" ] && command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr "$iface" 2>/dev/null && return 0
  fi

  # Linux: try interface-specific lookup first.
  if [ -n "$iface" ] && command -v ip >/dev/null 2>&1; then
    ip -4 addr show dev "$iface" 2>/dev/null | awk '/inet /{gsub(/\/.*/,"",$2); print $2; exit}' && return 0
  fi

  # Generic fallbacks.
  if command -v ip >/dev/null 2>&1; then
    ip -4 addr show scope global | awk '/inet/{gsub(/\/.*/,"",$2); print $2; exit}' && return 0
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 !~ /127.0.0.1/{print $2; exit}' && return 0
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1; exit}'
  fi
}

print_banner() {
  printf "\n=== LAN Access ===\n"
  printf "Frontend: http://%s:3000\n" "$1"
  printf "API     : http://%s:8000\n" "$1"
  printf "===================\n\n"
}

iface="$(get_default_iface || true)"
lan_ip="$(get_lan_ip "${iface:-}")"

if [ -n "${lan_ip:-}" ]; then
  print_banner "$lan_ip"
else
  echo "[warn] Could not auto-detect LAN IP. Check your network settings."
fi

echo "Starting docker compose up $*"
exec docker compose up "$@"
