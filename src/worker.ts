import { loadGlobalConfig, type Env } from "./config.js";
import { RingbackCoordinator } from "./coordinator.js";
import { FeedbackTokenService } from "./feedback-token.js";
import { normalizePhoneNumber } from "./policy.js";
import { SupabasePilotStore } from "./pilot-store.js";
import { SupabaseRepository } from "./supabase-repository.js";
import {
  parseTwilioProgressEvent,
  TwilioGateway,
  validateTwilioSignature,
} from "./twilio.js";
import {
  completeTwiML,
  locationTwiML,
  startQualificationTwiML,
  urgencyTwiML,
} from "./twiml.js";
import type {
  BusinessConfig,
  ManualCallback,
  OwnerFeedback,
  OwnerFeedbackOutcome,
  PilotBusinessInput,
  PilotIncident,
  PilotMode,
} from "./types.js";

const FEEDBACK_OUTCOMES = new Set<OwnerFeedbackOutcome>([
  "acknowledged", "contacted", "booked", "won", "lost", "not_lead", "unreachable",
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function xml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    },
  });
}

function text(value: string, status: number): Response {
  return new Response(value, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value: string, limit: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function authorizedInternal(request: Request, secret: string): boolean {
  return constantTimeEqual(
    request.headers.get("authorization") ?? "",
    `Bearer ${secret}`,
  );
}

function pilotStore(env: Env): SupabasePilotStore {
  const config = loadGlobalConfig(env);
  return new SupabasePilotStore(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    config.publicBaseUrl,
  );
}

function feedbackTokens(env: Env): FeedbackTokenService {
  const config = loadGlobalConfig(env);
  return new FeedbackTokenService(
    config.feedbackSigningSecret,
    config.publicBaseUrl,
    config.defaultFeedbackTtlHours,
  );
}

function createCoordinator(
  env: Env,
  business: BusinessConfig,
  store = pilotStore(env),
): RingbackCoordinator {
  const repository = new SupabaseRepository(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    business.id,
  );
  const telephony = new TwilioGateway(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return new RingbackCoordinator(
    repository,
    telephony,
    business,
    undefined,
    store,
    feedbackTokens(env),
  );
}

function publicRequestUrl(request: Request, env: Env): string {
  const incoming = new URL(request.url);
  return `${loadGlobalConfig(env).publicBaseUrl}${incoming.pathname}${incoming.search}`;
}

async function verifiedTwilioForm(request: Request, env: Env): Promise<URLSearchParams | null> {
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const valid = await validateTwilioSignature(
    env.TWILIO_AUTH_TOKEN,
    publicRequestUrl(request, env),
    form,
    request.headers.get("x-twilio-signature"),
  );
  return valid ? form : null;
}

function requireJobId(request: Request): string {
  const jobId = new URL(request.url).searchParams.get("job")?.trim();
  if (!jobId) throw new Error("Missing callback job identifier");
  return jobId;
}

function callSid(form: URLSearchParams): string {
  const value = form.get("CallSid")?.trim();
  if (!value) throw new Error("Missing CallSid");
  return value;
}

function speech(form: URLSearchParams): string {
  return form.get("SpeechResult")?.trim() ?? "";
}

function actionUrl(env: Env, path: string, jobId: string): string {
  return `${loadGlobalConfig(env).publicBaseUrl}${path}?job=${encodeURIComponent(jobId)}`;
}

function publicBusiness(business: BusinessConfig): Record<string, unknown> {
  return {
    id: business.id,
    name: business.name,
    inboundNumber: business.inboundNumber,
    callbackNumber: business.callbackNumber,
    ownerNumber: business.ownerNumber,
    pilotMode: business.pilotMode,
    active: business.active,
    callbackDelaySeconds: business.callbackDelaySeconds,
    callerCooldownMinutes: business.callerCooldownMinutes,
    maxCallbackAttempts: business.maxCallbackAttempts,
    dailyCallbackLimit: business.dailyCallbackLimit,
    timezone: business.timezone,
    feedbackTtlHours: business.feedbackTtlHours,
    blockedCallers: [...business.blockedCallers],
    allowedCallers: [...(business.allowedCallers ?? new Set<string>())],
  };
}

async function businessForJob(
  env: Env,
  jobId: string,
  store = pilotStore(env),
): Promise<BusinessConfig> {
  const business = await store.getBusinessForJob(jobId);
  if (!business) throw new Error("Unknown callback job or pilot business");
  return business;
}

function feedbackPage(
  business: BusinessConfig,
  lead: {
    callerNumber: string;
    serviceNeed: string;
    location: string;
    urgency: string;
  },
  submitted = false,
): string {
  const masked = lead.callerNumber.length > 4
    ? `${"*".repeat(Math.max(0, lead.callerNumber.length - 4))}${lead.callerNumber.slice(-4)}`
    : "caller";
  const buttons = [
    ["acknowledged", "Seen"],
    ["contacted", "Contacted"],
    ["booked", "Booked"],
    ["won", "Job won"],
    ["lost", "Lost"],
    ["not_lead", "Not a lead"],
    ["unreachable", "Unreachable"],
  ].map(([value, label]) =>
    `<button type="submit" name="outcome" value="${value}">${label}</button>`,
  ).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ringback lead outcome</title>
<style>
body{font-family:system-ui,sans-serif;max-width:580px;margin:40px auto;padding:0 18px;line-height:1.5}
.card{border:1px solid #ddd;border-radius:14px;padding:20px}
button{margin:6px 5px 0 0;padding:10px 14px}input,textarea{width:100%;box-sizing:border-box;padding:10px;margin:5px 0 12px}
small{color:#555}.ok{background:#eefbea;padding:10px;border-radius:8px}
</style></head><body>
<h1>${escapeHtml(business.name)}</h1>
${submitted ? '<p class="ok">Outcome saved. You may update it again from this link.</p>' : ""}
<div class="card">
<p><strong>Caller:</strong> ${escapeHtml(masked)}</p>
<p><strong>Need:</strong> ${escapeHtml(lead.serviceNeed)}</p>
<p><strong>Area:</strong> ${escapeHtml(lead.location)}</p>
<p><strong>Urgency:</strong> ${escapeHtml(lead.urgency)}</p>
<form method="post">
<label>Revenue if won (optional)</label><input name="revenue" inputmode="decimal" type="number" min="0" max="1000000000" step="0.01">
<label>Private note (optional)</label><textarea name="notes" maxlength="500"></textarea>
<div>${buttons}</div>
</form>
<small>No caller recording is shown here. This signed link expires automatically.</small>
</div></body></html>`;
}

async function resolveFeedback(
  request: Request,
  env: Env,
): Promise<{
  store: SupabasePilotStore;
  business: BusinessConfig;
  lead: NonNullable<Awaited<ReturnType<SupabasePilotStore["getLeadById"]>>>;
} | null> {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("business")?.trim() ?? "";
  const leadId = url.searchParams.get("lead")?.trim() ?? "";
  const exp = Number.parseInt(url.searchParams.get("exp") ?? "", 10);
  const sig = url.searchParams.get("sig")?.trim() ?? "";
  if (!businessId || !leadId || !sig) return null;

  const valid = await feedbackTokens(env).verify(
    businessId,
    leadId,
    exp,
    sig,
    new Date(),
  );
  if (!valid) return null;

  const store = pilotStore(env);
  const business = await store.getBusinessById(businessId);
  const lead = await store.getLeadById(businessId, leadId);
  return business && lead ? { store, business, lead } : null;
}

export async function dispatchDue(env: Env): Promise<unknown> {
  const config = loadGlobalConfig(env);
  if (!config.pilotGlobalActive) {
    return { active: false, results: [] };
  }
  const store = pilotStore(env);
  const businesses = await store.listDispatchableBusinesses();
  const results: Array<{ businessId: string; results: unknown }> = [];
  for (const business of businesses) {
    results.push({
      businessId: business.id,
      results: await createCoordinator(env, business, store).dispatchDueJobs(),
    });
  }
  return { active: true, results };
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      const config = loadGlobalConfig(env);
      return json({ ok: true, phase: 2, pilotGlobalActive: config.pilotGlobalActive });
    }

    if (url.pathname === "/feedback" && request.method === "GET") {
      const resolved = await resolveFeedback(request, env);
      if (!resolved) return text("invalid or expired feedback link", 403);
      return html(feedbackPage(resolved.business, resolved.lead));
    }

    if (url.pathname === "/feedback" && request.method === "POST") {
      const resolved = await resolveFeedback(request, env);
      if (!resolved) return text("invalid or expired feedback link", 403);
      const form = new URLSearchParams(await request.text());
      const outcome = form.get("outcome")?.trim() as OwnerFeedbackOutcome | undefined;
      if (!outcome || !FEEDBACK_OUTCOMES.has(outcome)) {
        return text("invalid outcome", 400);
      }
      const rawRevenue = form.get("revenue")?.trim() ?? "";
      const revenue = rawRevenue ? Number(rawRevenue) : undefined;
      if (revenue !== undefined && (!Number.isFinite(revenue) || revenue < 0 || revenue > 1_000_000_000)) {
        return text("invalid revenue", 400);
      }
      const notes = cleanText(form.get("notes") ?? "", 500);
      const feedback: OwnerFeedback = {
        leadCardId: resolved.lead.id,
        businessId: resolved.business.id,
        outcome,
        submittedAt: new Date().toISOString(),
      };
      if (revenue !== undefined) feedback.revenueAmount = revenue;
      if (notes) feedback.notes = notes;
      await resolved.store.recordOwnerFeedback(feedback);
      return html(feedbackPage(resolved.business, resolved.lead, true));
    }

    if (request.method === "POST" && url.pathname === "/webhooks/twilio/inbound-status") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const event = parseTwilioProgressEvent(form, "inbound", new Date());
      const destination = normalizePhoneNumber(event.to);
      if (!destination) return json({ accepted: true, reason: "invalid_destination" });
      const store = pilotStore(env);
      const business = await store.getBusinessByInboundNumber(destination);
      if (!business) return json({ accepted: true, reason: "unknown_business_number" });
      const globallyActive = loadGlobalConfig(env).pilotGlobalActive;
      const effectiveBusiness = globallyActive ? business : { ...business, active: false };
      const result = await createCoordinator(env, effectiveBusiness, store).handleInboundEvent(event);
      return json(result);
    }

    if (request.method === "POST" && url.pathname === "/webhooks/twilio/outbound-status") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const store = pilotStore(env);
      const business = await businessForJob(env, jobId, store);
      const event = parseTwilioProgressEvent(form, "outbound", new Date());
      const result = await createCoordinator(env, business, store).handleOutboundEvent(event, jobId);
      return json({ accepted: true, result });
    }

    if (request.method === "POST" && url.pathname === "/voice/start") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const store = pilotStore(env);
      const business = await businessForJob(env, jobId, store);
      await createCoordinator(env, business, store).beginQualification(callSid(form), jobId);
      return xml(
        startQualificationTwiML(business.name, actionUrl(env, "/voice/service", jobId)),
      );
    }

    if (request.method === "POST" && url.pathname === "/voice/service") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const store = pilotStore(env);
      const business = await businessForJob(env, jobId, store);
      const answer = speech(form);
      if (!answer) {
        return xml(
          startQualificationTwiML(
            business.name,
            actionUrl(env, "/voice/service", jobId),
            true,
          ),
        );
      }
      await createCoordinator(env, business, store).captureAnswer(
        callSid(form), "serviceNeed", answer, jobId,
      );
      return xml(locationTwiML(actionUrl(env, "/voice/location", jobId)));
    }

    if (request.method === "POST" && url.pathname === "/voice/location") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const store = pilotStore(env);
      const business = await businessForJob(env, jobId, store);
      const answer = speech(form);
      if (!answer) return xml(locationTwiML(actionUrl(env, "/voice/location", jobId), true));
      await createCoordinator(env, business, store).captureAnswer(
        callSid(form), "location", answer, jobId,
      );
      return xml(urgencyTwiML(actionUrl(env, "/voice/urgency", jobId)));
    }

    if (request.method === "POST" && url.pathname === "/voice/urgency") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const store = pilotStore(env);
      const business = await businessForJob(env, jobId, store);
      const answer = speech(form);
      if (!answer) return xml(urgencyTwiML(actionUrl(env, "/voice/urgency", jobId), true));
      await createCoordinator(env, business, store).captureAnswer(
        callSid(form), "urgency", answer, jobId,
      );
      return xml(completeTwiML());
    }

    if (url.pathname.startsWith("/internal/") && !authorizedInternal(request, env.INTERNAL_SECRET)) {
      return text("unauthorized", 401);
    }

    if (request.method === "POST" && url.pathname === "/internal/dispatch-due") {
      return json(await dispatchDue(env));
    }

    if (request.method === "POST" && url.pathname === "/internal/manual-callback") {
      const payload = (await request.json()) as {
        businessId?: string;
        callerNumber?: string;
        source?: ManualCallback["source"];
      };
      if (!payload.businessId || !payload.callerNumber) {
        return json({ error: "businessId and callerNumber are required" }, 400);
      }
      const store = pilotStore(env);
      const business = await store.getBusinessById(payload.businessId);
      if (!business) return json({ error: "unknown business" }, 404);
      const result = await createCoordinator(env, business, store).recordManualCallback(
        payload.callerNumber,
        payload.source ?? "owner",
      );
      return json(result, 201);
    }

    if (request.method === "GET" && url.pathname === "/internal/pilot/businesses") {
      const businesses = await pilotStore(env).listBusinesses();
      return json(businesses.map(publicBusiness));
    }

    if (request.method === "POST" && url.pathname === "/internal/pilot/businesses") {
      const input = (await request.json()) as PilotBusinessInput;
      const business = await pilotStore(env).upsertBusiness(input);
      return json(publicBusiness(business), 201);
    }

    if (request.method === "POST" && url.pathname === "/internal/pilot/mode") {
      const payload = (await request.json()) as { businessId?: string; mode?: PilotMode };
      if (!payload.businessId || !payload.mode) {
        return json({ error: "businessId and mode are required" }, 400);
      }
      const business = await pilotStore(env).setPilotMode(payload.businessId, payload.mode);
      return json(publicBusiness(business));
    }

    if (request.method === "POST" && url.pathname === "/internal/pilot/incident") {
      const payload = (await request.json()) as Partial<PilotIncident>;
      if (!payload.businessId || !payload.severity || !payload.category || !payload.description) {
        return json({ error: "businessId, severity, category, and description are required" }, 400);
      }
      const incident: PilotIncident = {
        id: payload.id ?? `inc_${crypto.randomUUID()}`,
        businessId: payload.businessId,
        severity: payload.severity,
        category: cleanText(payload.category, 80),
        description: cleanText(payload.description, 500),
        status: payload.status ?? "open",
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
      };
      if (payload.resolvedAt) incident.resolvedAt = payload.resolvedAt;
      await pilotStore(env).recordIncident(incident);
      return json(incident, 201);
    }

    if (request.method === "GET" && url.pathname === "/internal/pilot/summary") {
      return json(await pilotStore(env).getPilotSummary());
    }

    return text("not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    return json({ error: message.slice(0, 300) }, 500);
  }
}
