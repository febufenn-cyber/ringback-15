import { loadBusinessConfig, type Env } from "./config.js";
import { RingbackCoordinator } from "./coordinator.js";
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
import type { ManualCallback } from "./types.js";

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

function text(value: string, status: number): Response {
  return new Response(value, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
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
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return constantTimeEqual(header, expected);
}

function createCoordinator(env: Env): RingbackCoordinator {
  const business = loadBusinessConfig(env);
  const repository = new SupabaseRepository(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    business.id,
  );
  const telephony = new TwilioGateway(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return new RingbackCoordinator(repository, telephony, business);
}

function publicRequestUrl(request: Request, env: Env): string {
  const incoming = new URL(request.url);
  const base = loadBusinessConfig(env).publicBaseUrl;
  return `${base}${incoming.pathname}${incoming.search}`;
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
  return `${loadBusinessConfig(env).publicBaseUrl}${path}?job=${encodeURIComponent(jobId)}`;
}

export async function dispatchDue(env: Env): Promise<unknown> {
  return createCoordinator(env).dispatchDueJobs();
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      const config = loadBusinessConfig(env);
      return json({ ok: true, phase: 1, businessActive: config.active });
    }

    if (request.method === "POST" && url.pathname === "/webhooks/twilio/inbound-status") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const event = parseTwilioProgressEvent(form, "inbound", new Date());
      const result = await createCoordinator(env).handleInboundEvent(event);
      return json(result);
    }

    if (request.method === "POST" && url.pathname === "/webhooks/twilio/outbound-status") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const event = parseTwilioProgressEvent(form, "outbound", new Date());
      const result = await createCoordinator(env).handleOutboundEvent(event, requireJobId(request));
      return json({ accepted: true, result });
    }

    if (request.method === "POST" && url.pathname === "/voice/start") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      await createCoordinator(env).beginQualification(callSid(form), jobId);
      const config = loadBusinessConfig(env);
      return xml(
        startQualificationTwiML(config.name, actionUrl(env, "/voice/service", jobId)),
      );
    }

    if (request.method === "POST" && url.pathname === "/voice/service") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const answer = speech(form);
      if (!answer) {
        return xml(
          startQualificationTwiML(
            loadBusinessConfig(env).name,
            actionUrl(env, "/voice/service", jobId),
            true,
          ),
        );
      }
      await createCoordinator(env).captureAnswer(callSid(form), "serviceNeed", answer, jobId);
      return xml(locationTwiML(actionUrl(env, "/voice/location", jobId)));
    }

    if (request.method === "POST" && url.pathname === "/voice/location") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const answer = speech(form);
      if (!answer) return xml(locationTwiML(actionUrl(env, "/voice/location", jobId), true));
      await createCoordinator(env).captureAnswer(callSid(form), "location", answer, jobId);
      return xml(urgencyTwiML(actionUrl(env, "/voice/urgency", jobId)));
    }

    if (request.method === "POST" && url.pathname === "/voice/urgency") {
      const form = await verifiedTwilioForm(request, env);
      if (!form) return text("invalid signature", 403);
      const jobId = requireJobId(request);
      const answer = speech(form);
      if (!answer) return xml(urgencyTwiML(actionUrl(env, "/voice/urgency", jobId), true));
      await createCoordinator(env).captureAnswer(callSid(form), "urgency", answer, jobId);
      return xml(completeTwiML());
    }

    if (request.method === "POST" && url.pathname === "/internal/dispatch-due") {
      if (!authorizedInternal(request, env.INTERNAL_SECRET)) return text("unauthorized", 401);
      return json(await dispatchDue(env));
    }

    if (request.method === "POST" && url.pathname === "/internal/manual-callback") {
      if (!authorizedInternal(request, env.INTERNAL_SECRET)) return text("unauthorized", 401);
      const payload = (await request.json()) as {
        callerNumber?: string;
        source?: ManualCallback["source"];
      };
      if (!payload.callerNumber) return json({ error: "callerNumber is required" }, 400);
      const result = await createCoordinator(env).recordManualCallback(
        payload.callerNumber,
        payload.source ?? "owner",
      );
      return json(result, 201);
    }

    return text("not found", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    return json({ error: message.slice(0, 300) }, 500);
  }
}
