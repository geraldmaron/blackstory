"""Discovery-run stamping with query-pack version (BB-038)."""

from __future__ import annotations

from .types import DiscoveryRunContext, QueryPack, StampedDiscoveryRun


def stamp_discovery_run(
    context: DiscoveryRunContext,
    pack: QueryPack,
    stamped_at: str,
) -> StampedDiscoveryRun:
    if not context.run_id.strip():
        raise ValueError("Discovery run_id is required")
    if not context.adapter_id.strip():
        raise ValueError("Discovery adapter_id is required")
    if not context.started_at.strip():
        raise ValueError("Discovery started_at is required")
    if not stamped_at.strip():
        raise ValueError("stamped_at is required")

    return StampedDiscoveryRun(
        run_id=context.run_id,
        adapter_id=context.adapter_id,
        started_at=context.started_at,
        entity_kind=context.entity_kind,
        theme=context.theme,
        query_pack_id=pack.id,
        query_pack_version_id=pack.version_id,
        query_pack_semver=pack.version.semver,
        query_pack_content_hash=pack.version.content_hash,
        stamped_at=stamped_at,
    )


def assert_discovery_run_stamped(run: StampedDiscoveryRun) -> None:
    if "+" not in run.query_pack_version_id:
        raise ValueError("Stamped discovery run must include composite query_pack_version_id")
    if not run.query_pack_content_hash or len(run.query_pack_content_hash) != 64:
        raise ValueError("Stamped discovery run must include sha256 query_pack_content_hash")
