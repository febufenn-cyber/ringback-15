import type {
  CallDirection,
  CallProgressEvent,
  CallStatus,
  SendLeadRequest,
  SendLeadResult,
  StartCallbackRequest,
  StartCallbackResult,
  TelephonyGateway,
} from "./types.js";

const VALID_STATUSES = new Set<CallStatus>([
  "queued",
  "initiated",
  "ringing",
  "in-progress",
  "completed",
  "busy",
  "failed",
  "no-answer",
  "canceled",
]);

const VALID_DIRECTIONS = new Set<CallDirection>(["inbound", "outbound-api", "outbound-dial"]);

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function computeTwilioSignature(
  authToken: string,
  publicRequestUrl: string,
  form: URLSearchParams,
): Promise<string> {
  const entries = [...form.entries()].sort(([leftKey], [rightKey]) =>
    leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0,
  );
  let payload = publicRequestUrl;
  for (const [key, value] of entries) {
    payload += key + value;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64(signature);
}

export async function validateTwilioSignature(
  authToken: string,
  publicRequestUrl: string,
  form: URLSearchParams,
  providedSignature: string | null,
): Promise<boolean> {
  if (!providedSignature) {
    return false;
  }
  const expected = await computeTwilioSignature(authToken, publicRequestUrl, form);
  return constantTimeEqual(expected, providedSignature);
}

function parseSequence(value: string | null): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseDuration(value: string | null): number | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseTwilioProgressEvent(
  form: URLSearchParams,
  eventKind: "inbound" | "outbound",
  fallbackNow: Date,
): CallProgressEvent {
  const providerCallSid = form.get("CallSid")?.trim() ?? "";
  if (!providerCallSid) {
    throw new Error("Twilio event is missing CallSid");
  }

  const rawStatus = form.get("CallStatus")?.trim() as CallStatus | undefined;
  if (!rawStatus || !VALID_STATUSES.has(rawStatus)) {
    throw new Error(`Unsupported Twilio CallStatus: ${rawStatus ?? "missing"}`);
  }

  const rawDirection = form.get("Direction")?.trim() as CallDirection | undefined;
  const direction = rawDirection && VALID_DIRECTIONS.has(rawDirection) ? rawDirection : "unknown";
  const sequenceNumber = parseSequence(form.get("SequenceNumber"));
  const timestamp = form.get("Timestamp")?.trim();
  const parsedTimestamp = timestamp ? Date.parse(timestamp) : Number.NaN;
  const occurredAt = Number.isNaN(parsedTimestamp)
    ? fallbackNow.toISOString()
    : new Date(parsedTimestamp).toISOString();

  const event: CallProgressEvent = {
    provider: "twilio",
    providerEventKey: `twilio:${eventKind}:${providerCallSid}:${sequenceNumber}:${rawStatus}`,
    providerCallSid,
    sequenceNumber,
    direction,
    status: rawStatus,
    from: form.get("From")?.trim() ?? form.get("Caller")?.trim() ?? "",
    to: form.get("To")?.trim() ?? form.get("Called")?.trim() ?? "",
    occurredAt,
  };

  const callDurationSeconds = parseDuration(form.get("CallDuration"));
  if (callDurationSeconds !== undefined) {
    event.callDurationSeconds = callDurationSeconds;
  }
  const parentCallSid = form.get("ParentCallSid")?.trim();
  if (parentCallSid) {
    event.parentCallSid = parentCallSid;
  }
  const callbackSource = form.get("CallbackSource")?.trim();
  if (callbackSource) {
    event.callbackSource = callbackSource;
  }

  return event;
}

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function parseTwilioResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : response.statusText;
    throw new Error(`Twilio request failed (${response.status}): ${message}`);
  }
  return payload;
}

export class TwilioGateway implements TelephonyGateway {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async startCallback(request: StartCallbackRequest): Promise<StartCallbackResult> {
    const body = new URLSearchParams();
    body.append("To", request.to);
    body.append("From", request.from);
    body.append("Url", request.voiceUrl);
    body.append("Method", "POST");
    body.append("StatusCallback", request.statusCallbackUrl);
    body.append("StatusCallbackMethod", "POST");
    for (const event of ["initiated", "ringing", "answered", "completed"]) {
      body.append("StatusCallbackEvent", event);
    }
    body.append("Timeout", "20");
    body.append("Record", "false");

    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls.json`,
      {
        method: "POST",
        headers: {
          authorization: basicAuth(this.accountSid, this.authToken),
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const payload = await parseTwilioResponse(response);
    if (typeof payload.sid !== "string" || !payload.sid) {
      throw new Error("Twilio call response did not include a call SID");
    }
    return { callSid: payload.sid };
  }

  async sendLeadMessage(request: SendLeadRequest): Promise<SendLeadResult> {
    const body = new URLSearchParams({
      To: request.to,
      From: request.from,
      Body: request.body,
    });
    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: basicAuth(this.accountSid, this.authToken),
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const payload = await parseTwilioResponse(response);
    if (typeof payload.sid !== "string" || !payload.sid) {
      throw new Error("Twilio message response did not include a message SID");
    }
    return { messageSid: payload.sid };
  }
}
