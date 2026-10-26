# Karoboli backlog

Post-buildathon hardening items, consolidated from open issues so the issue tracker stays quiet until active work resumes.

## Security

- [ ] Fix LLM prompt injection via user transcript (#15)

## Testing

- [ ] Missing-key error test for `sarvamFetch` (#14)
- [ ] Non-ok response test for `sarvamFetch` (#13)
- [ ] Tests for `sarvamConfigured` helper (#11)
- [ ] Coverage for `providerErrorResponse` (#10)
- [ ] `evaluateOffer` happy-path tests (#8)
- [ ] `evaluateOffer` rejection-path coverage (#7, #4, #5)
- [ ] Tests for `ProviderUnavailableError` (#6)
- [ ] Comprehensive `evaluateOffer` policy coverage (#5)
- [ ] Tests for `createPurchaseOrder` in `policy.ts` (#3)

## Performance

- [ ] Optimize redundant array iteration in `evaluateOffer` (#16)
- [ ] Optimize static date instantiation (#12)
- [ ] Optimize `dateIsPlausible` (#9)

## Process

- [ ] Merge milestones to `develop` (#2) — revisit only if multi-branch workflow returns

Tracked issues were closed as **not planned** on 2026-10-26 during profile cleanup; reopen any item when picking it up.
