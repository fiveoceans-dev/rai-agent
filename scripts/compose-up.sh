#!/usr/bin/env bash
set -euo pipefail

# Show LAN-friendly URLs so the stack is discoverable from other devices.

get_default_iface() {
  if command -v route >/dev/null 2>&1; then
    route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}'
  fi

  if command -v ip >/dev/null 2>&1; then
    ip route show default 2>/dev/null | awk '/default/{print $5; exit}'
  fi
}

get_all_ips() {
  # macOS: iterate hardware ports and collect addresses.
  if command -v networksetup >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    networksetup -listallhardwareports 2>/dev/null | awk '/Device:/{print $2}' \
      | while read -r dev; do ipconfig getifaddr "$dev" 2>/dev/null; done
  fi

  # Generic fallbacks.
  if command -v ip >/dev/null 2>&1; then
    ip -4 addr show scope global | awk '/inet/{gsub(/\/.*/,"",$2); print $2}'
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 !~ /^127\\./{print $2}'
  fi
}

pick_lan_ip() {
  # Prefer the default interface if we have one.
  local iface="$1"
  if [ -n "$iface" ] && command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr "$iface" 2>/dev/null && return 0
  fi

  get_all_ips | head -n 1
}

print_banner() {
  printf "\n=== LAN Access ===\n"
  printf "Frontend: http://%s:3000\n" "$1"
  printf "API     : http://%s:8000\n" "$1"
  printf "===================\n\n"
}

iface="$(get_default_iface || true)"
lan_ip="$(pick_lan_ip "${iface:-}")"

if [ -n "${lan_ip:-}" ]; then
  print_banner "$lan_ip"
else
  echo "[warn] Could not auto-detect LAN IP. Check your network settings."
fi

echo "Starting docker compose up $*"
exec docker compose up "$@"
