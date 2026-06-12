#!/usr/bin/env bash
# Visual regression check: capture fresh screenshots, compare to goldens by RMSE.
# Reduced-motion + seeded parchment make renders reproducible; threshold absorbs AA jitter.
# Re-bless goldens after intentional visual changes:  ./visual-check.sh --bless
set -euo pipefail
cd "$(dirname "$0")"
SKILL_DIR="$HOME/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser"
THRESH=1000   # absolute RMSE (0..65535 scale); ~1.5%

if [[ "${1:-}" == "--bless" ]]; then
  (cd "$SKILL_DIR" && npx tsx /home/evan/dev/lonesome-dove-viz/tests/capture.mjs /home/evan/dev/lonesome-dove-viz/tests/goldens)
  echo "goldens blessed."
  exit 0
fi

TMP=$(mktemp -d)
(cd "$SKILL_DIR" && npx tsx /home/evan/dev/lonesome-dove-viz/tests/capture.mjs "$TMP")
fail=0
for f in map-fit event-card journeys-fit journeys-mid mobile-map mobile-sheet; do
  rmse=$( (compare -metric RMSE "goldens/$f.png" "$TMP/$f.png" /dev/null 2>&1 || true) | awk '{print $1+0}')
  ok=$(awk -v r="$rmse" -v t="$THRESH" 'BEGIN{print (r<t)?1:0}')
  printf "%-13s RMSE %-9s %s\n" "$f" "$rmse" "$([[ $ok == 1 ]] && echo PASS || echo FAIL)"
  [[ $ok == 1 ]] || fail=1
done
exit $fail
