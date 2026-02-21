# Phase 5 Deferred Items

## Pre-existing Lint Errors (Out of Scope)

1. **editor-shell.tsx:149** - `setProjectReady(true)` called synchronously within an effect triggers `react-hooks/set-state-in-effect` error. This is a React 19 lint rule that was not enforced when the code was written. The pattern is intentional (signals store readiness to viewport) but should be refactored to use a ref or external state signal.

2. **rls-integration.test.ts:48** - `userBId` assigned but never used warning. Pre-existing test infrastructure issue.
