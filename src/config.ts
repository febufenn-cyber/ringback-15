import { normalizePhoneNumber } from "./policy.js";
import type { BusinessConfig } from "./types.js";

export interface Env {
  BUSINESS_ID: string;
  BUSINESS_NAME: string;
  BUSINESS_PHONE_E164: string;
  CALLBACK_FROM_E164: string;
  OWNER_MOBILE_E164: string;
  PUBLIC_BASE_URL: string;
  CALLBACK_DELAY_SECONDS?: string;
  CALLER_COOLDOWN_MINUTES?: string;
  MAX_CALLBACK_ATTEMPTS?: string;
  BUSINESS_ACTIVE?: string;
  BLOCKED_CALLERS?: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_SECRET: string;
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function requiredPhone(value: string | undefined, name: string): string {
  const normalized = normalizePhoneNumber(required(value, name));
  if (!normalized) {
    throw new Error(`${name} must be a valid E.164 number`);
  }
  return normalized;
}

export function loadBusinessConfig(env: Env): BusinessConfig {
  const publicBaseUrl = required(env.PUBLIC_BASE_URL, "PUBLIC_BASE_URL").replace(/\/$/, "");
  const parsedUrl = new URL(publicBaseUrl);
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS outside localhost");
  }

  const blockedCallers = new Set<string>();
  for (const entry of (env.BLOCKED_CALLERS ?? "").split(",")) {
    if (!entry.trim()) continue;
    const normalized = normalizePhoneNumber(entry);
    if (!normalized) throw new Error(`Invalid number in BLOCKED_CALLERS: ${entry}`);
    blockedCallers.add(normalized);
  }

  return {
    id: required(env.BUSINESS_ID, "BUSINESS_ID"),
    name: required(env.BUSINESS_NAME, "BUSINESS_NAME"),
    inboundNumber: requiredPhone(env.BUSINESS_PHONE_E164, "BUSINESS_PHONE_E164"),
    callbackNumber: requiredPhone(env.CALLBACK_FROM_E164, "CALLBACK_FROM_E164"),
    ownerNumber: requiredPhone(env.OWNER_MOBILE_E164, "OWNER_MOBILE_E164"),
    publicBaseUrl,
    callbackDelaySeconds: boundedInteger(
      env.CALLBACK_DELAY_SECONDS,
      45,
      10,
      900,
      "CALLBACK_DELAY_SECONDS",
    ),
    callerCooldownMinutes: boundedInteger(
      env.CALLER_COOLDOWN_MINUTES,
      1_440,
      1,
      43_200,
      "CALLER_COOLDOWN_MINUTES",
    ),
    maxCallbackAttempts: boundedInteger(
      env.MAX_CALLBACK_ATTEMPTS,
      1,
      1,
      3,
      "MAX_CALLBACK_ATTEMPTS",
    ),
    active: (env.BUSINESS_ACTIVE ?? "false").trim().toLowerCase() === "true",
    blockedCallers,
  };
}
