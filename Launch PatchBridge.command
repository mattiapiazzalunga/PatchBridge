#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIN_GIT="2.30.0"
MIN_NODE="22.12.0"
MIN_NPM="10.0.0"

red="$(printf '\033[31m')"
green="$(printf '\033[32m')"
yellow="$(printf '\033[33m')"
reset="$(printf '\033[0m')"

version_ge() {
  current="$1"
  minimum="$2"
  current_major="${current%%.*}"
  current_rest="${current#*.}"
  current_minor="${current_rest%%.*}"
  current_patch="${current_rest#*.}"
  minimum_major="${minimum%%.*}"
  minimum_rest="${minimum#*.}"
  minimum_minor="${minimum_rest%%.*}"
  minimum_patch="${minimum_rest#*.}"

  [ "$current_major" -gt "$minimum_major" ] && return 0
  [ "$current_major" -lt "$minimum_major" ] && return 1
  [ "$current_minor" -gt "$minimum_minor" ] && return 0
  [ "$current_minor" -lt "$minimum_minor" ] && return 1
  [ "$current_patch" -ge "$minimum_patch" ]
}

extract_version() {
  printf '%s' "$1" | sed -nE 's/.*v?([0-9]+\.[0-9]+\.[0-9]+).*/\1/p' | head -n 1
}

check_tool() {
  name="$1"
  command_name="$2"
  minimum="$3"
  install_hint="$4"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '%b%-8s Missing%b - install: %s\n' "$red" "$name" "$reset" "$install_hint"
    return 1
  fi

  raw="$("$command_name" --version 2>&1)"
  version="$(extract_version "$raw")"
  if [ -z "$version" ]; then
    printf '%b%-8s Cannot verify version%b - detected: %s\n' "$red" "$name" "$reset" "$raw"
    return 1
  fi

  if ! version_ge "$version" "$minimum"; then
    printf '%b%-8s Outdated%b - detected %s, need %s+\n' "$red" "$name" "$reset" "$version" "$minimum"
    return 1
  fi

  printf '%b%-8s Ready%b - %s\n' "$green" "$name" "$reset" "$version"
  return 0
}

clear
printf 'PatchBridge Launcher\n'
printf 'Repository: %s\n\n' "$ROOT_DIR"

missing=0
check_tool "Git" "git" "$MIN_GIT" "xcode-select --install or brew install git" || missing=1
check_tool "Node.js" "node" "$MIN_NODE" "brew install node or download from https://nodejs.org/en/download" || missing=1
check_tool "npm" "npm" "$MIN_NPM" "install Node.js from https://nodejs.org/en/download" || missing=1

if [ "$missing" -ne 0 ]; then
  printf '\n%bSome requirements are missing or outdated.%b\n' "$yellow" "$reset"
  printf 'Fix the red items above, then run this launcher again.\n'
  printf '\nPress Enter to close...'
  read -r _
  exit 1
fi

cd "$ROOT_DIR" || exit 1
printf '\nInstalling dependencies...\n'
if ! npm install; then
  printf '\n%bnpm install failed.%b\n' "$red" "$reset"
  printf 'Press Enter to close...'
  read -r _
  exit 1
fi

printf '\nStarting PatchBridge...\n'
npm start

printf '\nPatchBridge closed. Press Enter to close...'
read -r _
