export interface Env {
  PUBLIC_BASE_URL: string;
  PILOT_GLOBAL_ACTIVE?: string;
  FEEDBACK_SIGNING_SECRET: string;
  DEFAULT_FEEDBACK_TTL_HOURS?: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_SECRET: string;
}

export interface GlobalConfig {
  publicBaseUrl: string;
  pilotGlobalActive: boolean;
  feedbackSigningSecret: string;
  defaultFeedbackTtlHours: number;
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

export function loadGlobalConfig(env: Env): GlobalConfig {
  const publicBaseUrl = required(env.PUBLIC_BASE_URL, "PUBLIC_BASE_URL").replace(/\/$/, "");
  const parsedUrl = new URL(publicBaseUrl);
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS outside localhost");
  }

  const feedbackSigningSecret = required(env.FEEDBACK_SIGNING_SECRET, "FEEDBACK_SIGNING_SECRET");
  if (feedbackSigningSecret.length < 32) {
    throw new Error("FEEDBACK_SIGNING_SECRET must contain at least 32 characters");
  }

  return {
    publicBaseUrl,
    pilotGlobalActive: (env.PILOT_GLOBAL_ACTIVE ?? "false").trim().toLowerCase() === "true",
    feedbackSigningSecret,
    defaultFeedbackTtlHours: boundedInteger(
      env.DEFAULT_FEEDBACK_TTL_HOURS,
      168,
      1,
      720,
      "DEFAULT_FEEDBACK_TTL_HOURS",
    ),
  };
}
