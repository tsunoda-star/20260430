#!/bin/bash
# ===================================================================
# TDD Sandbox Orchestrator
# Docker Desktop Sandboxes (microVM) を使った並列テスト実行
#
# Usage:
#   ./scripts/sandbox-test.sh [options]
#
# Options:
#   --shard <N>          並列shard数 (default: 3)
#   --template <name>    Sandboxテンプレート名
#   --auth <mode>        認証モード: storageState|fresh|skip (default: storageState)
#   --cleanup <policy>   クリーンアップ: always|on_success|never (default: always)
#   --save-template      テスト後にテンプレートとして保存
#   --browser <project>  Playwrightプロジェクト (default: chromium)
#   --filter <pattern>   テストフィルタ (grep pattern)
#   --timeout <seconds>  shard毎タイムアウト (default: 300)
# ===================================================================

set -euo pipefail

# --- Default configuration ---
SHARD_COUNT="${SHARD_COUNT:-3}"
SANDBOX_TEMPLATE="${SANDBOX_TEMPLATE:-}"
AUTH_MODE="${AUTH_MODE:-storageState}"
CLEANUP_POLICY="${CLEANUP_POLICY:-always}"
SAVE_TEMPLATE="${SAVE_TEMPLATE:-false}"
BROWSER_PROJECT="${BROWSER_PROJECT:-chromium}"
TEST_FILTER="${TEST_FILTER:-}"
TIMEOUT_PER_SHARD="${TIMEOUT_PER_SHARD:-300}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="$PROJECT_DIR/.test-logs/sandbox-$(date +%Y%m%d-%H%M%S)"

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --shard) SHARD_COUNT="$2"; shift 2 ;;
    --template) SANDBOX_TEMPLATE="$2"; shift 2 ;;
    --auth) AUTH_MODE="$2"; shift 2 ;;
    --cleanup) CLEANUP_POLICY="$2"; shift 2 ;;
    --save-template) SAVE_TEMPLATE="true"; shift ;;
    --browser) BROWSER_PROJECT="$2"; shift 2 ;;
    --filter) TEST_FILTER="$2"; shift 2 ;;
    --timeout) TIMEOUT_PER_SHARD="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Validation ---
if ! command -v docker &>/dev/null; then
  echo "ERROR: docker CLI not found"
  exit 1
fi

if ! docker sandbox ls &>/dev/null 2>&1; then
  echo "ERROR: Docker Desktop Sandboxes not available."
  echo "Requires Docker Desktop 4.58+ with Sandboxes enabled."
  exit 1
fi

MAX_SANDBOXES=5
CURRENT_SANDBOXES=$(docker sandbox ls 2>/dev/null | grep -c "e2e-shard" || echo 0)
if [ "$((CURRENT_SANDBOXES + SHARD_COUNT))" -gt "$MAX_SANDBOXES" ]; then
  echo "ERROR: Would exceed sandbox limit ($MAX_SANDBOXES). Current: $CURRENT_SANDBOXES, Requested: $SHARD_COUNT"
  exit 1
fi

mkdir -p "$RESULTS_DIR"

echo "==========================================="
echo "  TDD Sandbox Orchestrator"
echo "==========================================="
echo "  Shards:    $SHARD_COUNT"
echo "  Template:  ${SANDBOX_TEMPLATE:-none (fresh)}"
echo "  Auth:      $AUTH_MODE"
echo "  Cleanup:   $CLEANUP_POLICY"
echo "  Browser:   $BROWSER_PROJECT"
echo "  Filter:    ${TEST_FILTER:-all tests}"
echo "  Timeout:   ${TIMEOUT_PER_SHARD}s per shard"
echo "  Results:   $RESULTS_DIR"
echo "==========================================="

# --- Record active sandbox state ---
cat > "$PROJECT_DIR/.test-logs/sandbox-active.json" <<EOF
{
  "shard_count": $SHARD_COUNT,
  "template": "${SANDBOX_TEMPLATE}",
  "auth_mode": "$AUTH_MODE",
  "cleanup_policy": "$CLEANUP_POLICY",
  "results_dir": "$RESULTS_DIR",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# --- Phase 1: Create Sandboxes ---
echo ""
echo "[Phase 1] Creating $SHARD_COUNT sandboxes..."

for i in $(seq 1 "$SHARD_COUNT"); do
  if [ -n "$SANDBOX_TEMPLATE" ]; then
    echo "  Creating e2e-shard-$i from template '$SANDBOX_TEMPLATE'..."
    docker sandbox create \
      --name "e2e-shard-$i" \
      --template "$SANDBOX_TEMPLATE" \
      --workspace "$PROJECT_DIR" &
  else
    echo "  Creating e2e-shard-$i (fresh)..."
    docker sandbox create \
      --name "e2e-shard-$i" \
      --workspace "$PROJECT_DIR" &
  fi
done
wait
echo "  All sandboxes created."

# --- Phase 2: Authentication Setup ---
echo ""
echo "[Phase 2] Authentication setup (mode: $AUTH_MODE)..."

case "$AUTH_MODE" in
  storageState)
    if [ -f "$PROJECT_DIR/playwright/.auth/user.json" ]; then
      echo "  storageState found, reusing existing auth."
    else
      echo "  No storageState found, running auth.setup.ts in shard-1..."
      docker sandbox exec e2e-shard-1 \
        npx playwright test --project=setup 2>&1 | tee "$RESULTS_DIR/auth-setup.log"
      echo "  Auth setup complete. storageState synced via workspace."
    fi
    ;;
  fresh)
    echo "  Running fresh auth.setup.ts in shard-1..."
    docker sandbox exec e2e-shard-1 \
      npx playwright test --project=setup 2>&1 | tee "$RESULTS_DIR/auth-setup.log"
    echo "  Fresh auth setup complete."
    ;;
  skip)
    echo "  Skipping authentication setup."
    ;;
  *)
    echo "ERROR: Unknown auth mode: $AUTH_MODE"
    exit 1
    ;;
esac

# --- Phase 3: Parallel Test Execution ---
echo ""
echo "[Phase 3] Running tests across $SHARD_COUNT shards..."

PIDS=()
FILTER_ARGS=""
if [ -n "$TEST_FILTER" ]; then
  FILTER_ARGS="--grep \"$TEST_FILTER\""
fi

for i in $(seq 1 "$SHARD_COUNT"); do
  echo "  Starting shard $i/$SHARD_COUNT..."
  (
    timeout "$TIMEOUT_PER_SHARD" docker sandbox exec "e2e-shard-$i" \
      npx playwright test \
        --project="$BROWSER_PROJECT" \
        --shard="$i/$SHARD_COUNT" \
        --reporter=blob \
        $FILTER_ARGS \
      > "$RESULTS_DIR/shard-$i.log" 2>&1
  ) &
  PIDS+=($!)
done

# --- Phase 4: Wait for all shards ---
echo ""
echo "[Phase 4] Waiting for all shards to complete..."

FAILED=0
for idx in "${!PIDS[@]}"; do
  shard_num=$((idx + 1))
  if wait "${PIDS[$idx]}"; then
    echo "  Shard $shard_num: PASSED"
  else
    echo "  Shard $shard_num: FAILED"
    FAILED=$((FAILED + 1))
  fi
done

# --- Phase 5: Merge Reports ---
echo ""
echo "[Phase 5] Merging reports from all shards..."

# Collect blob reports from each sandbox workspace
BLOB_DIRS=()
for i in $(seq 1 "$SHARD_COUNT"); do
  BLOB_DIR="$RESULTS_DIR/blob-report-shard-$i"
  mkdir -p "$BLOB_DIR"
  # Copy blob reports from sandbox workspace via the synced directory
  if ls "$PROJECT_DIR/.test-logs"/*/blob-report/*.zip 2>/dev/null; then
    cp "$PROJECT_DIR/.test-logs"/*/blob-report/*.zip "$BLOB_DIR/" 2>/dev/null || true
  fi
  BLOB_DIRS+=("$BLOB_DIR")
done

# Merge all blob reports into a single HTML report
if ls "$RESULTS_DIR"/blob-report-shard-*/*.zip 2>/dev/null; then
  npx playwright merge-reports \
    --reporter html \
    "$RESULTS_DIR"/blob-report-shard-* \
    2>&1 | tee "$RESULTS_DIR/merge.log" || true
  echo "  Merged report: $RESULTS_DIR/playwright-report/"
else
  echo "  No blob reports found to merge."
fi

# --- Generate summary ---
cat > "$RESULTS_DIR/summary.md" <<EOF
# Sandbox Test Results

- **Date**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Shards**: $SHARD_COUNT
- **Template**: ${SANDBOX_TEMPLATE:-none}
- **Auth Mode**: $AUTH_MODE
- **Browser**: $BROWSER_PROJECT
- **Filter**: ${TEST_FILTER:-all}

## Results

| Shard | Status |
|-------|--------|
$(for i in $(seq 1 "$SHARD_COUNT"); do
  if grep -q "passed" "$RESULTS_DIR/shard-$i.log" 2>/dev/null; then
    echo "| $i | PASSED |"
  else
    echo "| $i | FAILED |"
  fi
done)

**Failed shards**: $FAILED/$SHARD_COUNT

## Logs

$(for i in $(seq 1 "$SHARD_COUNT"); do
  echo "- [Shard $i](shard-$i.log)"
done)
EOF

# --- Phase 6: Cleanup ---
echo ""
echo "[Phase 6] Cleanup (policy: $CLEANUP_POLICY)..."

do_cleanup() {
  for i in $(seq 1 "$SHARD_COUNT"); do
    echo "  Removing e2e-shard-$i..."
    docker sandbox rm "e2e-shard-$i" 2>/dev/null &
  done
  wait
  echo "  All sandboxes removed."
}

case "$CLEANUP_POLICY" in
  always)
    do_cleanup
    ;;
  on_success)
    if [ "$FAILED" -eq 0 ]; then
      do_cleanup
    else
      echo "  Keeping sandboxes for debugging ($FAILED failed shards)."
    fi
    ;;
  never)
    echo "  Keeping all sandboxes (cleanup=never)."
    ;;
esac

# --- Save template if requested ---
if [ "$SAVE_TEMPLATE" = "true" ] && [ "$FAILED" -eq 0 ]; then
  TEMPLATE_NAME="${SANDBOX_TEMPLATE:-e2e-authenticated}"
  echo ""
  echo "[Extra] Saving sandbox as template '$TEMPLATE_NAME'..."
  docker sandbox save "e2e-shard-1" --template "$TEMPLATE_NAME" 2>/dev/null || true
  echo "  Template saved."
fi

# Remove active sandbox state
rm -f "$PROJECT_DIR/.test-logs/sandbox-active.json"

# --- Update latest symlink ---
LATEST_LINK="$PROJECT_DIR/.test-logs/sandbox-latest"
rm -f "$LATEST_LINK"
ln -sf "$RESULTS_DIR" "$LATEST_LINK"

echo ""
echo "==========================================="
echo "  Results: $RESULTS_DIR"
echo "  Summary: $RESULTS_DIR/summary.md"
echo "  Failed:  $FAILED/$SHARD_COUNT shards"
echo "==========================================="

exit "$FAILED"
