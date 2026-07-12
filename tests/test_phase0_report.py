import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "phase0_report.py"
SPEC = importlib.util.spec_from_file_location("phase0_report", MODULE_PATH)
assert SPEC and SPEC.loader
report = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = report
SPEC.loader.exec_module(report)


class Phase0ReportTests(unittest.TestCase):
    def test_safe_rate_handles_zero(self):
        self.assertEqual(report.safe_rate(5, 0), 0.0)
        self.assertEqual(report.safe_rate(1, 4), 0.25)

    def test_audit_summary_keeps_unknown_separate(self):
        rows = [
            {"classification": "new_lead", "eligible_for_recovery": "true", "owner_callback": "false", "current_outcome": "booked"},
            {"classification": "unknown", "eligible_for_recovery": "false", "owner_callback": "true", "current_outcome": "unknown"},
        ]
        summary = report.summarize_audit(rows)
        self.assertEqual(summary.total_missed, 2)
        self.assertEqual(summary.genuine_new_leads, 1)
        self.assertEqual(summary.unknown, 1)
        self.assertEqual(summary.eligible, 1)

    def test_outcomes_apply_attribution_and_margin(self):
        rows = [{
            "owner_acknowledged": "true",
            "owner_contacted": "true",
            "booked": "true",
            "job_completed": "true",
            "attributed_revenue": "1000",
            "attribution_factor_0_1": "0.5",
            "estimated_gross_margin_0_1": "0.4",
        }]
        summary = report.summarize_outcomes(rows)
        self.assertEqual(summary.attributed_revenue, 500.0)
        self.assertEqual(summary.attributed_gross_profit, 200.0)

    def test_markdown_warns_on_duplicates(self):
        audit = report.summarize_audit([])
        recovery = report.summarize_recovery([{"duplicate_contact": "true"}])
        outcomes = report.summarize_outcomes([])
        rendered = report.render_markdown(audit, recovery, outcomes)
        self.assertIn("CRITICAL", rendered)
        self.assertIn("duplicate contact", rendered)


if __name__ == "__main__":
    unittest.main()
