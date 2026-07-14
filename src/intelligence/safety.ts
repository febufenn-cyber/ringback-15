import type { SafetyPolicy } from "./types.js";

export interface SafetyDecision { allowed: boolean; action: "continue" | "handoff" | "reject"; flags: string[]; cleaned: string; }

export function evaluateAnswer(policy: SafetyPolicy, field: string, raw: string): SafetyDecision {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, policy.maxAnswerLength);
  const lower = cleaned.toLowerCase();
  const flags: string[] = [];
  if (!cleaned) return { allowed: false, action: "reject", flags: ["empty_answer"], cleaned };
  if (policy.prohibitedFields.includes(field)) return { allowed: false, action: "reject", flags: ["prohibited_field"], cleaned: "" };
  if (policy.emergencyTerms.some((term) => lower.includes(term.toLowerCase()))) flags.push("possible_emergency");
  if (policy.prohibitedPromiseTerms.some((term) => lower.includes(term.toLowerCase()))) flags.push("promise_or_price_request");
  if (flags.includes("possible_emergency")) return { allowed: false, action: "handoff", flags, cleaned };
  return { allowed: true, action: flags.length ? "handoff" : "continue", flags, cleaned };
}

export function assertSafeGeneratedText(policy: SafetyPolicy, text: string): void {
  const lower = text.toLowerCase();
  if (policy.prohibitedPromiseTerms.some((term) => lower.includes(term.toLowerCase()))) throw new Error("generated_text_contains_prohibited_promise");
}
