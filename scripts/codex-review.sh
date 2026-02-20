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

Plan Review Options:
  --plan <plan-id>      Review a single plan (e.g., --plan 02-03)
  --synthesis           Run cross-plan synthesis review (requires per-plan reviews)
  --chunked             Auto-run all per-plan reviews, then synthesis

General Options:
  --dry-run             Show the prompt without executing
  --model <model>       Override Codex model (default: config default)
  --verbose             Show full Codex output

Examples:
  ./scripts/codex-review.sh plan-review 2                        # improved single-pass
  ./scripts/codex-review.sh plan-review 2 --plan 02-03           # review one plan
  ./scripts/codex-review.sh plan-review 2 --synthesis            # cross-plan synthesis
  ./scripts/codex-review.sh plan-review 2 --chunked              # all per-plan + synthesis
  ./scripts/codex-review.sh plan-review 2 --chunked --dry-run    # preview chunked prompts
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

# Find the phase source directory in .planning/phases/
find_phase_source_dir() {
  local phase="$1"
  local padded
  printf -v padded "%02d" "$phase"
  local match
  match=$(find "$PLANNING_DIR/phases" -maxdepth 1 -type d -name "${padded}-*" 2>/dev/null | head -1)
  if [[ -z "$match" ]]; then
    echo ""
  else
    echo "$match"
  fi
}

# List plan files in a phase source directory
list_plan_files() {
  local phase_src_dir="$1"
  find "$phase_src_dir" -maxdepth 1 -name '*-PLAN.md' -type f 2>/dev/null | sort
}

# Extract plan-id from a plan filename (e.g., 02-03-PLAN.md -> 02-03)
plan_id_from_file() {
  local filename
  filename="$(basename "$1")"
  echo "${filename%-PLAN.md}"
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

  if [[ -n "${PLAN_ID:-}" ]]; then
    cmd_plan_review_single "$phase"
  elif [[ "${SYNTHESIS:-}" == "true" ]]; then
    cmd_plan_review_synthesis "$phase"
  elif [[ "${CHUNKED:-}" == "true" ]]; then
    cmd_plan_review_chunked "$phase"
  else
    cmd_plan_review_default "$phase"
  fi
}

# --- Plan Review Sub-Modes ---

# Single plan review (--plan <plan-id>)
cmd_plan_review_single() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  local phase_src_dir
  phase_src_dir="$(find_phase_source_dir "$phase")"
  if [[ -z "$phase_src_dir" ]]; then
    echo -e "${RED}Error: Phase source directory not found in .planning/phases/${NC}"
    exit 1
  fi

  # Find the plan file matching the plan-id pattern
  local plan_file
  plan_file=$(find "$phase_src_dir" -maxdepth 1 -name "${PLAN_ID}-PLAN.md" -o -name "${PLAN_ID}-*-PLAN.md" 2>/dev/null | head -1)
  if [[ -z "$plan_file" || ! -f "$plan_file" ]]; then
    echo -e "${RED}Error: Plan file not found matching '${PLAN_ID}' in $phase_src_dir${NC}"
    echo "Available plans:"
    list_plan_files "$phase_src_dir" | while read -r f; do echo "  $(basename "$f")"; done
    exit 1
  fi

  local plan_content
  plan_content="$(cat "$plan_file")"
  local plan_basename
  plan_basename="$(basename "$plan_file")"
  local plan_id
  plan_id="$(plan_id_from_file "$plan_file")"

  echo -e "${CYAN}Reviewing plan: $plan_basename${NC}"

  local prompt
  prompt="$(build_context)

---

# Task: Per-Plan Review for Phase $phase — Plan $plan_id

You are reviewing a single plan file. Your job is to:
1. Read and evaluate the plan content provided below
2. **Verify claims against the actual codebase** — read source files referenced in the plan to confirm they exist, have the interfaces described, and match the plan's assumptions
3. Flag any discrepancies between what the plan says and what the code actually contains

## Evaluation Criteria
1. **Feasibility** — Is the approach realistic given the actual codebase state?
2. **Completeness** — Does the plan cover its stated requirements? Any gaps?
3. **Architecture alignment** — Does it respect contract-first architecture, dependency boundaries, and existing patterns?
4. **Risk assessment** — Are the identified risks real? Are there risks the plan misses?
5. **Correctness** — Do file paths, function names, and API references in the plan match the actual codebase?
6. **Test strategy** — Is the testing approach sufficient?

## Instructions
- Read the plan below carefully
- Then navigate to and read the source files referenced in the plan
- Verify that interfaces, schemas, types, and dependencies described in the plan exist as claimed
- Report any mismatches between plan assumptions and codebase reality

Write your review in markdown:

# Phase $phase Plan Review — $plan_id
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)
Plan: $plan_basename

## Codebase Verification
(What you checked in the source code, what matched, what didn't)

## Feasibility
## Completeness
## Architecture Alignment
## Risk Assessment
## Correctness
## Test Strategy
## Summary
- Key concerns:
- Recommended adjustments:

---

## Plan File: $plan_basename

$plan_content"

  local output_file="$phase_dir/PHASE_${phase}_PLAN_REVIEW_${plan_id}.md"
  run_codex "$prompt" "$output_file"
}

# Cross-plan synthesis review (--synthesis)
cmd_plan_review_synthesis() {
  local phase="$1"
  local phase_dir
  phase_dir="$(ensure_phase_dir "$phase")"

  # Read thin summary
  local summary_file="$phase_dir/PHASE_${phase}_PLAN_SUMMARY.md"
  if [[ ! -f "$summary_file" ]]; then
    echo -e "${RED}Error: Plan summary not found at $summary_file${NC}"
    echo "Claude must create the plan summary before synthesis review."
    exit 1
  fi
  local summary
  summary="$(cat "$summary_file")"

  # Collect all per-plan review files (match plan-id pattern: digits-digits)
  local per_plan_reviews=""
  local review_count=0
  for review_file in "$phase_dir"/PHASE_${phase}_PLAN_REVIEW_*.md; do
    [[ -f "$review_file" ]] || continue
    # Skip non-plan-id files (e.g., PLAN_REVIEW_RESPONSE.md)
    local suffix
    suffix="$(basename "$review_file" .md)"
    suffix="${suffix##*PLAN_REVIEW_}"
    [[ "$suffix" =~ ^[0-9]+-[0-9]+$ ]] || continue
    per_plan_reviews+="
---
## $(basename "$review_file")

$(cat "$review_file")
"
    review_count=$((review_count + 1))
  done

  if [[ "$review_count" -eq 0 ]]; then
    echo -e "${RED}Error: No per-plan review files found in $phase_dir${NC}"
    echo "Run per-plan reviews first (--plan or --chunked)."
    exit 1
  fi

  echo -e "${CYAN}Synthesizing $review_count per-plan reviews...${NC}"

  local prompt
  prompt="$(build_context)

---

# Task: Cross-Plan Synthesis Review for Phase $phase

You have access to $review_count individual plan reviews completed earlier. Your job is to evaluate cross-cutting concerns that only become visible when looking at all plans together.

## Focus Areas
1. **Dependency coherence** — Do plan execution orders and wave assignments make sense? Are there hidden dependencies between plans that aren't declared?
2. **Contract consistency** — Do plans that touch the same schemas/types/interfaces agree on their shape? Any conflicting assumptions?
3. **Scope risk** — Is the total scope across all plans realistic for one phase? Are there signs of scope creep?
4. **Requirement coverage gaps** — Cross-reference the requirement IDs in the summary against what the individual plans actually deliver. Any gaps?
5. **Integration risk** — Where plans build on each other's output, are the handoff points well-defined?

## Instructions
- Read the plan summary (thin index) for phase context and requirement IDs
- Read all per-plan reviews to understand individual plan quality
- Focus on cross-plan concerns — individual plan issues are already captured
- Read actual plan files from disk if you need to verify cross-plan interactions

Write your synthesis review in markdown:

# Phase $phase Plan Review (Synthesis)
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Dependency Coherence
## Contract Consistency
## Scope Risk
## Requirement Coverage
## Integration Risk
## Summary
- Key cross-plan concerns:
- Recommended adjustments:

---

## Plan Summary (Index):

$summary

---

## Per-Plan Reviews:

$per_plan_reviews"

  local output_file="$phase_dir/PHASE_${phase}_PLAN_REVIEW.md"
  run_codex "$prompt" "$output_file"
}

# Chunked auto-run: all per-plan reviews then synthesis (--chunked)
cmd_plan_review_chunked() {
  local phase="$1"

  local phase_src_dir
  phase_src_dir="$(find_phase_source_dir "$phase")"
  if [[ -z "$phase_src_dir" ]]; then
    echo -e "${RED}Error: Phase source directory not found in .planning/phases/${NC}"
    exit 1
  fi

  local plan_files
  mapfile -t plan_files < <(list_plan_files "$phase_src_dir")
  local total=${#plan_files[@]}

  if [[ "$total" -eq 0 ]]; then
    echo -e "${RED}Error: No plan files found in $phase_src_dir${NC}"
    exit 1
  fi

  echo -e "${CYAN}Chunked review: $total plans + synthesis${NC}"
  echo ""

  # Run per-plan reviews
  local i=0
  for plan_file in "${plan_files[@]}"; do
    i=$((i + 1))
    local plan_id
    plan_id="$(plan_id_from_file "$plan_file")"
    echo -e "${CYAN}[$i/$total] Reviewing plan $plan_id...${NC}"
    PLAN_ID="$plan_id" cmd_plan_review_single "$phase"
    echo ""
  done

  # Run synthesis
  echo -e "${CYAN}[Synthesis] Running cross-plan synthesis review...${NC}"
  SYNTHESIS=true cmd_plan_review_synthesis "$phase"

  echo ""
  echo -e "${GREEN}Chunked review complete: $total per-plan reviews + 1 synthesis${NC}"
}

# Default improved single-pass (no flags)
cmd_plan_review_default() {
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

  # Find plan file paths to include in the prompt
  local phase_src_dir
  phase_src_dir="$(find_phase_source_dir "$phase")"
  local plan_paths_list=""
  if [[ -n "$phase_src_dir" ]]; then
    while IFS= read -r f; do
      [[ -n "$f" ]] && plan_paths_list+="- $f"$'\n'
    done < <(list_plan_files "$phase_src_dir")
  fi

  local prompt
  prompt="$(build_context)

---

# Task: Pre-Execution Plan Review for Phase $phase

Review the plan summary below, then **read the actual plan files and verify claims against the codebase**.

## Important Instructions
The summary below is a lightweight index. To do a thorough review, you MUST:
1. Read each plan file listed in the summary from disk
2. Read key source files referenced in the plans to verify assumptions
3. Check that file paths, interfaces, schemas, and dependencies described in plans match reality
4. Do NOT rely solely on the summary — it is an index, not the full picture

## Plan Files to Read
$plan_paths_list

## Evaluation Criteria
1. **Feasibility** — Is the approach realistic given the actual codebase state and dependencies?
2. **Completeness** — Does the plan cover all requirements listed for this phase? Any gaps?
3. **Architecture alignment** — Does it respect the contract-first architecture, dependency boundaries, and existing patterns?
4. **Risk assessment** — Are the identified risks real? Are there risks the plan misses?
5. **Alternative approaches** — Would a different strategy be simpler, more robust, or better aligned?
6. **Test strategy** — Is the testing approach sufficient to prove the success criteria?

Write your review in markdown format following this structure:

# Phase $phase Plan Review
Date: $(date +%Y-%m-%d)
Auditor: Codex (gpt-5.3-codex)

## Codebase Verification
(What you checked in the source code, what matched, what didn't)

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

## Plan Summary (Index):

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
PLAN_ID="${PLAN_ID:-}"
SYNTHESIS="${SYNTHESIS:-false}"
CHUNKED="${CHUNKED:-false}"
MODEL_ARGS=()

# Parse global options from end of args
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --model) MODEL_ARGS=(-m "$2"); shift 2 ;;
    --prompt) AD_HOC_PROMPT="$2"; shift 2 ;;
    --plan) PLAN_ID="$2"; shift 2 ;;
    --synthesis) SYNTHESIS=true; shift ;;
    --chunked) CHUNKED=true; shift ;;
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
