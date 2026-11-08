# Systematic Debugging Rule

Core principle: ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

## The Four Phases
1. **Root Cause Investigation**:
   - Read error messages & stack traces completely (note lines, files, error codes).
   - Reproduce consistently with exact steps.
   - Check git diff and recent changes.
   - For multi-component systems (UI -> store -> database / hardware), trace boundaries.
2. **Pattern Analysis**:
   - Find working vs failing cases.
   - Isolate variables to identify the single differentiating factor.
3. **Hypothesis & Targeted Minimal Fix**:
   - Form testable hypothesis explaining why it broke.
   - Apply the smallest fix that addresses the root cause directly.
4. **Verification**:
   - Verify the original issue is resolved and no regressions are introduced.
