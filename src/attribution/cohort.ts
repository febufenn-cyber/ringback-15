import type { AttributionReport, CohortSummary } from "./types.js";
export function aggregateCohort(reports:AttributionReport[],minimumOrganizations=3):CohortSummary{
  const organizations=new Set(reports.map(report=>report.organizationId));
  if(organizations.size<minimumOrganizations)throw new Error("cohort_privacy_threshold_not_met");
  const currencies=new Set(reports.map(report=>report.currency));if(currencies.size!==1)throw new Error("cohort_currency_mismatch");
  const missing=reports.filter(report=>report.missingEvidence.length>0).length;
  return {organizationCount:organizations.size,leadCount:reports.length,currency:reports[0]?.currency??"XXX",netCollectedMinor:reports.reduce((sum,r)=>sum+r.netCollectedMinor,0),attributedMinor:reports.reduce((sum,r)=>sum+r.attributedMinor,0),contributionMinor:reports.reduce((sum,r)=>sum+r.contributionMinor,0),missingOutcomeRate:reports.length?missing/reports.length:0};
}
