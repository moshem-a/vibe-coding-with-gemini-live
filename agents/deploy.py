"""Deploy the Designer and QA ADK agents to Vertex AI Agent Engine.

Runs inside Cloud Build (no local pip available). Writes the resulting engine
resource names to two places:
  - stdout (so Cloud Build logs show them)
  - /workspace/deployed_engines.json (so the next build step can bake it into
    the proxy image)
"""
import json
import os
import sys

import vertexai
from vertexai import agent_engines

from designer.agent import root_agent as designer_agent
from qa.agent import root_agent as qa_agent

PROJECT  = os.environ.get("GCP_PROJECT",  "agentic-system-488914")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
BUCKET   = os.environ.get("STAGING_BUCKET",
                          f"gs://{PROJECT}-agent-staging")

REQS = [
    "google-adk>=0.5.0",
    "google-cloud-aiplatform[agent_engines,adk]>=1.95.0",
]

vertexai.init(project=PROJECT, location=LOCATION, staging_bucket=BUCKET)

AGENTS = [("designer", designer_agent), ("qa", qa_agent)]

# Reuse existing engines if their display_name already exists, so reruns
# don't spawn duplicates.
existing = {e.display_name: e for e in agent_engines.list()}

resource_names = {}
for slug, agent in AGENTS:
    display = f"googlive-{slug}"
    if display in existing:
        eng = existing[display]
        print(f"[{slug}] reusing existing engine: {eng.resource_name}",
              file=sys.stderr)
        eng.update(agent_engine=agent, requirements=REQS)
    else:
        print(f"[{slug}] creating new engine...", file=sys.stderr)
        eng = agent_engines.create(
            agent_engine=agent,
            requirements=REQS,
            display_name=display,
            description=agent.description,
        )
        print(f"[{slug}] created: {eng.resource_name}", file=sys.stderr)
    resource_names[slug] = eng.resource_name

out_path = os.environ.get("OUTPUT_PATH", "/workspace/deployed_engines.json")
os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
with open(out_path, "w") as f:
    json.dump(resource_names, f, indent=2)
print(json.dumps(resource_names, indent=2))
