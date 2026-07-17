"""Deterministic pipe-delimited atomic-claim parser."""

from __future__ import annotations

import re

from .models import AtomicityAssessment, ExtractionUncertainty, ParsedClaimLine

_CLAUSE_SEPARATOR = re.compile(r"(?:[.;!?]\s+|\s+(?:and|or|but)\s+)", re.IGNORECASE)


def assess_atomicity(predicate: str, object_value: str) -> AtomicityAssessment:
    separators = _CLAUSE_SEPARATOR.findall(f"{predicate.strip()} {object_value.strip()}")
    assertion_count = len(separators) + 1
    return AtomicityAssessment(
        assertion_count=assertion_count,
        independently_supportable=assertion_count == 1,
        rationale=(
            "No deterministic multi-assertion separator was detected."
            if assertion_count == 1
            else f"Detected {len(separators)} possible assertion separator(s)."
        ),
    )


def _split_escaped_pipe(line: str) -> list[str]:
    fields: list[str] = []
    current: list[str] = []
    escaped = False
    for character in line:
        if escaped:
            current.append(character)
            escaped = False
        elif character == "\\":
            escaped = True
        elif character == "|":
            fields.append("".join(current).strip())
            current = []
        else:
            current.append(character)
    if escaped:
        current.append("\\")
    fields.append("".join(current).strip())
    return fields


def parse_claim_lines(value: str) -> tuple[ParsedClaimLine, ...]:
    parsed: list[ParsedClaimLine] = []
    for line_number, raw_line in enumerate(
        value.replace("\r\n", "\n").replace("\r", "\n").split("\n"), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        fields = _split_escaped_pipe(line)
        if len(fields) != 3:
            raise ValueError(
                f"Line {line_number} must contain exactly three pipe-delimited fields"
            )
        entity_id, predicate, object_value = fields
        if not entity_id or not predicate or not object_value:
            raise ValueError(f"Line {line_number} claim fields must be non-empty")
        atomicity = assess_atomicity(predicate, object_value)
        uncertainties = (
            ()
            if atomicity.independently_supportable
            else (
                ExtractionUncertainty(
                    code="atomicity",
                    detail=atomicity.rationale,
                    recorded_by="parser",
                ),
            )
        )
        parsed.append(
            ParsedClaimLine(
                line_number=line_number,
                entity_id=entity_id,
                predicate=predicate,
                object=object_value,
                uncertainties=uncertainties,
            )
        )
    return tuple(parsed)
