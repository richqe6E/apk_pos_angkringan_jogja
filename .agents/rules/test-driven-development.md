# Test-Driven Development (TDD) Rule

Core principle: If you didn't watch the test fail, you don't know if it tests the right thing.

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

## The Red-Green-Refactor Cycle
1. **RED**: Write one minimal test showing what should happen. Run the test and verify it fails for the expected reason.
2. **GREEN**: Write the minimal code necessary to make the test pass. Verify all tests pass.
3. **REFACTOR**: Clean up any duplication, preserve conventions, and keep code lazy and minimal (Ponytail standard). Verify tests stay green.
