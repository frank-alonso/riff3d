# Riff3D

## What This Is

Riff3D is a web-based 3D engine/editor foundation built on a contract-first, operation-driven architecture. It supports multiple "top layers" — from fun-first party games and creator toys to professional editor workflows and enterprise tools. The foundation is AI-manipulable, collaboration-ready, and portable via a canonical representation with runtime adapters.

## Core Value

All meaningful edits flow through a deterministic operation pipeline (IQL → PatchOps → ECSON → Canonical IR → Adapters), ensuring portability, reproducibility, and safe AI-driven manipulation — this spine must never break.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Contract-first architecture: PatchOps spec, ECSON schema, Canonical IR spec fully defined
- [ ] Deterministic operation pipeline: IQL → PatchOps → ECSON → Canonical IR → Adapters
- [ ] Portable subset v0: scene graph, transforms, parenting, mesh refs, materials (baseline PBR), lights, cameras, basic animation, events/triggers
- [ ] Engine tuning / escape hatch: explicit per-engine tuning that never overrides portable semantics
- [ ] Dual web runtime adapters (PlayCanvas + Babylon.js) as universality forcing function
- [ ] Golden fixtures: 5-10 canonical projects with round-trip tests and conformance coverage
- [ ] Template-driven development with 2-template promotion rule
- [ ] Closed-loop editing: load fixture → apply ops → save ECSON → compile to Canonical IR → run in web runtime
- [ ] Collaboration-ready core: shared operation log model, conflict strategy documented
- [ ] Layered UX: creator-friendly verb-driven surface ("Add Character", "Make It Bouncy") on top of pro-capable foundation
- [ ] IQL intent language: human/AI-friendly, produces PatchOps, never mutates data directly
- [ ] ECSON schema versioning with forward migrations
- [ ] Performance budgets: load time, memory ceiling, FPS baseline for web runtime
- [ ] Adapter conformance tests per runtime target
- [ ] Golden path: Pick Template → Edit via Verbs/Tools → Play → Iterate → Save/Share

### Out of Scope

- Full engine parity across Unity/Godot/Unreal — foundation first, adapters expand later
- Perfect physics portability — physics as "capability detected" initially
- Complex shader graphs as portable features — baseline PBR only in portable subset
- Advanced IK + retargeting — stubs/fixtures only until spine is solid
- Mobile/native apps — web-first, other platforms later
- Monetization/billing systems — architecture focus, business model TBD

## Context

**Prototype reference:** A prior prototype at `/home/frank/riff3d-prototype` validated the concept but was built as a speed run, not for scalability. Its research documents and architectural explorations are informative but the codebase is not carried forward. This rebuild starts from first principles with the contracts defined in FOUNDATION.md.

**Reference codebases:** PlayCanvas engine + editor and Babylon.js + editor are cloned locally for architectural reference, convention mining, and adapter research. These are the two candidate web runtimes that will both be implemented as adapters to force schema universality.

**Market positioning:** Competing long-term with Figma (collaborative design), Unity/Unreal (3D engines), and creator platforms. The wedge is "riffing" — fast creation-to-play loops for party/mini-games — but the foundation must support professional and enterprise layers without rewriting core contracts.

**AI-first development:** The architecture is designed to be AI-manipulable. IQL provides a safe intent interface, PatchOps ensure deterministic edits, and the testing spine (golden fixtures + conformance) makes AI-generated changes verifiable. Claude Code is a primary development tool.

**Dual adapter strategy:** Both PlayCanvas and Babylon.js implemented as web runtime adapters from day one. This isn't hedging — it's a forcing function to ensure the Canonical IR and portable subset are truly engine-agnostic, preparing for eventual Unity, Godot, and R3F adapters.

## Constraints

- **Tech stack**: Next.js app, TypeScript monorepo — as specified in FOUNDATION.md repo structure
- **Architecture**: Contract-first — PatchOps, ECSON, Canonical IR specs must be defined before implementation
- **Testing**: Golden fixtures + round-trip tests required before features ship — non-negotiable
- **Portability**: Portable subset must round-trip across ECSON ↔ Canonical IR and run consistently across supported runtimes
- **Operations**: All meaningful edits flow through PatchOps — no hidden state mutations in UI or tools
- **Template rule**: Core spec expands only when a capability is needed by 2+ independent templates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dual web runtime adapters (PlayCanvas + Babylon.js) from day one | Forces schema universality; proves Canonical IR is truly engine-agnostic | — Pending |
| Contract-first development (specs before implementation) | Prevents drift, enables safe AI development, ensures portability | — Pending |
| Fun-first wedge, pro-capable foundation | Beachhead market is creators; foundation supports pivot to enterprise/pro | — Pending |
| Template-driven development with 2-template promotion rule | Keeps core minimal and avoids speculative abstraction | — Pending |
| Layered UX (creator verbs on top, pro tools beneath) | Different personas get different surfaces without separate codebases | — Pending |
| IQL as AI-facing intent layer | Safe interface for AI manipulation — produces PatchOps, never mutates directly | — Pending |
| Monorepo with package-per-concern | Enables parallel work without coupling; adapters depend on contracts, not UI | — Pending |

---
*Last updated: 2026-02-19 after initialization*
