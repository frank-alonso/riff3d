#!/usr/bin/env bash
set -euo pipefail

BUDGET=1500
ADAPTER_DIR="packages/adapter-playcanvas/src"

# Core files: adapter, scene-builder, environment, types, index, component-mappers
CORE_FILES=(
  "$ADAPTER_DIR/adapter.ts"
  "$ADAPTER_DIR/scene-builder.ts"
  "$ADAPTER_DIR/environment.ts"
  "$ADAPTER_DIR/types.ts"
  "$ADAPTER_DIR/index.ts"
)

# Include all component mapper files
for f in "$ADAPTER_DIR"/component-mappers/*.ts; do
  CORE_FILES+=("$f")
done

TOTAL=$(wc -l "${CORE_FILES[@]}" | tail -1 | awk '{print $1}')

echo "Adapter core LoC: $TOTAL / $BUDGET"
echo ""
echo "File breakdown:"
wc -l "${CORE_FILES[@]}"

if [ "$TOTAL" -gt "$BUDGET" ]; then
  echo ""
  echo "FAIL: Core adapter exceeds LoC budget ($TOTAL > $BUDGET)"
  exit 1
else
  echo ""
  echo "PASS: Core adapter within LoC budget"
fi
