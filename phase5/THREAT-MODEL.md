# Phase 5 Threat Model

| Threat | Consequence | Control |
|---|---|---|
| duplicate provider event | duplicated revenue or commission | organization/kind/source unique keys |
| estimated value shown as cash | deceptive ROI | separate evidence strengths and revenue stages |
| mutable source evidence | untraceable historical changes | append-only triggers and correction events |
| cross-tenant identity merge | privacy breach and false attribution | organization-scoped links; cross-tenant service rejection |
| partner overreach | unauthorized customer or lead access | active assignment plus explicit scope per request |
| stale partner assignment | access after revocation | assignment checked on every operation |
| low-confidence commission | payout dispute | financial verification and minimum confidence threshold |
| refund after commission | overpayment | reversal entry linked to refund evidence |
| CRM retry duplication | duplicate contacts/opportunities | stable outbox idempotency key and payload hash |
| mixed currencies | invalid ROI | fail closed without approved conversion rule |
| small cohort disclosure | tenant inference | minimum-organization aggregation threshold |
| conflicting owner outcomes | inflated result | preserve both events, flag conflict, lower trust |

## Emergency response

Pause affected reporting or partner access after any cross-tenant exposure, evidence mutation, duplicated financial effect, unauthorized partner operation, unexplained commission discrepancy or materially misleading ROI report.
