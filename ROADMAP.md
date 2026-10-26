# Karoboli roadmap

Hardening work from open PRs #3–#16 was reviewed and consolidated into
`cursor/consolidate-hardening-prs-9dfc` (merged 2026-10-26). Overlapping
single-purpose PRs were closed as superseded by that consolidation.

## Landed in consolidation

| Area | What shipped | Source PRs |
| --- | --- | --- |
| Security | Transcript isolation for `/api/understand` (`<transcript>` fencing + tag strip) | #15 |
| Policy | `evaluateOffer` / `createPurchaseOrder` coverage; failed-check label reuse | #3 #4 #5 #7 #8 #16 |
| Sarvam | Provider error, config, and `sarvamFetch` failure tests | #6 #10 #11 #13 #14 |
| Perf | Cached date bounds / year in requirement reconciliation | #9 #12 |

## Closed without merge

| PR | Reason |
| --- | --- |
| #2 Merge all milestones to develop | Obsolete — `main` already contains those milestones and is ahead of the PR head |

## Follow-ups (optional)

- Add an explicit unit test that `/api/understand` strips forged `</transcript>` tags before prompting
- Consider renaming `fortyguard`-style challenge docs if this repo is reused for demos
