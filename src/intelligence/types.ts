export type NodeKind = "ask" | "classify" | "safety_gate" | "booking_offer" | "handoff" | "complete";
export type SessionState = "running" | "awaiting_answer" | "awaiting_booking" | "handoff" | "completed" | "failed";
export type BookingState = "held" | "confirmed" | "expired" | "cancelled" | "failed";

export interface PlaybookNode {
  id: string;
  kind: NodeKind;
  promptKey?: string;
  field?: string;
  next?: string;
  branches?: Record<string, string>;
  allowedValues?: string[];
  sensitive?: boolean;
}
export interface PlaybookVersion {
  id: string;
  organizationId: string;
  vertical: string;
  version: number;
  status: "draft" | "approved" | "retired";
  startNodeId: string;
  nodes: PlaybookNode[];
  locales: Record<string, Record<string, string>>;
  safetyPolicyId: string;
  createdAt: string;
  approvedAt?: string;
}
export interface SafetyPolicy {
  id: string;
  organizationId: string;
  version: number;
  emergencyTerms: string[];
  prohibitedPromiseTerms: string[];
  prohibitedFields: string[];
  maxAnswerLength: number;
}
export interface ConversationSession {
  id: string;
  organizationId: string;
  leadId: string;
  playbookVersionId: string;
  locale: string;
  currentNodeId: string;
  state: SessionState;
  answers: Record<string, string>;
  flags: string[];
  createdAt: string;
  updatedAt: string;
}
export interface ModelClassification {
  label: string;
  confidence: number;
  rationaleCode: string;
}
export interface BoundedModel {
  classify(input: { text: string; allowedLabels: string[]; field: string }): Promise<ModelClassification>;
}
export interface BookingSlot {
  id: string;
  organizationId: string;
  resourceId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
}
export interface BookingHold {
  id: string;
  organizationId: string;
  sessionId: string;
  slotId: string;
  state: BookingState;
  expiresAt: string;
  providerBookingId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface IntelligenceStore {
  savePlaybook(playbook: PlaybookVersion): Promise<void>;
  getPlaybook(organizationId: string, id: string): Promise<PlaybookVersion | null>;
  saveSafetyPolicy(policy: SafetyPolicy): Promise<void>;
  getSafetyPolicy(organizationId: string, id: string): Promise<SafetyPolicy | null>;
  saveSession(session: ConversationSession): Promise<void>;
  getSession(organizationId: string, id: string): Promise<ConversationSession | null>;
  addSlot(slot: BookingSlot): Promise<void>;
  getSlot(organizationId: string, id: string): Promise<BookingSlot | null>;
  reserveHold(hold: BookingHold): Promise<boolean>;
  getHold(organizationId: string, id: string): Promise<BookingHold | null>;
  saveHold(hold: BookingHold): Promise<void>;
  countActiveHolds(organizationId: string, slotId: string, nowIso: string): Promise<number>;
}
