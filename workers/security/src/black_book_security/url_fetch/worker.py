"""Network-agnostic fetch-worker state machine with strict quarantine and limits."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import time
from typing import Callable, Protocol
from urllib.parse import urljoin

from .policy import (
    ParsedUrl,
    UrlPolicyError,
    canonical_ip,
    parse_external_url,
    pin_destination,
)


@dataclass(frozen=True)
class FetchLimits:
    """Hard limits applied across the complete redirect chain."""

    max_redirects: int = 4
    max_response_bytes: int = 2 * 1024 * 1024
    max_duration_seconds: float = 10.0
    allowed_content_types: tuple[str, ...] = (
        "text/html",
        "text/plain",
        "application/xhtml+xml",
    )


@dataclass(frozen=True)
class TransportRequest:
    """Request requiring direct connection to pinned_address with hostname as SNI."""

    url: str
    hostname: str
    port: int
    pinned_address: str
    max_response_bytes: int
    remaining_seconds: float
    allowed_content_types: tuple[str, ...]


@dataclass(frozen=True)
class TransportResponse:
    """Bounded transport response supplied by the isolated network adapter."""

    status: int
    headers: dict[str, str]
    remote_address: str
    body: bytes


@dataclass(frozen=True)
class FetchOutcome:
    """Fail-closed worker result that never authorizes publication."""

    state: str
    publication_allowed: bool = False
    reason: str | None = None
    final_url: str | None = None
    content_hash: str | None = None
    malware_indicators: tuple[str, ...] = ()


class Resolver(Protocol):
    """DNS adapter contract; production must return all A and AAAA answers."""

    def __call__(self, hostname: str) -> tuple[str, ...]: ...


class Transport(Protocol):
    """Pinned transport contract implemented only inside the restricted worker."""

    def __call__(self, request: TransportRequest) -> TransportResponse: ...


REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


def _reject(reason: str) -> FetchOutcome:
    return FetchOutcome(state="rejected", reason=reason)


def _malware_indicators(body: bytes, content_type: str) -> tuple[str, ...]:
    indicators: list[str] = []
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in body:
        indicators.append("eicar_test_signature")
    if body.startswith((b"MZ", b"\x7fELF")):
        indicators.append("executable_magic")
    if "html" in content_type:
        lowered = body.lower()
        if any(marker in lowered for marker in (b"<script", b"<iframe", b"javascript:")):
            indicators.append("active_content")
    return tuple(indicators)


def evaluate_job(
    submitted_url: str,
    *,
    resolve: Resolver,
    transport: Transport,
    limits: FetchLimits = FetchLimits(),
    clock: Callable[[], float] = time.monotonic,
    allowed_domains: tuple[str, ...] | None = None,
    denied_domains: tuple[str, ...] = (),
) -> FetchOutcome:
    """Fetch through injected DNS/transport adapters; never use this in request intake."""
    started = clock()
    current_url = submitted_url
    for redirect_count in range(limits.max_redirects + 1):
        if clock() - started >= limits.max_duration_seconds:
            return _reject("duration_exceeded")
        try:
            parsed: ParsedUrl = parse_external_url(
                current_url,
                allowed_domains=allowed_domains,
                denied_domains=denied_domains,
            )
            answers = () if canonical_ip(parsed.hostname) is not None else resolve(parsed.hostname)
            destination = pin_destination(parsed, answers)
        except UrlPolicyError as error:
            return _reject(str(error))
        response = transport(
            TransportRequest(
                destination.url.normalized_url,
                destination.url.hostname,
                destination.url.port,
                destination.pinned_address,
                limits.max_response_bytes,
                max(0.0, limits.max_duration_seconds - (clock() - started)),
                limits.allowed_content_types,
            )
        )
        if clock() - started >= limits.max_duration_seconds:
            return _reject("duration_exceeded")
        if response.remote_address != destination.pinned_address:
            return _reject("connected_address_mismatch")
        if response.status in REDIRECT_STATUSES:
            if redirect_count >= limits.max_redirects:
                return _reject("redirect_limit_exceeded")
            location = response.headers.get("location")
            if not location:
                return _reject("redirect_missing_location")
            current_url = urljoin(destination.url.normalized_url, location)
            continue
        content_type = response.headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
        if content_type not in limits.allowed_content_types:
            return _reject("content_type_not_allowed")
        declared_length = response.headers.get("content-length")
        if declared_length is not None:
            try:
                if int(declared_length) > limits.max_response_bytes:
                    return _reject("response_too_large")
            except ValueError:
                return _reject("invalid_content_length")
        if len(response.body) > limits.max_response_bytes:
            return _reject("response_too_large")
        indicators = _malware_indicators(response.body, content_type)
        if indicators:
            return FetchOutcome(
                state="rejected",
                reason="malware_indicator",
                malware_indicators=indicators,
            )
        return FetchOutcome(
            state="validated",
            final_url=destination.url.normalized_url,
            content_hash=hashlib.sha256(response.body).hexdigest(),
        )
    return _reject("redirect_limit_exceeded")
