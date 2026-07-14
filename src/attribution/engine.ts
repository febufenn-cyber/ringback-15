import { stronger } from "./ledger.js";
import type { AttributionClass, AttributionEvent, AttributionReport, AttributionStore, EvidenceStrength, EvidenceValueBreakdown } from "./types.js";
function amount(events:AttributionEvent[],kind:AttributionEvent["kind"]):number{return events.filter(e=>e.kind===kind).reduce((sum,e)=>sum+(e.amountMinor??0),0);}
const CLASS_WEIGHT:Readonly<Record<AttributionClass,number>>={direct_recovery:1,assisted_recovery:.65,likely_incremental:.4,unattributed:0,counterfactual_unknown:0};
function resolveClass(events:AttributionEvent[]):AttributionClass{
  const explicit=events.filter(e=>e.attributionClass).at(-1)?.attributionClass;if(explicit)return explicit;
  const kinds=new Set(events.map(e=>e.kind));
  if(kinds.has("missed_call")&&kinds.has("callback_connected")&&kinds.has("qualified_lead")&&(kinds.has("booking_created")||kinds.has("payment_collected")))return "direct_recovery";
  if(kinds.has("qualified_lead")&&(kinds.has("booking_created")||kinds.has("payment_collected")))return "assisted_recovery";
  if(kinds.has("callback_attempt")&&kinds.has("booking_created"))return "likely_incremental";
  if(kinds.has("payment_collected")||kinds.has("job_completed"))return "unattributed";
  return "counterfactual_unknown";
}
function valueBreakdown(events:AttributionEvent[]):EvidenceValueBreakdown{
  const result:EvidenceValueBreakdown={estimatedMinor:0,ownerReportedMinor:0,providerVerifiedMinor:0,financialVerifiedMinor:0};
  for(const event of events){const value=event.amountMinor??0;if(event.kind==="refund_issued"||event.kind==="cost_incurred")continue;
    if(event.strength==="estimated")result.estimatedMinor+=value;
    else if(event.strength==="owner_reported")result.ownerReportedMinor+=value;
    else if(event.strength==="provider_verified")result.providerVerifiedMinor+=value;
    else result.financialVerifiedMinor+=value;}
  return result;
}
export class AttributionEngine {
  constructor(private store:AttributionStore,private ruleVersion="recovery-v1"){}
  async report(organizationId:string,leadId:string):Promise<AttributionReport>{
    const events=await this.store.listEvents(organizationId,leadId);if(!events.length)throw new Error("evidence_not_found");
    const touches=await this.store.listTouches(organizationId,leadId);
    const currencies=[...new Set(events.filter(e=>e.amountMinor!==undefined).map(e=>e.currency))].filter(Boolean);
    if(currencies.length>1)throw new Error("mixed_currency_report_requires_conversion");
    const currency=currencies[0]??"XXX";
    const booked=amount(events,"booking_created"),invoiced=amount(events,"invoice_issued"),collected=amount(events,"payment_collected"),refunded=amount(events,"refund_issued"),cost=amount(events,"cost_incurred");
    const net=Math.max(0,collected-refunded);
    const collections=events.filter(e=>e.kind==="payment_collected");
    const weighted=Math.max(0,Math.round(collections.reduce((sum,e)=>sum+(e.amountMinor??0)*e.confidence,0)-refunded));
    let highest:EvidenceStrength="estimated";for(const event of events)highest=stronger(highest,event.strength);
    const kinds=new Set(events.map(e=>e.kind));const missing:string[]=[];const conflicts:string[]=[];
    if(!kinds.has("qualified_lead"))missing.push("qualified_lead");
    if(booked&&!kinds.has("job_completed"))missing.push("job_completed");
    if(invoiced&&!collected)missing.push("payment_collected");
    if(!touches.length)missing.push("acquisition_source");
    if(kinds.has("owner_reported_won")&&kinds.has("owner_reported_lost"))conflicts.push("conflicting_owner_outcome");
    if(refunded>collected)conflicts.push("refund_exceeds_collection");
    const attributionClass=resolveClass(events);const attributionWeight=CLASS_WEIGHT[attributionClass];
    const attributed=Math.round(weighted*attributionWeight);
    const report:AttributionReport={organizationId,leadId,currency,bookedMinor:booked,invoicedMinor:invoiced,collectedMinor:collected,refundedMinor:refunded,netCollectedMinor:net,confidenceWeightedMinor:weighted,attributedMinor:attributed,costMinor:cost,contributionMinor:attributed-cost,highestStrength:highest,attributionClass,attributionWeight,byStrength:valueBreakdown(events),missingEvidence:missing,conflicts,ruleVersion:this.ruleVersion};
    if(touches[0])report.firstTouch=touches[0];const last=touches.at(-1);if(last)report.lastTouch=last;return report;
  }
}
