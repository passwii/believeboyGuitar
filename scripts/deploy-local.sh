#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONFIG_FILE="${DEPLOY_CONFIG_FILE:-$HOME/.config/believeboy-guitar/deploy.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

: "${DEPLOY_HOST:?Set DEPLOY_HOST in $CONFIG_FILE or the shell environment}"

DEPLOY_PATH="${DEPLOY_PATH:-/opt/believeboy-guitar}"
APP_PORT="${APP_PORT:-8080}"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/passwii/believeboyguitar}"

for command in git npm docker ssh scp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked files have uncommitted changes. Commit or stash them before deploying." >&2
  exit 1
fi

if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Warning: untracked files are present; they are not part of the release commit." >&2
fi

echo "Fetching origin/main..."
git fetch --quiet origin main

SHA="$(git rev-parse HEAD)"
MAIN_SHA="$(git rev-parse origin/main)"

if ! git merge-base --is-ancestor "$SHA" "$MAIN_SHA"; then
  echo "HEAD is not reachable from origin/main. Merge the change before deploying." >&2
  exit 1
fi

if [[ "$SHA" != "$MAIN_SHA" ]]; then
  echo "HEAD ($SHA) is not the latest origin/main ($MAIN_SHA)." >&2
  echo "Switch to main and pull before deploying." >&2
  exit 1
fi

if [[ -n "${DEPLOY_PLATFORM:-}" ]]; then
  PLATFORM="$DEPLOY_PLATFORM"
else
  REMOTE_ARCH="$(ssh "$DEPLOY_HOST" 'uname -m')"
  case "$REMOTE_ARCH" in
    x86_64 | amd64) PLATFORM="linux/amd64" ;;
    aarch64 | arm64) PLATFORM="linux/arm64" ;;
    *)
      echo "Unsupported VPS architecture: $REMOTE_ARCH" >&2
      exit 1
      ;;
  esac
fi

if [[ ! -d node_modules ]] ||
  [[ ! -f node_modules/.package-lock.json ]] ||
  [[ package-lock.json -nt node_modules/.package-lock.json ]]; then
  npm ci
fi

npm run typecheck
npm test
npm run build -- --webpack

IMAGE_TAG="sha-$SHA"
echo "Building $IMAGE_NAME:$IMAGE_TAG for $PLATFORM..."
docker buildx build \
  --platform "$PLATFORM" \
  --push \
  --tag "$IMAGE_NAME:$IMAGE_TAG" \
  --tag "$IMAGE_NAME:latest" \
  --label "org.opencontainers.image.revision=$SHA" \
  .

echo "Syncing Compose file to $DEPLOY_HOST:$DEPLOY_PATH..."
scp "$ROOT/deploy/docker-compose.yml" \
  "$DEPLOY_HOST:$DEPLOY_PATH/docker-compose.yml"

echo "Deploying $IMAGE_TAG..."
# The values intentionally expand on the local machine before ssh runs.
# shellcheck disable=SC2029
ssh "$DEPLOY_HOST" \
  "IMAGE_TAG='$IMAGE_TAG' DEPLOY_PATH='$DEPLOY_PATH' APP_PORT='$APP_PORT' bash -s" \
  < "$ROOT/scripts/deploy-remote.sh"

echo "Deployed https://guitar.believeboy.com from $IMAGE_TAG"
