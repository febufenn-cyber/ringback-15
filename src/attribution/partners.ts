import type { AttributionEvent, AttributionStore, CommissionEntry, PartnerScope } from "./types.js";
function id(prefix:string):string{return `${prefix}_${crypto.randomUUID()}`;}
export async function requirePartnerScope(store:AttributionStore,partnerId:string,organizationId:string,scope:PartnerScope):Promise<void>{
  const partner=await store.getPartner(partnerId);if(!partner||!partner.active)throw new Error("partner_inactive");
  const assignment=await store.getAssignment(partnerId,organizationId);if(!assignment||assignment.state!=="active")throw new Error("partner_not_assigned");
  if(!partner.scopes.includes(scope))throw new Error(`partner_scope_denied:${scope}`);
}
export async function accrueCommission(store:AttributionStore,partnerId:string,event:AttributionEvent,rateBasisPoints:number,nowIso:string,ruleVersion="commission-v1"):Promise<CommissionEntry>{
  await requirePartnerScope(store,partnerId,event.organizationId,"commission.read");
  if(event.kind!=="payment_collected"||event.strength!=="financial_verified"||event.confidence<0.8)throw new Error("commission_requires_high_confidence_collected_payment");
  if(!event.amountMinor||!event.currency)throw new Error("commission_source_amount_missing");
  if(rateBasisPoints<0||rateBasisPoints>5000)throw new Error("invalid_commission_rate");
  const existing=await store.getCommissionBySource(partnerId,event.id);if(existing)return existing;
  const entry:CommissionEntry={id:id("commission"),partnerId,organizationId:event.organizationId,leadId:event.leadId,sourceEventId:event.id,amountMinor:Math.floor(event.amountMinor*rateBasisPoints/10000),currency:event.currency,rateBasisPoints,ruleVersion,state:"pending",createdAt:nowIso};
  if(!await store.addCommission(entry))return (await store.getCommissionBySource(partnerId,event.id))!;return entry;
}
export async function reverseCommission(store:AttributionStore,partnerId:string,sourcePaymentEventId:string,refundEventId:string):Promise<CommissionEntry>{
  const entry=await store.getCommissionBySource(partnerId,sourcePaymentEventId);if(!entry)throw new Error("commission_not_found");
  if(entry.state==="paid")throw new Error("paid_commission_requires_settlement_adjustment");
  if(entry.state==="reversed")return entry;
  const reversed:CommissionEntry={...entry,state:"reversed",reversedByEventId:refundEventId};await store.saveCommission(reversed);return reversed;
}
