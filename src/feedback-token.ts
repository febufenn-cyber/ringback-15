import type { BusinessConfig, FeedbackLinkFactory, LeadCard } from "./types.js";

function bytesToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function canonical(businessId: string, leadId: string, expiresAt: number): string {
  return `${businessId}.${leadId}.${expiresAt}`;
}

export class FeedbackTokenService implements FeedbackLinkFactory {
  constructor(
    private readonly secret: string,
    private readonly publicBaseUrl: string,
    private readonly defaultTtlHours = 168,
  ) {}

  private async sign(value: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return bytesToBase64Url(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
    );
  }

  async createLink(business: BusinessConfig, lead: LeadCard, now: Date): Promise<string> {
    const ttlHours = business.feedbackTtlHours ?? this.defaultTtlHours;
    const expiresAt = Math.floor(now.getTime() / 1000) + ttlHours * 3600;
    const signature = await this.sign(canonical(business.id, lead.id, expiresAt));
    const query = new URLSearchParams({
      business: business.id,
      lead: lead.id,
      exp: String(expiresAt),
      sig: signature,
    });
    return `${this.publicBaseUrl}/feedback?${query.toString()}`;
  }

  async verify(
    businessId: string,
    leadId: string,
    expiresAt: number,
    providedSignature: string,
    now: Date,
  ): Promise<boolean> {
    if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(now.getTime() / 1000)) {
      return false;
    }
    const expected = await this.sign(canonical(businessId, leadId, expiresAt));
    return constantTimeEqual(expected, providedSignature);
  }
}
