"""
ISO 42005 Impact Assessment engine for AI projects.

Scores each workflow across four risk dimensions (0-10) and auto-assigns
ISO 42001 Annex A controls based on the risk profile.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"

# ---- Controls data (loaded once) -------------------------------------------

_controls: list[dict] | None = None


def _load_controls() -> list[dict]:
    global _controls
    if _controls is None:
        with open(DATA_DIR / "controls.json", encoding="utf-8") as f:
            _controls = json.load(f)
    return _controls


# ---- Constants for scoring -------------------------------------------------

# High-touch departments: higher stakeholder impact base
_STAKEHOLDER_BASE: dict[str, float] = {
    "sales": 8.0,
    "customer_success": 7.5,
    "marketing": 5.0,
    "support": 5.5,
    "finance": 5.0,
    "product": 3.0,
    "engineering": 2.0,
    "legal": 4.0,
    "people_hr": 5.5,
    "it": 1.5,
}

# Tools that handle PII or sensitive personal data
_PII_TOOLS = {
    "Workday", "Salesforce", "Greenhouse", "LinkedIn Sales Navigator",
    "Gainsight", "Lattice", "Pendo",
}

# Tools with compliance / legal implications
_COMPLIANCE_TOOLS = {
    "DocuSign", "Ironclad", "NetSuite", "Coupa", "Adaptive Planning",
}

# High-regulation departments
_HIGH_REG_DEPTS = {"legal", "finance", "people_hr"}


# ---- Dimension scorers -----------------------------------------------------

def score_stakeholder(wf: dict) -> float:
    """Stakeholder Impact based on department + frequency."""
    base = _STAKEHOLDER_BASE.get(wf["department"], 4.0)
    occ = wf.get("occurrences_per_month", 1)
    # frequency multiplier: daily (>20/mo) adds up to 4, weekly ~2, monthly ~0.5
    freq_add = min(math.log2(max(occ, 1)) / math.log2(300) * 4.0, 4.0)
    return round(min(base + freq_add, 10.0), 2)


def score_ethical(wf: dict) -> float:
    """Ethical Risk based on data sensitivity of current tools."""
    tools = set(wf.get("current_tools", []))
    pii_count = len(tools & _PII_TOOLS)
    base = 1.0
    base += pii_count * 3.0
    # LinkedIn / personal data tools add extra
    if "LinkedIn Sales Navigator" in tools:
        base += 1.5
    return round(min(base, 10.0), 2)


def score_legal(wf: dict) -> float:
    """Legal/Regulatory Risk based on department and compliance tools."""
    dept = wf["department"]
    base = 7.0 if dept in _HIGH_REG_DEPTS else 1.5
    tools = set(wf.get("current_tools", []))
    compliance_count = len(tools & _COMPLIANCE_TOOLS)
    base += compliance_count * 2.0
    # PII tools in regulated departments amplify legal risk
    if dept in _HIGH_REG_DEPTS:
        pii_count = len(tools & _PII_TOOLS)
        base += pii_count * 1.0
    return round(min(base, 10.0), 2)


def score_operational(wf: dict) -> float:
    """Operational Risk based on build hours + integration complexity."""
    hours = wf.get("estimated_build_hours", 60)
    num_tools = len(wf.get("current_tools", []))
    # hours: 20->1, 120->9
    hours_score = 1.0 + ((hours - 20) / (120 - 20)) * 8.0
    hours_score = max(min(hours_score, 9.0), 1.0)
    # Each integration tool adds ~0.4
    tool_add = min(num_tools * 0.4, 2.0)
    return round(min(hours_score + tool_add, 10.0), 2)


# ---- Composite risk ---------------------------------------------------------

_WEIGHTS = {
    "stakeholder": 0.30,
    "ethical": 0.28,
    "legal": 0.22,
    "operational": 0.20,
}


def compute_risk(wf: dict) -> dict:
    """Return all four dimension scores, composite risk, risk level, and controls."""
    s = score_stakeholder(wf)
    e = score_ethical(wf)
    l = score_legal(wf)
    o = score_operational(wf)

    composite = round(
        _WEIGHTS["stakeholder"] * s
        + _WEIGHTS["ethical"] * e
        + _WEIGHTS["legal"] * l
        + _WEIGHTS["operational"] * o,
        2,
    )

    if composite < 3:
        level = "low"
    elif composite < 5:
        level = "medium"
    elif composite < 7:
        level = "high"
    else:
        level = "critical"

    controls = _assign_controls(s, e, l, o)

    return {
        "impact_stakeholder": s,
        "impact_ethical": e,
        "impact_legal": l,
        "impact_operational": o,
        "risk_score": composite,
        "risk_level": level,
        "controls": controls,
    }


def _assign_controls(stakeholder: float, ethical: float, legal: float, operational: float) -> list[str]:
    """Auto-assign ISO 42001 controls based on risk profile.

    Low-risk projects (composite < 3.5) are not yet governed — they are
    still in triage and have no controls assigned, which is realistic for
    early-stage or low-impact proposals.
    """
    composite = (
        0.30 * stakeholder + 0.28 * ethical + 0.22 * legal + 0.20 * operational
    )
    if composite < 3.5:
        return []

    controls_data = _load_controls()
    by_cat: dict[str, list[str]] = {}
    for c in controls_data:
        by_cat.setdefault(c["category"], []).append(c["id"])

    assigned: list[str] = []

    # Always include base risk assessment for governed projects
    assigned.append("A.6.2.2")

    # High stakeholder -> risk + impact controls
    if stakeholder >= 5:
        assigned.extend(["A.7.3", "A.7.4"])
    if stakeholder >= 7:
        assigned.append("A.6.2.4")

    # High ethical -> transparency controls
    if ethical >= 5:
        assigned.extend(["A.8.4", "A.8.5"])
    if ethical >= 7:
        assigned.append("A.8.2")

    # High legal -> risk treatment + third-party
    if legal >= 5:
        assigned.append("A.6.2.6")
    if legal >= 7:
        assigned.extend(["A.9.3", "A.9.4"])

    # High operational -> operations controls
    if operational >= 5:
        assigned.extend(["A.10.2", "A.10.3"])
    if operational >= 7:
        assigned.extend(["A.10.4", "A.10.5", "A.10.6"])

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for cid in assigned:
        if cid not in seen:
            seen.add(cid)
            unique.append(cid)

    return unique


# ---- Benefit score from POC 2 -----------------------------------------------

def compute_benefit_score(composite_score: float) -> float:
    """Convert a POC 2 composite score (0-10) to a benefit score (0-10).

    The POC 2 composite already factors in revenue impact, headcount pressure,
    implementation ease, and self-service potential, so we use it directly.
    """
    return round(min(max(composite_score, 0.0), 10.0), 2)
