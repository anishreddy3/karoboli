# Karoboli backlog

Post-buildathon hardening work that already exists as **open pull requests**. Leave them open until you intentionally merge or close each one — they are real branches with proposed changes, not empty issue stubs.

## Security

- [ ] #15 — Fix LLM prompt injection via user transcript

## Testing

- [ ] #14 — Missing-key error test for `sarvamFetch`
- [ ] #13 — Non-ok response test for `sarvamFetch`
- [ ] #11 — Tests for `sarvamConfigured` helper
- [ ] #10 — Coverage for `providerErrorResponse`
- [ ] #8 — `evaluateOffer` happy-path tests
- [ ] #7 / #4 / #5 — `evaluateOffer` rejection / policy coverage
- [ ] #6 — Tests for `ProviderUnavailableError`
- [ ] #3 — Tests for `createPurchaseOrder` in `policy.ts`

## Performance

- [ ] #16 — Optimize redundant array iteration in `evaluateOffer`
- [ ] #12 — Optimize static date instantiation
- [ ] #9 — Optimize `dateIsPlausible`

## Process

- [ ] #2 — Merge milestones to `develop` (only if multi-branch workflow returns)

Added during profile cleanup on 2026-10-26 so the PR list has a single index.
