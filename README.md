# Ringback

> when a business misses a call, AI instantly calls the person back, captures their need, and texts the owner a lead card.

**Alternative to the product-shape pioneered by Sameday (YC ~W22)** — rank #15 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.1/10).

## Why this exists
Trades miss most calls; AI answering has direct revenue impact. The buildable wedge: missed-call rescue add-on rather than a full answering workforce.

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
| Regulatory/trust risk | Low |
| India angle | Missed-call culture is huge; regional-language callback; UPI booking. |
| Difficulty / build time | Low / 2-3 weeks |

## 30-day plan
- **W1:** core loop — Missed-call detection + instant AI callback
- **W2:** need capture + lead-card SMS + simple CRM log + auth + billing
- **W3:** polish, instrument events, seed first users via: Local business groups; 'recover every missed call' hook; SEO.
- **W4:** launch + first revenue; kill/scale decision

---
*Built with Fable 5 (Claude Code). Blueprint row: inspired by Sameday — "AI phone workforce answering calls for home-service trades."*