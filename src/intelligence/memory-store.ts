import type { BookingHold, BookingSlot, ConversationSession, IntelligenceStore, PlaybookVersion, SafetyPolicy } from "./types.js";
const copy = <T>(value: T): T => structuredClone(value);
export class MemoryIntelligenceStore implements IntelligenceStore {
  private playbooks = new Map<string, PlaybookVersion>();
  private policies = new Map<string, SafetyPolicy>();
  private sessions = new Map<string, ConversationSession>();
  private slots = new Map<string, BookingSlot>();
  private holds = new Map<string, BookingHold>();
  private key(org: string, id: string): string { return `${org}:${id}`; }
  async savePlaybook(value: PlaybookVersion): Promise<void> { this.playbooks.set(this.key(value.organizationId, value.id), copy(value)); }
  async getPlaybook(org: string, id: string): Promise<PlaybookVersion | null> { return copy(this.playbooks.get(this.key(org,id)) ?? null); }
  async saveSafetyPolicy(value: SafetyPolicy): Promise<void> { this.policies.set(this.key(value.organizationId,value.id), copy(value)); }
  async getSafetyPolicy(org: string,id:string): Promise<SafetyPolicy|null> { return copy(this.policies.get(this.key(org,id)) ?? null); }
  async saveSession(value: ConversationSession): Promise<void> { this.sessions.set(this.key(value.organizationId,value.id),copy(value)); }
  async getSession(org:string,id:string):Promise<ConversationSession|null>{ return copy(this.sessions.get(this.key(org,id)) ?? null); }
  async addSlot(value: BookingSlot): Promise<void> { this.slots.set(this.key(value.organizationId,value.id),copy(value)); }
  async getSlot(org:string,id:string):Promise<BookingSlot|null>{ return copy(this.slots.get(this.key(org,id)) ?? null); }
  async reserveHold(value: BookingHold): Promise<boolean> {
    if (this.holds.has(this.key(value.organizationId,value.id))) return false;
    const slot = await this.getSlot(value.organizationId,value.slotId);
    if (!slot) throw new Error("slot_not_found");
    const active = await this.countActiveHolds(value.organizationId,value.slotId,value.createdAt);
    if (active >= slot.capacity) return false;
    this.holds.set(this.key(value.organizationId,value.id),copy(value));
    return true;
  }
  async getHold(org:string,id:string):Promise<BookingHold|null>{ return copy(this.holds.get(this.key(org,id)) ?? null); }
  async saveHold(value:BookingHold):Promise<void>{ const key=this.key(value.organizationId,value.id); if(!this.holds.has(key)) throw new Error("hold_not_found"); this.holds.set(key,copy(value)); }
  async countActiveHolds(org:string,slotId:string,nowIso:string):Promise<number>{
    const now=Date.parse(nowIso);
    return [...this.holds.values()].filter((hold)=>hold.organizationId===org&&hold.slotId===slotId).filter((hold)=>hold.state==="confirmed"||(hold.state==="held"&&Date.parse(hold.expiresAt)>now)).length;
  }
}
