# Verification Before Completion Rule

Core principle: Evidence before claims, always.

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

## The Gate Function
Before claiming any status or declaring completion:
1. **IDENTIFY**: What command proves this claim? (`npx tsc --noEmit`, `npm test`, build check).
2. **RUN**: Execute the full command fresh and complete.
3. **READ**: Inspect the full output, check exit code (must be 0), count test failures.
4. **VERIFY**: Does the output confirm the claim without errors?
   - If NO: State actual status with failure details and fix.
   - If YES: State claim WITH evidence.
5. **ONLY THEN**: Make the completion claim.

Never use vague assumptions ("should work", "probably fixed", "looks good") without running the actual verification command.
