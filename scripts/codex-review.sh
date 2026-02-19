#!/usr/bin/env bash
set -euo pipefail

# Codex Independent Reviewer for Riff3D
# Automates the Phase Review Protocol (PHASE_REVIEW_PROTOCOL.md)
# Uses OpenAI Codex CLI as an independent auditor of Claude's work.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REVIEWS_DIR="$PROJECT_ROOT/.planning/reviews"
PLANNING_DIR="$PROJECT_ROOT/.planning"
PROMPTS_DIR="$SCRIPT_DIR/codex-prompts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
  cat <<'USAGE'
Usage: codex-review.sh <command> <phase> [options]

Commands:
  plan-review <N>       Review phase plan (pre-execution advisory)
  post-review <N>       Review phase evidence (post-execution gate)
  final-review <N>      Final review after response (gate decision)
  checkpoint <N>        Mid-phase checkpoint review
  ad-hoc <files...>     Ad-hoc review of specific files with custom prompt

Options:
  --dry-run             Show the prompt without executing
  --model <model>       Override Codex model (default: config default)
  --verbose             Show full Codex output

Examples:
  ./scripts/codex-review.sh plan-review 1
  ./scripts/codex-review.sh post-review 1
  ./scripts/codex-review.sh final-review 1
  ./scripts/codex-review.sh checkpoint 1
  ./scripts/codex-review.sh ad-hoc packages/ecson/src/schema.ts --prompt "Review for Zod best practices"
USAGE
  exit 1
}

# Build architecture context that gets prepended to every review prompt
build_context() {
  cat <<'CTX'
# Riff3D Architecture Context (for Independent Auditor)

You are an independent technical auditor reviewing work on the Riff3D project.
Riff3D is a web-based 3D engine/editor with a contract-first, operation-driven architecture.

## Core Pipeline (Non-Negotiable)
IQL → PatchOps → ECSON → Canonical IR → Adapters (PlayCanvas + Babylon.js)

## Architecture Rules
1. ALL mutations flow through PatchOps — no direct ECSON mutation
2. Contracts before implementation — Zod schemas exist before code using them
3. Adapters read Canonical IR only — never touch ECSON or PatchOps
4. 2-template promotion rule — core schema expands only when 2+ templates need it
5. Editor is React; viewport is engine-native canvas; bridge is Zustand store
6. Package deps: ecson → patchops → canonical-ir → adapters → editor (no cycles)

## Stack
- Next.js 16 + React 19 + TypeScript 5 strict + Tailwind 4
- PlayCanvas ~2.16 (primary), Babylon.js ~8.51 (validation)
- Zustand ^5, Zod ^4.3, Yjs ^13.6, Supabase, Vitest ^4, Playwright ^1.58
- Monorepo: pnpm + Turborepo

## Coding Conventions
- TypeScript strict: no `any`, no implicit returns, no unchecked index access
- Zod schemas are source of truth — derive types with z.infer<>
- PatchOps are discriminated unions with type field + typed payload + inverse
- Entity IDs use nanoid
- Every PatchOp needs: apply test, inverse test, replay determinism test
- Adapter LoC budget: <1500 lines each

## Your Role
You are the Codex Auditor. You provide an independent second opinion.
Be specific, cite file paths and line numbers when possible.
Use severity levels: S0 (blocker), S1 (high), S2 (medium), S3 (low).
CTX
}

# Ensure phase review directory exists
ensure_phase_dir() {
  local phase="$1"
  local dir="$REVIEWS_DIR/phase-$phase"
  mkdir -p "$dir"
  echo "$dir"
}

# Run codex exec with a prompt, write output to file
run_codex() {
  local prompt="$1"
  local output_file="$2"
  local extra_args=("${@:3}")

  echo -e "${CYAN}Running Codex review...${NC}"
  echo -e "${CYAN}Output: $output_file${NC}"

  if [[ "${DRY_RUN:-}" == "true" ]]; then
    echo -e "${YELLOW}[DRY RUN] Prompt:${NC}"
    echo "$prompt"
    return 0
  fi

  # Write prompt to temp file for stdin
  local tmp_prompt
  tmp_prompt="$(mktemp)"
  echo "$prompt" > "$tmp_prompt"

  codex exec \
    -C "$PROJECT_ROOT" \
    -o "$output_file" \
    -s read-only \
    --ephemeral \
    "${extra_args[@]}" \
    "$(cat "$tmp_prompt")" 2>&1 | if [[ "${VERBOSE:-}" == "true" ]]; then cat; else tail -5; fi

  rm -f "$tmp_prompt"

  if [[ -f "$output_file" ]]; then
    echo -e "${GREEN}Review written to: $output_file${NC}"
  else
    echo -e "${RED}Error: Codex did not produce output${NC}"
    return 1
  fi
}

# --- Review Commands ---

cmd_plan_review() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  local summary_file="$phase_dir/PHASE_${phase}_PLAN_SUMMARY.md"
  if [[ ! -f "$summary_file" ]]; then
    echo -e "${RED}Error: Plan summary not found at $summary_file${NC}"
    echo "Claude must create the plan summary before Codex can review it."
    exit 1
  fi

  local summary
  summary="$(cat "$summary_file")"

  local prompt
  prompt="$(build_context)

---

# Task: Pre-Execution Plan Review for Phase $phase

Review the following plan summary. Evaluate it against these criteria:

1. **Feasibility** — Is the approach realistic given the codebase state and dependencies?
2. **Completeness** — Does the plan cover all requirements listed for this phase? Any gaps?
3. **Architecture alignment** — Does it respect the contract-first architecture, dependency boundaries, and existing patterns?
4. **Risk assessment** — Are the identified risks real? Are there risks the plan misses?
5. **Alternative approaches** — Would a different strategy be simpler, more robust, or better aligned?
6. **Test strategy** — Is the testing approach sufficient to prove the success criteria?

Write your review in markdown format following this structure:

# Phase $phase Plan Review
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Feasibility
## Completeness
## Architecture Alignment
## Risk Assessment
## Alternative Approaches
## Test Strategy
## Summary
- Key concerns:
- Recommended adjustments:

---

## Plan Summary to Review:

$summary"

  local output_file="$phase_dir/PHASE_${phase}_PLAN_REVIEW.md"
  run_codex "$prompt" "$output_file"
}

cmd_post_review() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  local evidence_file="$phase_dir/PHASE_${phase}_EVIDENCE.md"
  if [[ ! -f "$evidence_file" ]]; then
    echo -e "${RED}Error: Evidence packet not found at $evidence_file${NC}"
    echo "Claude must create the evidence packet before Codex can review it."
    exit 1
  fi

  local evidence
  evidence="$(cat "$evidence_file")"

  # Also include plan review response if it exists (for context)
  local extra_context=""
  local response_file="$phase_dir/PHASE_${phase}_PLAN_REVIEW_RESPONSE.md"
  if [[ -f "$response_file" ]]; then
    extra_context="

## Plan Review Response (for context):

$(cat "$response_file")"
  fi

  local prompt
  prompt="$(build_context)

---

# Task: Post-Execution Review for Phase $phase

Review the evidence packet below. Score each category: PASS, CONCERN, or FAIL.

## Audit Rubric
1. **Contract Integrity** — No ungoverned drift. Versioning/migrations present when required.
2. **Determinism and Safety** — PatchOps invariants hold. No direct mutation bypass.
3. **Test Depth** — Fixtures updated meaningfully. Property-based and adversarial coverage where applicable.
4. **Conformance Quality** — Semantic checks exact. Visual checks within tolerances.
5. **Performance Envelope** — Meets budget or has approved exception.
6. **Modularity Boundaries** — Feature work respects package seams. No adapter internals leaked.

## Severity Levels for Findings
- S0 Blocker: must fix before phase pass
- S1 High: significant risk; fix or formally waive
- S2 Medium: important quality concern; can pass with condition
- S3 Low: improvement item

Each finding needs: ID, Severity, Location, Issue, Impact, Required action.

Write your review in markdown:

# Phase $phase Review
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Findings
## Rubric Assessment
## Preliminary Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

---

## Evidence Packet to Review:

$evidence
$extra_context"

  local output_file="$phase_dir/PHASE_${phase}_REVIEW.md"
  run_codex "$prompt" "$output_file"
}

cmd_final_review() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  local review_file="$phase_dir/PHASE_${phase}_REVIEW.md"
  local response_file="$phase_dir/PHASE_${phase}_REVIEW_RESPONSE.md"

  if [[ ! -f "$review_file" ]]; then
    echo -e "${RED}Error: Initial review not found at $review_file${NC}"
    exit 1
  fi
  if [[ ! -f "$response_file" ]]; then
    echo -e "${RED}Error: Review response not found at $response_file${NC}"
    echo "Claude must respond to the initial review before final review."
    exit 1
  fi

  local review
  review="$(cat "$review_file")"
  local response
  response="$(cat "$response_file")"

  local prompt
  prompt="$(build_context)

---

# Task: Final Review for Phase $phase

You previously reviewed Phase $phase and raised findings. Claude has responded with fixes and rebuttals.
Evaluate whether the responses adequately address each finding. Issue your final gate decision.

## Gate Decision Rules
- PASS: No S0/S1 open. Required tests green. No unapproved performance regressions.
- PASS_WITH_CONDITIONS: No S0. S1 explicitly waived with owner/date and mitigation plan.
- FAIL: Any S0 open. Or unresolved contract drift / determinism break.

Write your final review in markdown:

# Phase $phase Final Review
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Final Findings Status
- Resolved:
- Open with conditions:
- Open blockers:

## Final Decision (PASS | PASS_WITH_CONDITIONS | FAIL)

## Required Follow-ups

---

## Your Initial Review:

$review

---

## Claude's Response:

$response"

  local output_file="$phase_dir/PHASE_${phase}_FINAL_REVIEW.md"
  run_codex "$prompt" "$output_file"
}

cmd_checkpoint() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  local prompt
  prompt="$(build_context)

---

# Task: Mid-Phase Checkpoint Review for Phase $phase

This is a lightweight mid-phase checkpoint. Focus on:
1. **Contract integrity** — Are schemas and types consistent so far?
2. **Modularity boundaries** — Are package dependency directions respected?

Review the current state of the codebase. Read relevant source files in the packages/ directory.
Report findings only (no formal gate decision).

Write in markdown:

# Phase $phase Checkpoint Review
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Contract Integrity Findings
## Modularity Boundary Findings
## Summary"

  local output_file="$phase_dir/PHASE_${phase}_EVIDENCE-checkpoint.md"
  run_codex "$prompt" "$output_file"
}

cmd_ad_hoc() {
  local custom_prompt="${AD_HOC_PROMPT:-Review the following files for correctness, architectural alignment, and potential issues.}"
  local files=("$@")

  if [[ ${#files[@]} -eq 0 ]]; then
    echo -e "${RED}Error: No files specified for ad-hoc review${NC}"
    usage
  fi

  # Read file contents
  local file_contents=""
  for f in "${files[@]}"; do
    if [[ -f "$PROJECT_ROOT/$f" ]]; then
      file_contents+="
--- File: $f ---
$(cat "$PROJECT_ROOT/$f")
"
    elif [[ -f "$f" ]]; then
      file_contents+="
--- File: $f ---
$(cat "$f")
"
    else
      echo -e "${YELLOW}Warning: File not found: $f${NC}"
    fi
  done

  local prompt
  prompt="$(build_context)

---

# Task: Ad-Hoc Code Review

$custom_prompt

$file_contents"

  local output_file="$REVIEWS_DIR/ad-hoc/review-$(date +%Y%m%d-%H%M%S).md"
  mkdir -p "$(dirname "$output_file")"
  run_codex "$prompt" "$output_file"
}

# --- Main ---

DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
MODEL_ARGS=()

# Parse global options from end of args
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --model) MODEL_ARGS=(-m "$2"); shift 2 ;;
    --prompt) AD_HOC_PROMPT="$2"; shift 2 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL[@]}"

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  plan-review)
    [[ -z "${1:-}" ]] && { echo -e "${RED}Error: Phase number required${NC}"; usage; }
    cmd_plan_review "$1"
    ;;
  post-review)
    [[ -z "${1:-}" ]] && { echo -e "${RED}Error: Phase number required${NC}"; usage; }
    cmd_post_review "$1"
    ;;
  final-review)
    [[ -z "${1:-}" ]] && { echo -e "${RED}Error: Phase number required${NC}"; usage; }
    cmd_final_review "$1"
    ;;
  checkpoint)
    [[ -z "${1:-}" ]] && { echo -e "${RED}Error: Phase number required${NC}"; usage; }
    cmd_checkpoint "$1"
    ;;
  ad-hoc)
    cmd_ad_hoc "$@"
    ;;
  *)
    usage
    ;;
esac
