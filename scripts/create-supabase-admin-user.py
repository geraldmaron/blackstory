#!/usr/bin/env python3
"""Create or update BlackStory Supabase admin user. Secrets stay in memory/temp files only."""
from __future__ import annotations

import json
import secrets
import string
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

EMAIL = "geraldmdagher@outlook.com"
PROJECT_REF = "twykhihqkcldpreuovay"
PROJECT_URL = f"https://{PROJECT_REF}.supabase.co"
TMP_KEY = Path("/tmp/sb_service_role.key")
TMP_PASS = Path("/tmp/sb_admin_temp_password.txt")


def op_read(ref: str) -> str:
    return subprocess.check_output(["op", "read", ref], text=True).strip()


def http_json(method: str, url: str, headers: dict[str, str], body: dict | None = None) -> tuple[int, dict | list | None, str]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            parsed = json.loads(raw) if raw else None
            return resp.status, parsed, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = None
        return e.code, parsed, raw


def main() -> int:
    # Prefer project secret from 1Password (Management API may be Cloudflare-blocked).
    svc = None
    for ref in (
        "op://Private/Supabase: blackstory-app/secret_key",
        "op://Private/7jhjw3akucs4ew2wt4xwrp765q/secret_key",
    ):
        try:
            candidate = op_read(ref)
            if candidate:
                svc = candidate
                print(f"using_op_ref_ok len={len(svc)}")
                break
        except subprocess.CalledProcessError:
            continue

    if not svc:
        token = op_read("op://Private/Supabase/credential")
        status, keys, raw = http_json(
            "GET",
            f"https://api.supabase.com/v1/projects/{PROJECT_REF}/api-keys",
            {"Authorization": f"Bearer {token}"},
        )
        if status != 200 or not isinstance(keys, list):
            print(f"api-keys fetch failed http={status} body={raw[:300]}", file=sys.stderr)
            return 1
        for k in keys:
            name = (k.get("name") or "").lower()
            val = k.get("api_key") or k.get("key") or ""
            print(f"key_name={name or '?'} len={len(val)}")
            if name in ("service_role", "service role") or "service_role" in str(k.get("tags") or ""):
                svc = val
        if not svc:
            for k in keys:
                if "service" in (k.get("name") or "").lower():
                    svc = k.get("api_key") or k.get("key")
                    break

    if not svc:
        print("no service_role/secret key found", file=sys.stderr)
        return 1

    TMP_KEY.write_text(svc)
    TMP_KEY.chmod(0o600)

    auth_headers = {
        "Authorization": f"Bearer {svc}",
        "apikey": svc,
    }

    # List users filtered by email
    status, listed, raw = http_json(
        "GET",
        f"{PROJECT_URL}/auth/v1/admin/users?page=1&per_page=200",
        auth_headers,
    )
    if status != 200:
        print(f"list users failed http={status} body={raw[:400]}", file=sys.stderr)
        return 1

    users = []
    if isinstance(listed, dict):
        users = listed.get("users") or []
    elif isinstance(listed, list):
        users = listed

    existing = next((u for u in users if (u.get("email") or "").lower() == EMAIL.lower()), None)

    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_"
    temp_password = "".join(secrets.choice(alphabet) for _ in range(28))
    TMP_PASS.write_text(temp_password)
    TMP_PASS.chmod(0o600)

    app_meta = {"bb_role": "admin"}

    if existing:
        uid = existing["id"]
        status, updated, raw = http_json(
            "PUT",
            f"{PROJECT_URL}/auth/v1/admin/users/{uid}",
            auth_headers,
            {
                "app_metadata": app_meta,
                "email_confirm": True,
                "password": temp_password,
            },
        )
        if status not in (200, 201):
            print(f"update user failed http={status} body={raw[:500]}", file=sys.stderr)
            return 1
        user = updated if isinstance(updated, dict) else existing
        action = "updated"
    else:
        status, created, raw = http_json(
            "POST",
            f"{PROJECT_URL}/auth/v1/admin/users",
            auth_headers,
            {
                "email": EMAIL,
                "password": temp_password,
                "email_confirm": True,
                "app_metadata": app_meta,
            },
        )
        if status not in (200, 201) or not isinstance(created, dict):
            print(f"create user failed http={status} body={raw[:500]}", file=sys.stderr)
            return 1
        user = created
        action = "created"

    uid = user.get("id")
    email = user.get("email")
    role = (user.get("app_metadata") or {}).get("bb_role")
    print(f"action={action}")
    print(f"user_id={uid}")
    print(f"email={email}")
    print(f"bb_role={role}")
    print(f"temp_password_file={TMP_PASS}")

    # Store temp password into 1Password as a new item field if possible (best-effort)
    try:
        # Create/update a Private vault note for the admin bootstrap password
        title = "BlackStory Supabase Admin (blackstory-app)"
        # Prefer updating existing item by title if present
        listed = subprocess.run(
            ["op", "item", "list", "--vault", "Private", "--format", "json"],
            check=True,
            capture_output=True,
            text=True,
        )
        items = json.loads(listed.stdout)
        match = next((i for i in items if i.get("title") == title), None)
        if match:
            subprocess.run(
                [
                    "op",
                    "item",
                    "edit",
                    match["id"],
                    f"password={temp_password}",
                    f"username={EMAIL}",
                    "notesPlain=Temporary admin password for Supabase Auth blackstory-app. Rotate after first login. app_metadata.bb_role=admin.",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            print("onepassword=updated_existing_item")
        else:
            subprocess.run(
                [
                    "op",
                    "item",
                    "create",
                    "--category",
                    "Login",
                    "--vault",
                    "Private",
                    "--title",
                    title,
                    f"username={EMAIL}",
                    f"password={temp_password}",
                    f"--url={PROJECT_URL}",
                    "notesPlain=Temporary admin password for Supabase Auth blackstory-app. Rotate after first login. app_metadata.bb_role=admin.",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            print("onepassword=created_item")
    except Exception as exc:  # noqa: BLE001
        print(f"onepassword=skipped ({type(exc).__name__})")

    return 0 if role == "admin" and uid else 1


if __name__ == "__main__":
    raise SystemExit(main())
