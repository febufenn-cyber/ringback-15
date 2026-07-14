import type { PlaybookVersion, SafetyPolicy } from "./types.js";
export const SERVICE_SAFETY_POLICY:SafetyPolicy={id:"safety_local_services_v1",organizationId:"template",version:1,emergencyTerms:["fire","gas leak","electrocution","medical emergency","danger"],prohibitedPromiseTerms:["guarantee","exact price","definitely available","diagnose"],prohibitedFields:["card_number","government_id","medical_history"],maxAnswerLength:300};
export function applianceRepairPlaybook(organizationId:string,createdAt:string):PlaybookVersion{return {id:"appliance_repair_v1",organizationId,vertical:"appliance_repair",version:1,status:"approved",startNodeId:"service",safetyPolicyId:"safety_local_services_v1",createdAt,approvedAt:createdAt,nodes:[
{id:"service",kind:"classify",promptKey:"service",field:"appliance",allowedValues:["washing_machine","refrigerator","other"],branches:{washing_machine:"symptom",refrigerator:"symptom",other:"handoff"}},
{id:"symptom",kind:"ask",promptKey:"symptom",field:"symptom",next:"location"},
{id:"location",kind:"ask",promptKey:"location",field:"location",next:"booking"},
{id:"booking",kind:"booking_offer",next:"complete"},
{id:"handoff",kind:"handoff"},
{id:"complete",kind:"complete"}],locales:{en:{service:"Which appliance needs help?",symptom:"Briefly describe the problem.",location:"What area is the appliance in?"},ta:{service:"எந்த சாதனத்திற்கு உதவி தேவை?",symptom:"பிரச்சினையை சுருக்கமாக கூறுங்கள்.",location:"சாதனம் எந்த பகுதியில் உள்ளது?"}}};}
