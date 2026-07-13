# Ringback

> when a business misses a call, AI instantly calls the person back, captures their need, and texts the owner a lead card.

**Alternative to the product-shape pioneered by Sameday (YC ~W22)** — rank #15 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.1/10).

## Why this exists

Trades miss most calls; AI answering has direct revenue impact. The buildable wedge: missed-call rescue add-on rather than a full answering workforce.

## Current phase

Ringback now contains the **Phase 1 one-business reliable technical loop**. It provides duplicate-safe missed-call ingestion, a waiting window, manual-callback suppression, atomic job dispatch, Twilio callback orchestration, deterministic qualification, Supabase persistence, and owner lead-card SMS.

Start with [`phase1/README.md`](phase1/README.md). The Phase 0 evidence package remains in [`phase0/README.md`](phase0/README.md).

The implementation is intentionally inactive by default. Set `BUSINESS_ACTIVE=true` only after the Phase 0 live-contact, trust, and regional compliance gates are satisfied.

```bash
npm install
npm test
npm run build
```

Phase 0 reporting remains available:

```bash
python3 scripts/phase0_report.py --data-dir phase0/templates --output phase0-report.md
python3 -m unittest discover -s tests -v
```

## MVP scope

- [x] duplicate-safe missed-call detection core
- [x] delayed callback orchestration with manual suppression
- [x] deterministic service, location, and urgency capture
- [x] owner lead-card SMS adapter
- [x] Supabase call, job, history, suppression, and lead log
- [ ] supervised live pilot completion
- [ ] owner outcome feedback loop
- [ ] multi-business onboarding and tenant isolation

## Architecture

`Cloudflare Workers + Supabase + Twilio` — a standard Worker fetch handler, Supabase Postgres with RLS and atomic claim RPC, Twilio signed webhooks, outbound calls, speech gathering, and SMS.

Phase 1 deliberately postpones free-form LLM voice reasoning, Deepgram, ElevenLabs, billing, multi-tenancy, and a full CRM until the reliable core loop survives supervised real traffic.

**Integrations:** Twilio Voice/SMS; Supabase  
**Data:** signed call events; callback jobs; state history; manual-callback suppressions; lead cards  
**Agent core:** deterministic orchestration first; bounded AI reasoning later.

## Business

| | |
|---|---|
| Monetization | $29-79/mo per line |
| First customer | Small trades and local service SMBs |
| GTM wedge | Local business groups; 'recover every missed call' hook; SEO. |
| Competition risk | Med: missed-call text-back exists |
| Regulatory/trust risk | Region-specific and must be validated before activation |
| India angle | Missed-call culture is huge; regional-language callback; UPI booking. |
| Difficulty / build time | Reliability core implemented; live validation remains |

## Phased plan

- **Phase 0:** prove problem frequency, caller behaviour, owner action, economics, and trust.
- **Phase 1:** one-business reliable technical loop — implemented, pending supervised pilot.
- **Phase 2:** closed pilot across a few businesses.
- **Phase 3:** multi-tenant productization.
- **Phase 4:** vertical intelligence and booking integrations.
- **Phase 5:** revenue attribution and scalable distribution.

---

*Built with Fable 5 (Claude Code). Blueprint row: inspired by Sameday — "AI phone workforce answering calls for home-service trades."*
