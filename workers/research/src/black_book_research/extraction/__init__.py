"""Deterministic claim extraction and evidence-span helpers."""

from .evidence import assert_quotation_accurate, register_evidence_span
from .models import (
    AtomicityAssessment,
    EvidenceSpan,
    ExtractionDecision,
    ExtractionUncertainty,
    ParsedClaimLine,
)
from .parser import assess_atomicity, parse_claim_lines
from .validation import (
    LEGAL_STATUSES,
    UNSUPPORTED_PROCEDURAL_LANGUAGE,
    decide_claim_extraction,
)

__all__ = [
    "LEGAL_STATUSES",
    "UNSUPPORTED_PROCEDURAL_LANGUAGE",
    "AtomicityAssessment",
    "EvidenceSpan",
    "ExtractionDecision",
    "ExtractionUncertainty",
    "ParsedClaimLine",
    "assess_atomicity",
    "assert_quotation_accurate",
    "decide_claim_extraction",
    "parse_claim_lines",
    "register_evidence_span",
]
