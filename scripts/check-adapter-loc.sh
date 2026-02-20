#!/usr/bin/env bash
set -euo pipefail

# Check adapter core LoC budget (max 1500 LoC per adapter core).
#
# Core = adapter.ts + scene-builder.ts + environment.ts + types.ts + delta.ts +
#        component-mappers/*
# Editor tools (editor-tools/*) tracked separately and excluded from budget.
# Test files (__tests__/*) and index.ts are also excluded.
#
# This script validates BOTH the PlayCanvas and Babylon.js adapters.

BUDGET=1500
EXIT_CODE=0

for adapter in adapter-playcanvas adapter-babylon; do
  ADAPTER_DIR="packages/$adapter/src"

  if [ ! -d "$ADAPTER_DIR" ]; then
    echo "SKIP: $adapter (directory not found)"
    continue
  fi

  # Collect core files: adapter, scene-builder, environment, types, delta, component-mappers
  CORE_FILES=()
  for f in "$ADAPTER_DIR/adapter.ts" \
           "$ADAPTER_DIR/scene-builder.ts" \
           "$ADAPTER_DIR/environment.ts" \
           "$ADAPTER_DIR/types.ts" \
           "$ADAPTER_DIR/delta.ts"; do
    if [ -f "$f" ]; then
      CORE_FILES+=("$f")
    fi
  done

  # Include all component mapper files
  if [ -d "$ADAPTER_DIR/component-mappers" ]; then
    for f in "$ADAPTER_DIR"/component-mappers/*.ts; do
      if [ -f "$f" ]; then
        CORE_FILES+=("$f")
      fi
    done
  fi

  if [ ${#CORE_FILES[@]} -eq 0 ]; then
    echo "SKIP: $adapter (no core files found)"
    continue
  fi

  TOTAL=$(wc -l "${CORE_FILES[@]}" | tail -1 | awk '{print $1}')

  echo "=== $adapter ==="
  echo "Core LoC: $TOTAL / $BUDGET"
  echo ""
  echo "File breakdown:"
  wc -l "${CORE_FILES[@]}"

  if [ "$TOTAL" -gt "$BUDGET" ]; then
    echo ""
    echo "FAIL: $adapter exceeds LoC budget ($TOTAL > $BUDGET)"
    EXIT_CODE=1
  else
    echo ""
    echo "PASS: $adapter within LoC budget"
  fi
  echo ""
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "All adapters within LoC budget"
else
  echo "One or more adapters exceed LoC budget"
fi

exit $EXIT_CODE
