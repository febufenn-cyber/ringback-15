import type { BookingHold, IntelligenceStore } from "./types.js";
export interface BookingProvider { confirm(input:{organizationId:string;slotId:string;sessionId:string;idempotencyKey:string}):Promise<{providerBookingId:string}>; cancel(providerBookingId:string):Promise<void>; }
function id(prefix:string):string{return `${prefix}_${crypto.randomUUID()}`;}
export class BookingService {
  constructor(private store:IntelligenceStore,private provider:BookingProvider,private now:()=>Date=()=>new Date()){}
  async hold(organizationId:string,sessionId:string,slotId:string,ttlSeconds=300):Promise<BookingHold>{
    if(ttlSeconds<30||ttlSeconds>1800) throw new Error("invalid_hold_ttl");
    const now=this.now();
    const hold:BookingHold={id:id("hold"),organizationId,sessionId,slotId,state:"held",expiresAt:new Date(now.getTime()+ttlSeconds*1000).toISOString(),createdAt:now.toISOString(),updatedAt:now.toISOString()};
    if(!await this.store.reserveHold(hold)) throw new Error("slot_unavailable");
    return hold;
  }
  async confirm(organizationId:string,holdId:string):Promise<BookingHold>{
    const hold=await this.store.getHold(organizationId,holdId);
    if(!hold) throw new Error("hold_not_found");
    if(hold.state==="confirmed") return hold;
    if(hold.state!=="held") throw new Error(`hold_not_confirmable:${hold.state}`);
    if(Date.parse(hold.expiresAt)<=this.now().getTime()){
      const expired={...hold,state:"expired",updatedAt:this.now().toISOString()} as BookingHold;
      await this.store.saveHold(expired); throw new Error("hold_expired");
    }
    const result=await this.provider.confirm({organizationId,slotId:hold.slotId,sessionId:hold.sessionId,idempotencyKey:hold.id});
    const confirmed:BookingHold={...hold,state:"confirmed",providerBookingId:result.providerBookingId,updatedAt:this.now().toISOString()};
    await this.store.saveHold(confirmed); return confirmed;
  }
  async cancel(organizationId:string,holdId:string):Promise<BookingHold>{
    const hold=await this.store.getHold(organizationId,holdId); if(!hold) throw new Error("hold_not_found");
    if(hold.state==="cancelled") return hold;
    if(hold.providerBookingId) await this.provider.cancel(hold.providerBookingId);
    const cancelled:BookingHold={...hold,state:"cancelled",updatedAt:this.now().toISOString()};
    await this.store.saveHold(cancelled); return cancelled;
  }
}
