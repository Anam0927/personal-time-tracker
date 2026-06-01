#!/usr/bin/env bash
set -euo pipefail

# ─── Color & Emoji Helpers ──────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() { echo -e "${CYAN}━━━ ${1} ━━━${NC}"; }
ok() { echo -e "${GREEN}✅ ${1}${NC}"; }
warn() { echo -e "${YELLOW}⚠️ ${1}${NC}"; }
fail() { echo -e "${RED}❌ ${1}${NC}"; }
header() {
	echo -e "\n${CYAN}════════════════════════════════════════════════════════════${NC}"
	echo -e "${CYAN}${1}${NC}"
	echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}\n"
}

# ─── Configuration ───────────────────────────────────────────────────────────
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/server" && pwd)"
WORKER_NAME="time-tracker-server"

# ─── Law 1 & 4: Prerequisites Check (Guard Clauses, Fail Fast) ──────────────
header "🔍 Prerequisites Check"

# Check pnpm is available
if ! command -v pnpm &>/dev/null; then
	fail "pnpm is not installed. Install it from https://pnpm.io/installation"
	exit 1
fi
ok "pnpm is available"

# Check curl is available (needed for health check)
if ! command -v curl &>/dev/null; then
	fail "curl is not installed. Install it and try again."
	exit 1
fi
ok "curl is available"

# Check wrangler is available via pnpm
if ! pnpm --dir "$SERVER_DIR" exec wrangler --version &>/dev/null; then
	fail "wrangler is not available in $SERVER_DIR. Run pnpm install first."
	exit 1
fi
ok "wrangler is available"

# Check wrangler authentication (skipped in CI when CLOUDFLARE_API_TOKEN is set)
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
	if ! pnpm --dir "$SERVER_DIR" exec wrangler whoami &>/dev/null; then
		fail "Not authenticated with wrangler. Run 'pnpm exec wrangler login' first."
		exit 1
	fi
fi
ok "Authenticated with wrangler"

# ─── Step 1: Build ───────────────────────────────────────────────────────────
header "📦 Build Step"

step "Building $WORKER_NAME..."
if ! pnpm --dir "$SERVER_DIR" run build; then
	fail "Build failed. Fix the errors above and try again."
	exit 1
fi
ok "Build completed successfully"

# ─── Step 2: Deploy ──────────────────────────────────────────────────────────
header "☁️  Deploy Step"

DEPLOY_OUTPUT=""
step "Deploying $WORKER_NAME to Cloudflare..."

# Capture deploy output so we can parse the URL from it
if ! DEPLOY_OUTPUT=$(pnpm --dir "$SERVER_DIR" exec wrangler deploy 2>&1); then
	fail "Deploy failed. Check the wrangler output above for details."
	exit 1
fi

# Always print the deploy output so the user can see it
printf '%s\n' "$DEPLOY_OUTPUT"

ok "Deploy completed successfully"

# ─── Law 2: Parse WORKERS_URL ──────────────────────────────────────────────
# Priority: 1) explicit env var  2) auto-detect from deploy output  3) skip

WORKERS_URL="${WORKERS_URL:-}"

if [[ -z "$WORKERS_URL" ]]; then
  # No env var set — try to auto-detect from wrangler deploy output
  AUTO_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[a-zA-Z0-9_-]+\.workers\.dev' | head -1 || true)
  if [[ -n "$AUTO_URL" ]]; then
    WORKERS_URL="$AUTO_URL"
    ok "Auto-detected worker URL: $WORKERS_URL"
  fi
fi

# ─── Step 3: Health Check ────────────────────────────────────────────────────
header "🔍 Health Check"

if [[ -z "$WORKERS_URL" ]]; then
	warn "Could not detect worker URL. Set WORKERS_URL env var to enable health checks."
	ok "Deploy script completed (health check skipped)"
	exit 0
fi

HEALTH_URL="${WORKERS_URL}/health"
MAX_RETRIES=5
RETRY_DELAY=3
attempt=1

echo -e "  ${CYAN}Target:${NC}     $HEALTH_URL"
echo -e "  ${CYAN}Max retries:${NC} $MAX_RETRIES"
echo ""

while [[ $attempt -le $MAX_RETRIES ]]; do
	step "Health check attempt $attempt of $MAX_RETRIES..."

	HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null) || HTTP_STATUS="000"

	if [[ "$HTTP_STATUS" == "200" ]]; then
		ok "Health check passed (HTTP $HTTP_STATUS)"
		break
	fi

	if [[ "$HTTP_STATUS" == "000" ]]; then
		fail "Health check failed — connection error (DNS, timeout, or unreachable)"
	else
		fail "Health check returned HTTP $HTTP_STATUS"
	fi

	if [[ $attempt -lt $MAX_RETRIES ]]; then
		echo -e "${YELLOW}Retrying in ${RETRY_DELAY}s...${NC}"
		sleep "$RETRY_DELAY"
	fi

	attempt=$((attempt + 1))
done

if [[ "$HTTP_STATUS" != "200" ]]; then
	fail "Health check failed after $MAX_RETRIES attempts — deployment may be unhealthy."
	exit 1
fi

# ─── Done ────────────────────────────────────────────────────────────────────
header "✅ All Steps Complete"
ok "Worker '$WORKER_NAME' deployed and healthy"
echo -e "   ${CYAN}URL:${NC} $WORKERS_URL"
