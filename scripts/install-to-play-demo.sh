#!/usr/bin/env bash
set -euo pipefail

# Installs the built app onto a chosen play.dhis2.org demo instance via
# DHIS2's standard, documented App Management API (POST /api/apps) -- the
# same install mechanism used for any manual DHIS2 app install, nothing
# app-hub-specific or undocumented.
#
# Wrapped as a script because play.dhis2.org instances are periodically
# reset/rebuilt by DHIS2, which wipes any installed app. Re-run this before
# sharing a demo link -- don't assume a previously-shared link is still live.
#
# Required environment variables:
#   PLAY_URL       Base URL of the RESOLVED play instance backend, e.g.
#                  https://play.im.dhis2.org/stable-2-43-1 -- NOT the
#                  play.dhis2.org/demo short alias. That alias 302-redirects
#                  ACROSS HOSTS to the real backend (currently
#                  play.im.dhis2.org), and curl correctly refuses to resend
#                  Basic Auth across a host change, so pointing this script at
#                  the alias silently installs nothing. Resolve it first:
#                    curl -sI https://play.dhis2.org/demo/   # follow `location` twice
#   PLAY_USERNAME  Username for that instance's published demo admin account
#   PLAY_PASSWORD  Password for that account
#
# Demo credentials for play.dhis2.org are published by DHIS2 itself
# (https://docs.dhis2.org) and can change over time -- verify before running
# this rather than assuming any specific value here. As of this writing they
# are admin / district.

: "${PLAY_URL:?Set PLAY_URL to the play.dhis2.org instance base URL, e.g. https://play.dhis2.org/40.0.0}"
: "${PLAY_USERNAME:?Set PLAY_USERNAME to that instance's demo admin username}"
: "${PLAY_PASSWORD:?Set PLAY_PASSWORD to that instance's demo admin password}"

cd "$(dirname "$0")/.."

ZIP_PATH="$(ls -t build/bundle/*.zip 2>/dev/null | head -1 || true)"
if [ -z "$ZIP_PATH" ]; then
  echo "No built app zip found under build/bundle/. Run 'yarn build' first." >&2
  exit 1
fi

BASE_URL="${PLAY_URL%/}"
RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$RESPONSE_FILE"' EXIT

echo "Installing ${ZIP_PATH} to ${BASE_URL} ..."
HTTP_STATUS=$(curl -sS -L -o "$RESPONSE_FILE" -w '%{http_code}' \
  -u "${PLAY_USERNAME}:${PLAY_PASSWORD}" \
  -F "file=@${ZIP_PATH}" \
  "${BASE_URL}/api/apps")

cat "$RESPONSE_FILE"
echo

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "Install request succeeded (HTTP ${HTTP_STATUS})."
else
  echo "Install request failed (HTTP ${HTTP_STATUS})." >&2
  exit 1
fi

echo
echo "The app's launch URL is normally: ${BASE_URL}/apps/data-share-hub"
echo "(no trailing slash -- with one it 302s back to itself). Confirm with:"
echo "  curl -I -u \"\$PLAY_USERNAME:\$PLAY_PASSWORD\" \"${BASE_URL}/apps/data-share-hub\""
echo "Then open that URL in a private/incognito window (log in with the demo"
echo "credentials when prompted -- that's DHIS2's own login page) before"
echo "sharing it, since play instances reset periodically."
