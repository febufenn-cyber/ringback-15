import type { AcquisitionTouch, AttributionEvent, AttributionStore, EvidenceKind, EvidenceStrength, IdentityLink } from "./types.js";
const STRENGTH_RANK:Record<EvidenceStrength,number>={estimated:0,owner_reported:1,provider_verified:2,financial_verified:3};
export function stronger(a:EvidenceStrength,b:EvidenceStrength):EvidenceStrength{return STRENGTH_RANK[a]>=STRENGTH_RANK[b]?a:b;}
export function validateEvent(event:AttributionEvent):void{
  if(event.confidence<0||event.confidence>1)throw new Error("confidence_out_of_range");
  if(event.amountMinor!==undefined&&(!Number.isInteger(event.amountMinor)||event.amountMinor<0))throw new Error("invalid_amount");
  if(event.amountMinor!==undefined&&!event.currency)throw new Error("currency_required_for_amount");
  const financial=new Set<EvidenceKind>(["invoice_issued","payment_collected","refund_issued"]);
  if(financial.has(event.kind)&&event.strength!=="financial_verified")throw new Error("financial_event_requires_verified_strength");
  if(financial.has(event.kind)&&(event.amountMinor===undefined||!event.currency))throw new Error("financial_event_requires_amount_and_currency");
  if(!event.ruleVersion.trim())throw new Error("rule_version_required");
  if(!event.sourceType.trim()||!event.sourceId.trim())throw new Error("source_identity_required");
}
export async function appendEvidence(store:AttributionStore,event:AttributionEvent):Promise<boolean>{validateEvent(event);return store.appendEvent(structuredClone(event));}
export async function addAcquisitionTouch(store:AttributionStore,touch:AcquisitionTouch):Promise<boolean>{if(!touch.channel.trim())throw new Error("channel_required");return store.addTouch(structuredClone(touch));}
export async function linkIdentity(store:AttributionStore,link:IdentityLink,requestedOrganizationId:string):Promise<boolean>{
  if(link.organizationId!==requestedOrganizationId)throw new Error("cross_tenant_identity_link_prohibited");
  if(link.confidence<0||link.confidence>1)throw new Error("identity_confidence_out_of_range");
  if(link.matchMethod==="manual"&&!link.actorId)throw new Error("manual_identity_link_requires_actor");
  return store.addIdentityLink(structuredClone(link));
}
