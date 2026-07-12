#!/usr/bin/env python3
"""Generate a Phase 0 validation report from Ringback CSV templates.

Uses only the Python standard library. Empty or missing files are handled
without failing so teams can generate partial reports during research.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping


TRUE_VALUES = {"1", "true", "yes", "y"}


def as_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in TRUE_VALUES


def as_float(value: str | None, default: float = 0.0) -> float:
    try:
        return float((value or "").strip())
    except (TypeError, ValueError):
        return default


def safe_rate(numerator: int | float, denominator: int | float) -> float:
    return float(numerator) / float(denominator) if denominator else 0.0


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


@dataclass(frozen=True)
class AuditSummary:
    total_missed: int
    genuine_new_leads: int
    eligible: int
    owner_called_back: int
    booked: int
    won: int
    unknown: int
    classifications: Mapping[str, int]


@dataclass(frozen=True)
class RecoverySummary:
    attempts: int
    delivered: int
    engaged: int
    consented: int
    qualified: int
    lead_cards: int
    complaints: int
    confused: int
    duplicates: int
    opted_out: int
    variable_cost: float


@dataclass(frozen=True)
class OutcomeSummary:
    rows: int
    acknowledged: int
    contacted: int
    booked: int
    completed: int
    attributed_revenue: float
    attributed_gross_profit: float


def summarize_audit(rows: Iterable[dict[str, str]]) -> AuditSummary:
    rows = list(rows)
    classes = Counter((row.get("classification") or "unknown").strip() or "unknown" for row in rows)
    outcomes = Counter((row.get("current_outcome") or "unknown").strip() or "unknown" for row in rows)
    return AuditSummary(
        total_missed=len(rows),
        genuine_new_leads=classes["new_lead"],
        eligible=sum(as_bool(row.get("eligible_for_recovery")) for row in rows),
        owner_called_back=sum(as_bool(row.get("owner_callback")) for row in rows),
        booked=outcomes["booked"],
        won=outcomes["won"],
        unknown=classes["unknown"],
        classifications=dict(classes),
    )


def summarize_recovery(rows: Iterable[dict[str, str]]) -> RecoverySummary:
    rows = list(rows)
    return RecoverySummary(
        attempts=len(rows),
        delivered=sum(as_bool(row.get("delivered")) for row in rows),
        engaged=sum(as_bool(row.get("answered_or_replied")) for row in rows),
        consented=sum(as_bool(row.get("consented_to_continue")) for row in rows),
        qualified=sum(as_bool(row.get("qualification_completed")) for row in rows),
        lead_cards=sum(as_bool(row.get("lead_card_sent")) for row in rows),
        complaints=sum(as_bool(row.get("complaint")) for row in rows),
        confused=sum(as_bool(row.get("caller_confused")) for row in rows),
        duplicates=sum(as_bool(row.get("duplicate_contact")) for row in rows),
        opted_out=sum(as_bool(row.get("opted_out")) for row in rows),
        variable_cost=sum(as_float(row.get("estimated_variable_cost")) for row in rows),
    )


def summarize_outcomes(rows: Iterable[dict[str, str]]) -> OutcomeSummary:
    rows = list(rows)
    revenue = 0.0
    gross_profit = 0.0
    for row in rows:
        value = as_float(row.get("attributed_revenue"))
        attribution = min(1.0, max(0.0, as_float(row.get("attribution_factor_0_1"), 1.0)))
        margin = min(1.0, max(0.0, as_float(row.get("estimated_gross_margin_0_1"))))
        attributed = value * attribution
        revenue += attributed
        gross_profit += attributed * margin
    return OutcomeSummary(
        rows=len(rows),
        acknowledged=sum(as_bool(row.get("owner_acknowledged")) for row in rows),
        contacted=sum(as_bool(row.get("owner_contacted")) for row in rows),
        booked=sum(as_bool(row.get("booked")) for row in rows),
        completed=sum(as_bool(row.get("job_completed")) for row in rows),
        attributed_revenue=revenue,
        attributed_gross_profit=gross_profit,
    )


def money(value: float) -> str:
    return f"{value:,.2f}"


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def render_markdown(audit: AuditSummary, recovery: RecoverySummary, outcomes: OutcomeSummary) -> str:
    warnings: list[str] = []
    if recovery.duplicates:
        warnings.append(f"CRITICAL: {recovery.duplicates} duplicate contact(s) recorded.")
    if recovery.complaints:
        warnings.append(f"Review required: {recovery.complaints} complaint(s) recorded.")
    if recovery.confused:
        warnings.append(f"Trust signal: {recovery.confused} caller(s) were confused about the contact.")
    if audit.total_missed and audit.unknown / audit.total_missed > 0.25:
        warnings.append("More than 25% of audited calls remain unknown; improve classification before relying on economics.")
    if outcomes.rows and outcomes.acknowledged / outcomes.rows < 0.5:
        warnings.append("Owners acknowledged fewer than half of recorded lead outcomes.")

    classification_rows = "\n".join(
        f"| {key} | {value} | {pct(safe_rate(value, audit.total_missed))} |"
        for key, value in sorted(audit.classifications.items())
    ) or "| No data | 0 | 0.0% |"

    warning_section = "\n".join(f"- {item}" for item in warnings) or "- No automatic warning triggered. Manual review is still required."

    return f"""# Ringback Phase 0 Report

## Automatic warnings

{warning_section}

## Missed-call composition

- Audited missed calls: **{audit.total_missed}**
- Genuine new leads: **{audit.genuine_new_leads}** ({pct(safe_rate(audit.genuine_new_leads, audit.total_missed))})
- Eligible recovery opportunities: **{audit.eligible}** ({pct(safe_rate(audit.eligible, audit.total_missed))})
- Already called back by owner: **{audit.owner_called_back}**
- Unknown classification: **{audit.unknown}**

| Classification | Calls | Share |
|---|---:|---:|
{classification_rows}

## Recovery experiment

- Attempts: **{recovery.attempts}**
- Delivered/rang: **{recovery.delivered}** ({pct(safe_rate(recovery.delivered, recovery.attempts))})
- Answered/replied: **{recovery.engaged}** ({pct(safe_rate(recovery.engaged, recovery.attempts))})
- Consented to continue: **{recovery.consented}**
- Qualification completed: **{recovery.qualified}** ({pct(safe_rate(recovery.qualified, recovery.engaged))} of engaged)
- Lead cards sent: **{recovery.lead_cards}**
- Opt-outs: **{recovery.opted_out}**
- Complaints: **{recovery.complaints}**
- Caller confusion: **{recovery.confused}**
- Duplicate contacts: **{recovery.duplicates}**
- Recorded variable cost: **{money(recovery.variable_cost)}**

## Owner and revenue outcomes

- Outcome rows: **{outcomes.rows}**
- Owner acknowledged: **{outcomes.acknowledged}** ({pct(safe_rate(outcomes.acknowledged, outcomes.rows))})
- Owner contacted caller: **{outcomes.contacted}**
- Booked: **{outcomes.booked}**
- Completed jobs: **{outcomes.completed}**
- Attribution-adjusted revenue: **{money(outcomes.attributed_revenue)}**
- Attribution-adjusted gross profit: **{money(outcomes.attributed_gross_profit)}**
- Gross profit per recovery attempt: **{money(outcomes.attributed_gross_profit / recovery.attempts if recovery.attempts else 0.0)}**
- Delivery cost per qualified lead: **{money(recovery.variable_cost / recovery.qualified if recovery.qualified else 0.0)}**

## Funnel

| Stage | Count | Conversion from prior stage |
|---|---:|---:|
| Eligible missed calls | {audit.eligible} | — |
| Recovery attempts | {recovery.attempts} | {pct(safe_rate(recovery.attempts, audit.eligible))} |
| Engaged | {recovery.engaged} | {pct(safe_rate(recovery.engaged, recovery.attempts))} |
| Qualified | {recovery.qualified} | {pct(safe_rate(recovery.qualified, recovery.engaged))} |
| Owner contacted | {outcomes.contacted} | {pct(safe_rate(outcomes.contacted, recovery.lead_cards))} |
| Booked | {outcomes.booked} | {pct(safe_rate(outcomes.booked, outcomes.contacted))} |
| Completed | {outcomes.completed} | {pct(safe_rate(outcomes.completed, outcomes.booked))} |

## Interpretation checklist

- [ ] Every numerator has a clear denominator.
- [ ] Unknown calls are not silently counted as leads.
- [ ] Revenue is adjusted for attribution and gross margin.
- [ ] Owner follow-through is measured separately from lead quality.
- [ ] Complaints, confusion, opt-outs, and duplicate contacts were manually reviewed.
- [ ] A credible payment commitment exists before a GO decision.
- [ ] The hard gates in `phase0/07-go-no-go-scorecard.md` are complete.

This report is descriptive, not a statistical proof or legal review.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("phase0/templates"))
    parser.add_argument("--output", type=Path, default=Path("phase0-report.md"))
    parser.add_argument("--json", dest="json_output", type=Path)
    args = parser.parse_args()

    audit = summarize_audit(read_csv(args.data_dir / "call-audit.csv"))
    recovery = summarize_recovery(read_csv(args.data_dir / "recovery-attempts.csv"))
    outcomes = summarize_outcomes(read_csv(args.data_dir / "owner-outcomes.csv"))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_markdown(audit, recovery, outcomes), encoding="utf-8")

    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            json.dumps(
                {
                    "audit": audit.__dict__,
                    "recovery": recovery.__dict__,
                    "outcomes": outcomes.__dict__,
                },
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )

    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
