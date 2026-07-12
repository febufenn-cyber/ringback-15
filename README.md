# Ringback

> when a business misses a call, AI instantly calls the person back, captures their need, and texts the owner a lead card.

**Alternative to the product-shape pioneered by Sameday (YC ~W22)** — rank #15 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.1/10).

## Why this exists

Trades miss most calls; AI answering has direct revenue impact. The buildable wedge: missed-call rescue add-on rather than a full answering workforce.

## Current phase

Ringback is in **Phase 0: evidence before automation**. The repository now contains a complete validation system for selecting a vertical, auditing real missed calls, running a controlled concierge recovery experiment, calculating conservative economics, and making a documented go/no-go decision.

Start with [`phase0/README.md`](phase0/README.md).

Run the zero-dependency report generator after replacing the example CSV rows with pilot data:

```bash
python3 scripts/phase0_report.py --data-dir phase0/templates --output phase0-report.md
python3 -m unittest discover -s tests -v
```

No production callback automation should be built until the hard gates in [`phase0/07-go-no-go-scorecard.md`](phase0/07-go-no-go-scorecard.md) are satisfied.

## MVP scope

- [ ] Missed-call detection
- [ ] instant AI callback
- [ ] need capture
- [ ] lead-card SMS
- [ ] simple CRM log

## Architecture

`Workers+Supabase+Claude; Twilio call events` — Cloudflare Workers + Hono API, Supabase (Postgres + RLS + Auth + pgvector), Claude API via Agent SDK (claude-fable-5 for agent reasoning, claude-haiku-4-5 for volume), wrangler deploys.

**Integrations:** Twilio; Deepgram; ElevenLabs; WhatsApp/SMS; Sheets  
**Data:** Missed-call events; callback transcripts; lead records  
**Agent core:** Agent auto-recovers missed callers and qualifies them into leads.

## Business

| | |
|---|---|
| Monetization | $29-79/mo per line |
| First customer | Small trades and local service SMBs |
| GTM wedge | Local business groups; 'recover every missed call' hook; SEO. |
| Competition risk | Med: missed-call text-back exists |
| Regulatory/trust risk | Low in the original seed; Phase 0 treats this as unproven and region-specific |
| India angle | Missed-call culture is huge; regional-language callback; UPI booking. |
| Difficulty / build time | Low / 2-3 weeks after validation |

## Phased plan

- **Phase 0:** prove problem frequency, caller behaviour, owner action, economics, and trust.
- **Phase 1:** one-business reliable technical loop.
- **Phase 2:** closed pilot across a few businesses.
- **Phase 3:** multi-tenant productization.
- **Phase 4:** vertical intelligence and booking integrations.
- **Phase 5:** revenue attribution and scalable distribution.

---

*Built with Fable 5 (Claude Code). Blueprint row: inspired by Sameday — "AI phone workforce answering calls for home-service trades."*
