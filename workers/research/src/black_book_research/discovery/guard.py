"""Discovery publication guard — discovery NEVER creates public entities (BB-039)."""

from __future__ import annotations

FORBIDDEN_DISCOVERY_OPERATIONS = frozenset(
    {
        "write_public_projection",
        "create_public_entity",
        "activate_release",
        "publish_snapshot",
    }
)


def assert_discovery_cannot_publish(*, operation: str, target: str | None = None) -> None:
    if operation in FORBIDDEN_DISCOVERY_OPERATIONS:
        suffix = f" (target={target})" if target else ""
        raise ValueError(f'Discovery cannot publish: operation "{operation}" is forbidden{suffix}')
