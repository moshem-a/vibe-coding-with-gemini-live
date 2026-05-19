"""Browser-facing proxy in front of the Designer and QA ADK agents on
Vertex AI Agent Engine.

The browser cannot authenticate to Agent Engine directly (no ADC, no CORS
on the Vertex API). This service holds the ADC creds, fans out to whichever
engine matches the URL path, and streams the engine's events back as JSON.

Engine resource names are baked into the image as deployed_engines.json,
produced by ../agents/deploy.py during the Cloud Build run.
"""
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List

import vertexai
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from vertexai import agent_engines

PROJECT  = os.environ["GCP_PROJECT"]
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")

ENGINES_FILE = Path(__file__).parent / "deployed_engines.json"
if not ENGINES_FILE.exists():
    raise RuntimeError(
        "deployed_engines.json missing — run the agents/cloudbuild.yaml "
        "build step before deploying the proxy."
    )
ENGINES: Dict[str, str] = json.loads(ENGINES_FILE.read_text())

vertexai.init(project=PROJECT, location=LOCATION)
_remote_engines = {role: agent_engines.get(rn) for role, rn in ENGINES.items()}

app = FastAPI(title="googlive-agents proxy")

# Allow either a single origin (production) or wildcard (local dev).
origins = ["*"] if ALLOWED_ORIGIN == "*" else [ALLOWED_ORIGIN]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["content-type", "x-session-id"],
)

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def _coerce_json(text: str) -> Any:
    """Agents sometimes wrap JSON in code fences or prose. Pull the first
    balanced {...} block and parse it. Fall back to the raw text."""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = _JSON_BLOCK.search(text)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return text
        return text


def _extract_final_text(events: List[dict]) -> str:
    """Walk the ADK event stream and concatenate the final model text."""
    chunks: List[str] = []
    for ev in events:
        content = ev.get("content") if isinstance(ev, dict) else None
        if not content:
            continue
        for part in content.get("parts", []) or []:
            txt = part.get("text")
            if txt:
                chunks.append(txt)
    return "".join(chunks)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "engines": list(ENGINES.keys())}


@app.post("/api/agents/{role}")
async def consult(role: str, req: Request) -> dict:
    if role not in _remote_engines:
        raise HTTPException(404, f"unknown agent role: {role}")
    body = await req.json()
    message: str = body.get("message", "")
    if not message:
        raise HTTPException(400, "message is required")

    user_id = req.headers.get("x-session-id") or body.get("session_id") or "anon"

    engine = _remote_engines[role]

    # Agent Engine requires an explicit session per user before stream_query
    # will produce events for that user_id.
    session_id = None
    try:
        sess = engine.create_session(user_id=user_id)
        if isinstance(sess, dict):
            session_id = sess.get("id") or sess.get("session_id") or sess.get("name")
        else:
            session_id = getattr(sess, "id", None) or getattr(sess, "name", None)
        print(f"[{role}] created session {session_id}", flush=True)
    except Exception as e:
        print(f"[{role}] create_session failed: {e!r}", flush=True)

    events: List[dict] = []
    sq_kwargs = {"message": message, "user_id": user_id}
    if session_id:
        sq_kwargs["session_id"] = session_id
    try:
        for event in engine.stream_query(**sq_kwargs):
            events.append(event)
    except TypeError:
        # older stream_query signature: drop session_id
        for event in engine.stream_query(message=message, user_id=user_id):
            events.append(event)

    print(f"[{role}] stream_query returned {len(events)} events", flush=True)
    for i, ev in enumerate(events):
        print(f"[{role}] event {i}: {json.dumps(ev, default=str)[:500]}", flush=True)

    final_text = _extract_final_text(events)
    parsed = _coerce_json(final_text)

    return {
        "role": role,
        "engine_resource_name": ENGINES[role],
        "result": parsed,
        "text": final_text,
        "session_user_id": user_id,
    }
