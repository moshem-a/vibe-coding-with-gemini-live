#!/usr/bin/env python3
"""Dev server for the Gemini Live demo.

Reads googlive/.env, materialises config.local.js with
window.__GEMINI_API_KEY, then serves the googlive/ directory.
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import socketserver
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE / ".env"
CONFIG_FILE = HERE / "config.local.js"

KEY_PATTERN = re.compile(
    r'^\s*(?:export\s+)?gemini_api_key\s*=\s*["\']?([^"\'\s#]+)',
    re.IGNORECASE | re.MULTILINE,
)
PROXY_PATTERN = re.compile(
    r'^\s*(?:export\s+)?agent_proxy_url\s*=\s*["\']?([^"\'\s#]+)',
    re.IGNORECASE | re.MULTILINE,
)


def _read_field(pattern: re.Pattern) -> str:
    if not ENV_FILE.exists():
        return ""
    match = pattern.search(ENV_FILE.read_text(encoding="utf-8"))
    return match.group(1).strip() if match else ""


def read_key() -> str:
    return _read_field(KEY_PATTERN)


def read_proxy_url() -> str:
    return _read_field(PROXY_PATTERN) or os.environ.get("AGENT_PROXY_URL", "")


def write_config(key: str, proxy_url: str) -> None:
    body = (
        f"window.__GEMINI_API_KEY = {json.dumps(key)};\n"
        f"window.__AGENT_PROXY_URL = {json.dumps(proxy_url)};\n"
    )
    CONFIG_FILE.write_text(body, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=os.environ.get("PORT", "8000"))
    parser.add_argument("--bind", default="0.0.0.0")
    args = parser.parse_args()

    key = read_key()
    proxy_url = read_proxy_url()
    write_config(key, proxy_url)
    if key:
        print(f"[serve.py] Injected Gemini API key from {ENV_FILE.name} "
              f"(…{key[-6:]})", file=sys.stderr)
    else:
        print(f"[serve.py] No key found in {ENV_FILE.name}; "
              "SetupCard will prompt for one.", file=sys.stderr)
    if proxy_url:
        print(f"[serve.py] Agent proxy URL: {proxy_url}", file=sys.stderr)
    else:
        print("[serve.py] No AGENT_PROXY_URL set; sub-agent calls "
              "(consult_designer/qa) will fail until configured.",
              file=sys.stderr)

    os.chdir(HERE)
    handler = http.server.SimpleHTTPRequestHandler

    class ReuseTCPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    try:
        port = int(args.port)
    except ValueError:
        print(f"[serve.py] Invalid port: {args.port!r}", file=sys.stderr)
        return 2

    with ReuseTCPServer((args.bind, port), handler) as httpd:
        print(f"[serve.py] Serving {HERE} on http://{args.bind}:{port}",
              file=sys.stderr)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[serve.py] Shutting down", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
