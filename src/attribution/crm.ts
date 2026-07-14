import type { AttributionStore, CrmOutboxItem } from "./types.js";
export interface CrmAdapter{send(input:{organizationId:string;leadId:string;payloadHash:string;mappingVersion:string;idempotencyKey:string}):Promise<{remoteId:string}>;}
function id(prefix:string):string{return `${prefix}_${crypto.randomUUID()}`;}
export class CrmSyncService{
  constructor(private store:AttributionStore,private adapter:CrmAdapter,private now:()=>Date=()=>new Date()){}
  async enqueue(organizationId:string,leadId:string,destination:string,payloadHash:string,mappingVersion="lead-v1"):Promise<CrmOutboxItem>{
    const now=this.now().toISOString();const item:CrmOutboxItem={id:id("crm"),organizationId,leadId,destination,payloadHash,mappingVersion,state:"pending",attempts:0,createdAt:now,updatedAt:now};
    if(!await this.store.enqueueCrm(item))throw new Error("crm_sync_already_enqueued");return item;
  }
  async deliver(id:string):Promise<CrmOutboxItem>{
    const item=await this.store.getCrmItem(id);if(!item)throw new Error("crm_item_not_found");if(item.state==="sent")return item;
    try{const result=await this.adapter.send({organizationId:item.organizationId,leadId:item.leadId,payloadHash:item.payloadHash,mappingVersion:item.mappingVersion,idempotencyKey:item.id});const sent:CrmOutboxItem={...item,state:"sent",attempts:item.attempts+1,remoteId:result.remoteId,updatedAt:this.now().toISOString()};delete sent.failureReason;await this.store.saveCrmItem(sent);return sent;}
    catch(error){const failed:CrmOutboxItem={...item,state:"failed",attempts:item.attempts+1,failureReason:error instanceof Error?error.message.slice(0,300):"unknown",updatedAt:this.now().toISOString()};await this.store.saveCrmItem(failed);throw error;}
  }
}
