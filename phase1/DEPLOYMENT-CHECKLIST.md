# Phase 1 Deployment Checklist

- [ ] Phase 0 permits live contact in the target region.
- [ ] Dedicated Twilio subaccount created with low spend alerts and hard caps.
- [ ] Owned or verified callback number configured and checked for SMS support.
- [ ] Supabase migration applied to a dedicated project.
- [ ] Worker secrets set outside source control.
- [ ] `PUBLIC_BASE_URL` exactly matches the URL configured in Twilio.
- [ ] `BUSINESS_ACTIVE=false` during setup and replay testing.
- [ ] Twilio webhook signature tests pass against the deployed URL.
- [ ] Duplicate inbound and outbound webhooks replay safely.
- [ ] Two concurrent dispatcher requests produce one outbound call.
- [ ] Manual-callback suppression endpoint is wired to the pilot process.
- [ ] Emergency stop procedure tested.
- [ ] Retention and deletion procedure documented.
- [ ] Supervised test numbers allowlisted before real callers.
- [ ] `BUSINESS_ACTIVE=true` enabled only for the approved window.
- [ ] Every live attempt reviewed the same day.
