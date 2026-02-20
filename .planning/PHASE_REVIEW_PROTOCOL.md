# Phase Review Protocol (Claude Driver + Codex Auditor)

**Date:** 2026-02-19  
**Purpose:** Standardize a repeatable phase loop where Claude drives roadmap delivery and Codex performs independent technical audits at each gate.

## Roles

1. `Claude (Driver)`
- Plans and executes roadmap work.
- Produces phase artifacts and evidence packets.
- Responds to review findings with fixes or rebuttals.

2. `Codex (Auditor)`
- Reviews plans before execution for feasibility, completeness, and architectural alignment (advisory).
- Reviews evidence after execution against contracts, requirements, and gate criteria (gate decision).
- Issues findings with severity and acceptance status.
- Produces final gate recommendation.

## Review Cadence

Each phase has **two review points** — an optional pre-execution review (advisory) and a mandatory post-execution review (gate decision):

### Pre-Execution Review (Advisory — Optional for Standard Phases)
Run after planning is complete, before execution begins.

**When to run pre-execution review:**
- **Mandatory:** Review Gate phases (3, 6, 11) and novel-architecture phases (9 — AI/IQL is genuinely new territory).
- **Optional:** Standard delivery phases (4, 5, 7, 8, 10). Skip unless the phase introduces new architectural patterns that benefit from a second opinion before coding.
- **Rationale:** The GSD plan checker validates plan structure (wave conflicts, dependencies, requirement coverage). Codex reviewing plans in isolation adds limited value for standard phases because it can't deeply verify against codebase state. Post-execution review — where Codex audits real code against real contracts — is where the independent reviewer adds the most value.

**When it runs:**

1. Claude completes phase research and planning (RESEARCH.md, PLAN.md files).
2. Claude publishes a plan summary to `.planning/reviews/phase-<N>/PHASE_<N>_PLAN_SUMMARY.md`.
3. Codex writes `PHASE_<N>_PLAN_REVIEW.md` — flags concerns, blind spots, alternative approaches.
4. Claude writes `PHASE_<N>_PLAN_REVIEW_RESPONSE.md` — adjustments or rebuttals.
5. No formal gate — this review is **advisory, not blocking**. Claude proceeds to execution incorporating feedback at their judgment.

**When it's skipped:**

Claude creates a brief `PHASE_<N>_PLAN_REVIEW_SKIPPED.md` noting: "Pre-execution review skipped — standard delivery phase. Post-execution review will be run."

### Post-Execution Review (Gate Decision)
Run after all plans in a phase are executed (and optionally after each major plan):

1. Claude executes phase work.
2. Claude publishes evidence packet.
3. Codex writes `PHASE_<N>_REVIEW.md`.
4. Claude writes `PHASE_<N>_REVIEW_RESPONSE.md`.
5. Codex writes `PHASE_<N>_FINAL_REVIEW.md`.
6. Gate decision: `PASS`, `PASS_WITH_CONDITIONS`, or `FAIL`.

## Directory and File Convention

All files live in `.planning/reviews/phase-<N>/`.

Pre-execution review files:
- `PHASE_<N>_PLAN_SUMMARY.md` (Claude — thin index pointing to plan files and key sources)
- `PHASE_<N>_PLAN_REVIEW.md` (Codex — concerns, blind spots, alternatives; or synthesis review)
- `PHASE_<N>_PLAN_REVIEW_<XX-YY>.md` (Codex — per-plan review, used in chunked mode)
- `PHASE_<N>_PLAN_REVIEW_RESPONSE.md` (Claude — adjustments or rebuttals)

Post-execution review files:
- `PHASE_<N>_EVIDENCE.md` (Claude)
- `PHASE_<N>_REVIEW.md` (Codex)
- `PHASE_<N>_REVIEW_RESPONSE.md` (Claude)
- `PHASE_<N>_FINAL_REVIEW.md` (Codex)
- `PHASE_<N>_DECISION.md` (Claude writes, capturing Codex's final gate ruling as the formal record)

Optional:
- `artifacts/` (benchmarks, screenshots, logs, schema diffs, replay traces)

## Pre-Execution Review: Plan Summary Contract (Claude)

`PHASE_<N>_PLAN_SUMMARY.md` is a **thin index** that points Codex to the actual plan files and key source files. It does NOT re-summarize plan content — Codex reads the plans directly.

The summary should include:

1. Phase Goal
   - What this phase delivers and why it matters.
   - Requirement IDs covered.
   - Success criteria (from roadmap).

2. Plan Files
   - Table of plan files with paths and one-sentence descriptions.
   - Codex reads these files directly — the summary is just an index.

3. Key Source Files for Auditor
   - List of key packages/files the auditor should inspect to verify plan claims.
   - Focus on files that plans reference or depend on.

4. Key Constraints and Decisions
   - From CONTEXT.md — locked user decisions that plans must respect.
   - Architecture rules particularly relevant to this phase.

5. Questions for Auditor
   - Specific areas where a second opinion would be valuable.

The summary deliberately omits Approach, Contract Impact, and Risks sections — these exist in the plan files themselves and should be verified by Codex directly rather than re-summarized by Claude.

## Pre-Execution Review: Plan Review Rubric (Codex)

Codex evaluates the plan against these categories (no formal scoring — narrative feedback):

1. **Feasibility** — Is the approach realistic given the codebase state and dependencies?
2. **Completeness** — Does the plan cover all requirements listed for this phase? Are there gaps?
3. **Architecture alignment** — Does the approach respect the contract-first architecture, dependency boundaries, and existing patterns?
4. **Risk assessment** — Are the identified risks real? Are there risks the plan misses?
5. **Alternative approaches** — Would a different strategy be simpler, more robust, or better aligned with downstream phases?
6. **Test strategy** — Is the testing approach sufficient to prove the success criteria?

## Evidence Packet Contract (Claude)

`PHASE_<N>_EVIDENCE.md` must include the sections below. Sections that do not apply to a given phase should be marked **"N/A — not applicable to this phase"** with a brief reason (e.g., "No rendering in Phase 1" or "No adapter changes in Phase 9"). This keeps the structure consistent while avoiding fabricated evidence.

1. Scope
- Planned goals vs completed goals.
- Requirement IDs touched.

2. Contract Diffs
- PatchOps, ECSON, Canonical IR, component registry changes.
- Explicit breaking/non-breaking classification.

3. Test Evidence
- Unit/integration/property test results.
- Golden fixture changes and why.
- Conformance output (semantic + visual where relevant).

4. Performance Evidence
- Current metrics vs baseline budgets.
- Regression notes and mitigations.

5. Risk Register
- Known gaps, deferred work, assumptions.

6. Decision Requests
- Specific items needing auditor ruling.

## Audit Rubric (Codex)

Codex scores each category: `PASS`, `CONCERN`, `FAIL`.

1. Contract Integrity
- No ungoverned drift.
- Versioning/migrations present when required.

2. Determinism and Safety
- PatchOps invariants hold.
- No direct mutation bypass of operation spine.

3. Test Depth
- Fixtures updated meaningfully.
- Property-based and adversarial coverage where applicable.

4. Conformance Quality
- Semantic checks exact.
- Visual checks within approved tolerances.

5. Performance Envelope
- Meets budget or has approved exception.

6. Modularity Boundaries
- Feature work respects capability-pack seams.
- No adapter internals leaked into portable contracts.

## Severity Model for Findings

Use:
- `S0 Blocker`: must fix before phase pass.
- `S1 High`: significant risk; fix or formally waive with owner/date.
- `S2 Medium`: important quality concern; can pass with condition.
- `S3 Low`: improvement item.

Each finding format:
- `ID`
- `Severity`
- `Location`
- `Issue`
- `Impact`
- `Required action`

## Gate Decision Rules

`PASS`:
- No `S0/S1` open.
- Required tests green.
- No unapproved performance regressions.

`PASS_WITH_CONDITIONS`:
- No `S0`.
- `S1` explicitly waived with owner/date and mitigation plan.

`FAIL`:
- Any `S0` open.
- Or unresolved contract drift / determinism break.

## Definition of Done (Phase)

A phase is complete only when:

1. Pre-execution plan review is completed, explicitly skipped (standard phases), or deferred per Auditor Unavailable rules.
2. Evidence packet is complete.
3. Post-execution review and response loop is completed.
4. Final review decision is recorded.
5. Follow-up actions are scheduled in roadmap/state docs.

## Automation: codex-review.sh

The review protocol is automated via `scripts/codex-review.sh`. This script wraps `codex exec` with Riff3D architecture context and the review rubrics defined above.

```bash
# Pre-execution plan review (after Claude creates PLAN_SUMMARY)
./scripts/codex-review.sh plan-review <N>                   # improved single-pass
./scripts/codex-review.sh plan-review <N> --plan XX-YY      # single plan
./scripts/codex-review.sh plan-review <N> --chunked         # per-plan + synthesis
./scripts/codex-review.sh plan-review <N> --synthesis       # synthesis only

# Post-execution evidence review (after Claude creates EVIDENCE)
./scripts/codex-review.sh post-review <N>

# Final gate decision (after Claude creates REVIEW_RESPONSE)
./scripts/codex-review.sh final-review <N>

# Mid-phase checkpoint
./scripts/codex-review.sh checkpoint <N>

# Ad-hoc review of specific files
./scripts/codex-review.sh ad-hoc <files...> --prompt "Custom instructions"
```

Options: `--dry-run` (show prompt without executing), `--verbose` (full output), `--model <name>` (override model).

Plan review modes: `--plan <id>` (single plan), `--chunked` (all per-plan + synthesis), `--synthesis` (synthesis only, requires existing per-plan reviews).

Codex runs in **read-only sandbox** mode — it can read the codebase but cannot modify it.

## MCP vs Console Guidance

Preferred: `codex-review.sh` script (console automation).

The script provides:
- Architecture context injection (pipeline rules, conventions, stack).
- Template-driven output matching the file conventions above.
- Read-only sandbox for safety.
- Ephemeral sessions (no persistent Codex state).

Use MCP if/when Codex MCP integration becomes available with API key auth.

## Fallback: Auditor Unavailable

If Codex is out of tokens, rate-limited, or otherwise unavailable:

1. Claude still produces the relevant artifacts (plan summary for pre-execution, evidence packet for post-execution).
2. The phase may proceed with a `DEFERRED_REVIEW` status.
3. A `PHASE_<N>_REVIEW_DEFERRED.md` (or `PHASE_<N>_PLAN_REVIEW_DEFERRED.md` for pre-execution) is created in the phase review directory noting:
   - Reason for deferral (e.g., "Codex token limit reached").
   - Date of deferral.
   - Expected resolution window.
4. Deferred reviews **must** be completed before the next Review Gate phase (3, 6, or 11). Review Gates cannot proceed with outstanding deferred reviews.
5. If multiple phases are deferred, Codex reviews them in order when available — earlier phases first, since later phases may build on their findings.

## Relationship with Review Gate Phases (3, 6, 11)

The per-phase review loop (described above) runs after every delivery phase. Review Gate phases (3, 6, 11) are **expanded-scope reviews** that go beyond the standard per-phase audit:

1. **Cross-phase integration** — Does everything built across the preceding phases work together end-to-end?
2. **Cumulative debt assessment** — Review all `PASS_WITH_CONDITIONS` decisions from prior phases. Are conditions being met? Is technical debt accumulating?
3. **Architecture drift** — Has the implementation drifted from the original contracts, architecture rules, or design intent?
4. **Carry-forward reconciliation** — Are all carry-forward actions from prior phase reviews resolved or explicitly re-scheduled?

Review Gate phases still produce the standard review files but with these additional sections in the evidence packet and audit rubric.

## Phase Complexity and Mid-Phase Checkpoints

For phases with 5 or more plans (Phases 1, 2, 7, 8), consider a **mid-phase checkpoint review** — a lightweight version of the full review loop run after approximately half the plans are complete. This catches architectural issues early rather than discovering them at phase end when rework is expensive.

Mid-phase checkpoints:
- Use the same file convention but with a `-checkpoint` suffix (e.g., `PHASE_1_EVIDENCE-checkpoint.md`).
- Focus on contract integrity and modularity boundaries (the categories most likely to reveal structural problems).
- Do not require a formal gate decision — the checkpoint produces findings only.
- Are optional and triggered by Claude's judgment or the user's request.

## Chunked Review Process (Large Phases)

For phases with 5 or more plans, the pre-execution review uses a **chunked** approach instead of a single monolithic pass:

### Per-Plan Reviews
Each plan is reviewed individually. Codex reads the actual plan file content and verifies claims against the codebase. Output: `PHASE_<N>_PLAN_REVIEW_<XX-YY>.md` per plan.

### Synthesis Review
After all per-plan reviews complete, a synthesis review evaluates cross-cutting concerns:
- Dependency coherence between plans
- Contract consistency across plans touching the same schemas
- Scope risk across all plans combined
- Requirement coverage gaps
- Integration risk at plan handoff points

Output: `PHASE_<N>_PLAN_REVIEW.md` (the standard output file).

### When to Use
- **5+ plans**: Use `--chunked` (automatic in GSD workflow)
- **< 5 plans**: Use default improved single-pass (Codex reads plan files from disk)
- **Single plan**: Use `--plan <plan-id>` for targeted review

### Commands
```bash
# Chunked: all per-plan reviews + synthesis
./scripts/codex-review.sh plan-review <N> --chunked

# Single plan review
./scripts/codex-review.sh plan-review <N> --plan XX-YY

# Synthesis only (after per-plan reviews exist)
./scripts/codex-review.sh plan-review <N> --synthesis

# Default improved single-pass
./scripts/codex-review.sh plan-review <N>
```

## Templates

### Pre-Execution Review Templates

## `PHASE_<N>_PLAN_SUMMARY.md`

```md
# Phase <N> Plan Summary (Index)
Date:
Owner:
Phase:

## Phase Goal
- Goal: (from roadmap)
- Requirement IDs:
- Success Criteria: (from roadmap)

## Plan Files
| Plan | File Path | One-Sentence Description |
|------|-----------|--------------------------|
| XX-01 | `.planning/phases/<dir>/XX-01-PLAN.md` | ... |
| XX-02 | `.planning/phases/<dir>/XX-02-PLAN.md` | ... |

## Key Source Files for Auditor
- (list key packages/files the auditor should inspect to verify claims)

## Key Constraints and Decisions
- (from CONTEXT.md — locked user decisions that plans must respect)

## Questions for Auditor
- (specific areas where a second opinion adds value)
```

## `PHASE_<N>_PLAN_REVIEW.md`

```md
# Phase <N> Plan Review
Date:
Auditor:

## Feasibility
- ...

## Completeness
- ...

## Architecture Alignment
- ...

## Risk Assessment
- ...

## Alternative Approaches
- ...

## Test Strategy
- ...

## Summary
- Key concerns:
- Recommended adjustments:
```

## `PHASE_<N>_PLAN_REVIEW_RESPONSE.md`

```md
# Phase <N> Plan Review Response
Date:
Owner:

## Review Value Assessment
<!-- Score: HIGH / MEDIUM / LOW -->
<!-- Actionable items: <count> of <total findings> changed what we will do -->
<!-- Brief note on whether the review caught risks or issues that would have grown -->
Score: HIGH | MEDIUM | LOW
Actionable: X of Y findings led to plan or execution changes
Notes: (1-2 sentences on what the review contributed)

## Responses
- Concern:
  - Agree/Disagree:
  - Adjustment made:

## Remaining Open Questions
- ...
```

### Post-Execution Review Templates

## `PHASE_<N>_EVIDENCE.md`

```md
# Phase <N> Evidence
Date:
Owner:
Phase:

## Scope
- Planned:
- Completed:
- Requirement IDs:

## Contract Diffs
- PatchOps:
- ECSON:
- Canonical IR:
- Registry:
- Breaking changes:

## Tests
- Unit/Integration:
- Property-based invariants:
- Golden fixture updates:
- Adversarial corpus:
- Conformance:

## Performance
- Metric table:
- Regressions:

## Risks and Deferrals
- ...

## Decisions Requested
- ...
```

## `PHASE_<N>_REVIEW.md`

```md
# Phase <N> Review
Date:
Auditor:

## Findings
1. [Sx] ...

## Rubric Assessment
- Contract Integrity:
- Determinism and Safety:
- Test Depth:
- Conformance Quality:
- Performance Envelope:
- Modularity Boundaries:

## Preliminary Decision
- PASS | PASS_WITH_CONDITIONS | FAIL
```

## `PHASE_<N>_REVIEW_RESPONSE.md`

```md
# Phase <N> Review Response
Date:
Owner:

## Review Value Assessment
<!-- Score: HIGH / MEDIUM / LOW -->
<!-- HIGH = caught real issues that changed implementation or prevented bugs -->
<!-- MEDIUM = useful observations, some led to minor improvements -->
<!-- LOW = mostly confirmatory, no actionable changes -->
Score: HIGH | MEDIUM | LOW
Actionable: X of Y findings led to code or process changes
Notes: (1-2 sentences on what the review contributed)

## Responses to Findings
- Finding ID:
  - Agree/Disagree:
  - Action taken:
  - Evidence:

## Remaining Risks
- ...
```

## `PHASE_<N>_FINAL_REVIEW.md`

```md
# Phase <N> Final Review
Date:
Auditor:

## Final Findings Status
- Resolved:
- Open with conditions:
- Open blockers:

## Final Decision
- PASS | PASS_WITH_CONDITIONS | FAIL

## Required Follow-ups
1. ...
```

## `PHASE_<N>_DECISION.md`

```md
# Phase <N> Decision
Date:
Decision:
Approvers:

## Conditions (if any)
- ...

## Carry-forward Actions
1. ...
```

## Startup Checklist (Do This Now)

1. Create `.planning/reviews/` directory.
2. Adopt this protocol for Phase 1 immediately.
3. Enforce evidence packet completion before any phase gate review.
4. Keep all review docs in repo for auditability and drift analysis.
