# Integration shortlist (highest ROI first)

Prioritize **few deep connectors** over many shallow ones. Order reflects typical mid-market carbon accounting ROI: **ERP / spend** unlocks bulk Scope 3; **travel** is high churn; **cloud** is scriptable; **utilities** reduce manual bills.

| Priority | System class | Examples | Primary value | Notes |
|----------|--------------|----------|---------------|--------|
| 1 | **ERP / finance** | NetSuite, SAP S/4HANA (API), Microsoft Dynamics | Spend-based EEIO or mapped categories; GL segments for allocation | Highest leverage for Scope 3 Cat 1–2; needs mapping layer + review queue |
| 2 | **Travel & expense** | SAP Concur, Navan, Expensify | Flights, hotels, ground transport activity | Clear ownership (travel team); good for Cat 6–7 |
| 3 | **Cloud / infra** | AWS (CUR), Azure (Cost Mgmt), GCP (billing export) | Energy proxy → Scope 3 Cat 1 (cloud) or Cat 11 depending on methodology | Fits tech-heavy customers; BullMQ `integration-sync` pattern |
| 4 | **Utilities / energy** | Utility vendor portals, EDI 810, PDF bills | Scope 2 actuals vs grid average | Document AI + human review; improves Scope 2 quality |
| 5 | **HR / headcount** | Workday, BambooHR (for FTE allocation) | Allocate site/entity energy and commuter models | Secondary; supports allocation defensibility |

## Implementation pattern (already in codebase)

- Register connections in `integration_connections`; sync via **BullMQ** (`services/queue.js`, `workers/worker.js`).
- Use **circuit breakers** and **audit_log** for sync outcomes.
- Expose **webhooks** + **bulk API** for partners who push data instead of pull.

## Deprioritize initially

- Niche sustainability point tools until core ERP/T&E/cloud paths are stable.
- Real-time trading venues for offsets (compliance first).
