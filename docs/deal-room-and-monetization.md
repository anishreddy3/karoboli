# Deal rooms, pricing and monetization

## Product decision

Karoboli uses one negotiation room per RFQ with two role-safe views. It is not
two separate products.

### Buyer view

- Private budget, target and autonomous negotiation ceiling.
- Invited suppliers and comparable offers.
- Live transcript, corrections and commitments.
- Deterministic policy result and human approval state.
- Purchase order, evidence digest and audit export.

### Supplier view

- Shared specification, quantity, location and deadline.
- The supplier's own offer, corrections and commitments.
- Clarification requests and the shared final outcome.
- Documents the supplier must confirm.

The supplier must never receive the buyer's maximum budget, competing offers,
internal policy rules or approval discussion. The in-app perspective switch is
a buildathon demonstration of these views, not a production authorization
boundary. Production requires server-enforced identity and field-level access.

## Demo placement

The room should appear as the consequence of the voice negotiation:

1. Capture the buyer requirement.
2. Capture a supplier's Hinglish correction.
3. Show the shared room update.
4. Switch briefly from buyer to supplier view to prove the information
   boundary.
5. Apply guardrails and end on the PO and evidence record.

Do not tour the room as a standalone dashboard. The primary Sarvam judging
parameter remains Voice Experience.

## Who pays

The buyer organization pays. Supplier participation is free. This keeps
supplier onboarding friction low and aligns the product with the party that
receives time savings, policy control and auditability.

## Packaging

| Plan | Indicative price | Intended scope |
|---|---:|---|
| Design Partner Starter | ₹5,000/month | One workspace, browser voice, negotiation rooms, commitment tracking and evidence |
| Growth | ₹20,000–₹30,000/month | Multiple buyers, approval workflows, supplier comparison, telephony and analytics |
| Enterprise | ₹75,000+/month | ERP integration, SSO, retention controls, dedicated numbers and support |

Voice and telephony should use an included allowance followed by metered
overage. Do not publish an exact per-minute price until Sarvam, carrier,
recording, storage and support costs are measured.

Avoid a procurement-value take rate in the first version. It creates
attribution disputes and can make buyers question whether Karoboli is
optimizing savings or transaction volume.

## Bottom-up market model

The official Udyam factsheet reported 5,40,500 small and 41,709 medium
enterprises on 26 July 2026, approximately 5.82 lakh formal small and medium
accounts. Using the ₹5,000/month Starter price:

| Layer | Assumption | Annual recurring revenue |
|---|---:|---:|
| Broad account TAM | 5.82 lakh accounts × ₹60,000 | approximately ₹3,493 crore |
| Initial SAM | 10% have recurring multilingual supplier negotiation | approximately ₹349 crore |
| Three-year SOM | 500 paying companies | ₹3 crore |
| Higher SOM case | 1,000 paying companies | ₹6 crore |

The 10% serviceable share is a planning assumption and must be validated through
design-partner interviews. Do not use all 9.1 crore Udyam and UAP registrations
as the revenue TAM; most are micro-enterprises outside the initial buyer profile.

Government procurement provides market validation rather than Karoboli revenue
TAM. GeM crossed ₹5 lakh crore in FY 2025–26 and ₹18.4 lakh crore cumulatively,
showing that Indian procurement is already moving toward digital, auditable
workflows.

Sources:

- [Official Udyam registration factsheet](https://www.udyamregistration.gov.in/)
- [Government of India: GeM FY 2025–26 milestone](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2249335&lang=2&reg=48)

## Initial customer profile

Start with regional construction contractors, building-material distributors
and light manufacturers that have:

- 10–100 recurring suppliers;
- multilingual procurement staff;
- frequent phone or WhatsApp negotiation;
- approval limits that can be expressed as deterministic policy;
- and a visible cost of reconstructing verbal commitments.

The first commercial objective is paid design partners, not marketplace
liquidity.

## Buildathon Q&A answer

> Buyers pay a workspace subscription because they receive the policy controls,
> approval workflow and audit trail; suppliers join free through a lightweight
> link or phone call. We start at ₹5,000 per month for design partners, then add
> usage-based voice and higher tiers for telephony, approvals and ERP
> integration. A conservative bottom-up account TAM across registered small and
> medium enterprises is roughly ₹3,493 crore in annual software revenue, with a
> much narrower initial segment in construction and light manufacturing.
