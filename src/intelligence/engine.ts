import { nodeById, promptFor, validatePlaybook } from "./playbook.js";
import { evaluateAnswer } from "./safety.js";
import type { BoundedModel, ConversationSession, IntelligenceStore, PlaybookVersion } from "./types.js";
function id(prefix:string):string{return `${prefix}_${crypto.randomUUID()}`;}
export interface EngineOutput {session:ConversationSession;prompt?:string;action:"ask"|"booking"|"handoff"|"complete";}
export class IntelligenceEngine {
  constructor(private store:IntelligenceStore,private model:BoundedModel,private now:()=>Date=()=>new Date()){}
  async register(playbook:PlaybookVersion):Promise<void>{validatePlaybook(playbook);await this.store.savePlaybook(playbook);}
  async start(organizationId:string,leadId:string,playbookId:string,locale:string):Promise<EngineOutput>{
    const playbook=await this.store.getPlaybook(organizationId,playbookId); if(!playbook||playbook.status!=="approved") throw new Error("approved_playbook_not_found");
    const now=this.now().toISOString(); const session:ConversationSession={id:id("session"),organizationId,leadId,playbookVersionId:playbook.id,locale,currentNodeId:playbook.startNodeId,state:"running",answers:{},flags:[],createdAt:now,updatedAt:now};
    await this.store.saveSession(session); return this.render(playbook,session);
  }
  private render(playbook:PlaybookVersion,session:ConversationSession):EngineOutput{
    const node=nodeById(playbook,session.currentNodeId);
    if(node.kind==="handoff") return {session:{...session,state:"handoff"},action:"handoff"};
    if(node.kind==="complete") return {session:{...session,state:"completed"},action:"complete"};
    if(node.kind==="booking_offer") return {session:{...session,state:"awaiting_booking"},action:"booking"};
    if(!node.promptKey) throw new Error("interactive_node_missing_prompt");
    return {session:{...session,state:"awaiting_answer"},prompt:promptFor(playbook,session.locale,node.promptKey),action:"ask"};
  }
  async answer(organizationId:string,sessionId:string,raw:string):Promise<EngineOutput>{
    let session=await this.store.getSession(organizationId,sessionId); if(!session) throw new Error("session_not_found");
    const playbook=await this.store.getPlaybook(organizationId,session.playbookVersionId); if(!playbook) throw new Error("pinned_playbook_missing");
    const policy=await this.store.getSafetyPolicy(organizationId,playbook.safetyPolicyId); if(!policy) throw new Error("safety_policy_missing");
    const node=nodeById(playbook,session.currentNodeId); if(!node.field) throw new Error("node_not_answerable");
    const safety=evaluateAnswer(policy,node.field,raw);
    session={...session,flags:[...new Set([...session.flags,...safety.flags])],updatedAt:this.now().toISOString()};
    if(safety.action==="reject") throw new Error(`answer_rejected:${safety.flags.join(",")}`);
    if(safety.action==="handoff"){
      const handoff=playbook.nodes.find((item)=>item.kind==="handoff"); if(!handoff) throw new Error("handoff_node_missing");
      session={...session,currentNodeId:handoff.id,state:"handoff"}; await this.store.saveSession(session); return {session,action:"handoff"};
    }
    let next=node.next; let stored=safety.cleaned;
    if(node.kind==="classify"){
      const result=await this.model.classify({text:safety.cleaned,allowedLabels:node.allowedValues??[],field:node.field});
      if(!node.allowedValues?.includes(result.label)||result.confidence<0||result.confidence>1) throw new Error("invalid_model_classification");
      if(result.confidence<0.65){ const handoff=playbook.nodes.find((item)=>item.kind==="handoff"); if(!handoff)throw new Error("handoff_node_missing"); session={...session,currentNodeId:handoff.id,state:"handoff",flags:[...session.flags,"low_model_confidence"]}; await this.store.saveSession(session); return {session,action:"handoff"}; }
      stored=result.label; next=node.branches?.[result.label]??node.next;
    }
    if(!next) throw new Error("next_node_missing");
    session={...session,answers:{...session.answers,[node.field]:stored},currentNodeId:next,state:"running",updatedAt:this.now().toISOString()};
    await this.store.saveSession(session); const output=this.render(playbook,session); await this.store.saveSession(output.session); return output;
  }
}
