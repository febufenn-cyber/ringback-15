import type { AcquisitionTouch, AttributionEvent, AttributionStore, CommissionEntry, CrmOutboxItem, IdentityLink, Partner, PartnerAssignment } from "./types.js";
const copy=<T>(value:T):T=>structuredClone(value);
export class MemoryAttributionStore implements AttributionStore {
  private events=new Map<string,AttributionEvent>(); private eventKeys=new Set<string>();
  private touches=new Map<string,AcquisitionTouch>(); private touchKeys=new Set<string>();
  private identityLinks=new Map<string,IdentityLink>(); private identityKeys=new Set<string>();
  private partners=new Map<string,Partner>(); private assignments=new Map<string,PartnerAssignment>();
  private commissions=new Map<string,CommissionEntry>(); private commissionSources=new Map<string,string>();
  private crm=new Map<string,CrmOutboxItem>(); private crmKeys=new Set<string>();
  async appendEvent(event:AttributionEvent):Promise<boolean>{const key=`${event.organizationId}:${event.kind}:${event.sourceType}:${event.sourceId}`;if(this.eventKeys.has(key))return false;this.eventKeys.add(key);this.events.set(event.id,copy(event));return true;}
  async listEvents(org:string,lead:string):Promise<AttributionEvent[]>{return [...this.events.values()].filter(e=>e.organizationId===org&&e.leadId===lead).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id)).map(copy);}
  async addTouch(touch:AcquisitionTouch):Promise<boolean>{const key=`${touch.organizationId}:${touch.leadId}:${touch.channel}:${touch.campaignId??""}:${touch.partnerId??""}:${touch.occurredAt}`;if(this.touchKeys.has(key))return false;this.touchKeys.add(key);this.touches.set(touch.id,copy(touch));return true;}
  async listTouches(org:string,lead:string):Promise<AcquisitionTouch[]>{return [...this.touches.values()].filter(t=>t.organizationId===org&&t.leadId===lead).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id)).map(copy);}
  async addIdentityLink(link:IdentityLink):Promise<boolean>{const key=`${link.organizationId}:${link.linkedEntityType}:${link.linkedEntityId}`;if(this.identityKeys.has(key))return false;this.identityKeys.add(key);this.identityLinks.set(link.id,copy(link));return true;}
  async listIdentityLinks(org:string,lead:string):Promise<IdentityLink[]>{return [...this.identityLinks.values()].filter(l=>l.organizationId===org&&l.canonicalLeadId===lead).map(copy);}
  async addPartner(value:Partner):Promise<void>{if(this.partners.has(value.id))throw new Error("partner_exists");this.partners.set(value.id,copy(value));}
  async getPartner(id:string):Promise<Partner|null>{return copy(this.partners.get(id)??null);}
  async assignPartner(value:PartnerAssignment):Promise<void>{this.assignments.set(`${value.partnerId}:${value.organizationId}`,copy(value));}
  async getAssignment(partnerId:string,org:string):Promise<PartnerAssignment|null>{return copy(this.assignments.get(`${partnerId}:${org}`)??null);}
  async addCommission(value:CommissionEntry):Promise<boolean>{const key=`${value.partnerId}:${value.sourceEventId}`;if(this.commissionSources.has(key))return false;this.commissionSources.set(key,value.id);this.commissions.set(value.id,copy(value));return true;}
  async getCommissionBySource(partnerId:string,sourceEventId:string):Promise<CommissionEntry|null>{const id=this.commissionSources.get(`${partnerId}:${sourceEventId}`);return id?copy(this.commissions.get(id)??null):null;}
  async saveCommission(value:CommissionEntry):Promise<void>{if(!this.commissions.has(value.id))throw new Error("commission_not_found");this.commissions.set(value.id,copy(value));}
  async listCommissions(partnerId:string):Promise<CommissionEntry[]>{return [...this.commissions.values()].filter(c=>c.partnerId===partnerId).map(copy);}
  async enqueueCrm(value:CrmOutboxItem):Promise<boolean>{const key=`${value.organizationId}:${value.destination}:${value.leadId}:${value.mappingVersion}:${value.payloadHash}`;if(this.crmKeys.has(key))return false;this.crmKeys.add(key);this.crm.set(value.id,copy(value));return true;}
  async getCrmItem(id:string):Promise<CrmOutboxItem|null>{return copy(this.crm.get(id)??null);}
  async saveCrmItem(value:CrmOutboxItem):Promise<void>{if(!this.crm.has(value.id))throw new Error("crm_item_not_found");this.crm.set(value.id,copy(value));}
}
