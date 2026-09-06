#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Set the GLM API secrets on the Homeino GitHub repo — one command, then the
daily content cron (magazine-daily.yml + inspiration-daily.yml) runs on the
official z.ai GLM API.

Usage:
    python3 scripts/set-glm-gh-secrets.py <GLM_API_KEY> [repo]

Defaults:
    repo = vahidaskari1365/homeino1  (or GITHUB_REPO / GH_REPO env)
    key  = falls back to GLM_API_KEY env when omitted

Secrets written:
    LLM_API_KEY  = <GLM key>
    LLM_BASE_URL = https://api.z.ai/api/paas/v4
    LLM_MODEL    = glm-4.7-flash   (100% free; bump to glm-5.3 for quality)

Requires: pynacl  (pip install pynacl) + a repo-scoped GitHub token in
GITHUB_TOKEN / GH_TOKEN env, or the token stored in homeino-pipeline/.env.
The key/token are only sent to GitHub's API over TLS — never committed.
"""
import base64
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen

REPO_DEFAULT = "vahidaskari1365/homeino1"
LLM_BASE_URL = "https://api.z.ai/api/paas/v4"
LLM_MODEL = "glm-4.7-flash"

API = "https://api.github.com"


def load_github_token() -> str:
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    if tok:
        return tok.strip()
    env_file = Path("/home/z/my-project/homeino-pipeline/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.strip().startswith("GITHUB_TOKEN="):
                return line.split("=", 1)[1].strip()
    sys.exit("ERROR: no GitHub token (set GITHUB_TOKEN or homeino-pipeline/.env)")


def gh(token: str, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    req = Request(
        f"{API}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "homeino-secrets-setup",
        },
        method=method,
    )
    with urlopen(req, timeout=30) as res:
        return res.status, json.loads(res.read() or b"{}")


def main() -> None:
    key = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GLM_API_KEY", "")
    repo = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("GITHUB_REPO", REPO_DEFAULT)
    if not key.strip():
        sys.exit("Usage: set-glm-gh-secrets.py <GLM_API_KEY> [repo]")
    key = key.strip()

    try:
        from nacl import encoding, public  # pynacl
    except ImportError:
        sys.exit("pip install pynacl  → then re-run")

    token = load_github_token()
    status, me = gh(token, "GET", "/user")
    if status != 200:
        sys.exit(f"GitHub token invalid (HTTP {status})")
    print(f"✔ token OK (account: {me.get('login')})")

    pk_status, pk = gh(token, "GET", f"/repos/{repo}/actions/secrets/public-key")
    if pk_status != 200:
        sys.exit(f"cannot read repo public key (HTTP {pk_status}) — token needs repo scope on {repo}")
    pk_obj = public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(pk_obj)

    for name, raw in (
        ("LLM_API_KEY", key),
        ("LLM_BASE_URL", LLM_BASE_URL),
        ("LLM_MODEL", LLM_MODEL),
    ):
        enc = base64.b64encode(sealed.encrypt(raw.encode())).decode()
        st, _ = gh(token, "PUT", f"/repos/{repo}/actions/secrets/{name}",
                   {"encrypted_value": enc, "key_id": pk["key_id"]})
        if st in (201, 204):
            shown = f"{raw[:8]}…" if name == "LLM_API_KEY" else raw
            print(f"✔ {name} = {shown}")
        else:
            sys.exit(f"✘ {name} failed (HTTP {st})")

    print(f"\nDone — daily cron on {repo} now runs on the official GLM API.")
    print("Trigger a test run: repo → Actions → magazine-daily → Run workflow.")


if __name__ == "__main__":
    main()
