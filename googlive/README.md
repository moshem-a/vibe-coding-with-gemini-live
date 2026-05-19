# Gemini Live · Demo Suite

A polished, on-stage demo of **Gemini Live** built for Google Summit. Four interactive scenarios, all powered by **Gemini Live 2.5 Flash** (swap to **Gemini Live 3.1 Flash** when GA — see [Updating the model](#updating-the-model)). Voice in, voice out, vision, tool-calling, function-based UI manipulation — all streaming over the Live API WebSocket.

```
┌─ Hub
├─ Scenario A · Solutions Architect (voice + GCP diagrams)
├─ Scenario B · Visual Product Survey (camera + report)
├─ Scenario C · Pair with Cody (4-phase: Discovery → Architecture → Build → Preview)
└─ Scenario D · Live Translation (15 languages, side-by-side)
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Static HTML + React 18 (in-browser Babel for JSX) |
| Live AI | `gemini-live-2.5-flash-preview` via WebSocket (`generativelanguage.googleapis.com`) |
| Audio | AudioWorklet (16 kHz PCM capture) + AudioBufferSource queue (24 kHz playback) |
| Diagrams | **Mermaid** with Google Cloud-themed classDefs |
| Packaging | JSZip (in-browser export to .zip) |
| Hosting target | **Cloud Run** (Nginx serving static assets) |

---

## Quick start — run locally

The app is plain static HTML; any local server works.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

On first load, paste your Google AI Studio key (https://aistudio.google.com/app/apikey). It's stored in `localStorage` only — never sent anywhere except Google.

---

## Deploy to Cloud Run

> Instructions written for Claude Code or any agentic dev tool. Paste this section into Claude Code and run.

### Prerequisites

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

### 1. Add a `Dockerfile`

```dockerfile
# Dockerfile
FROM nginx:1.27-alpine

# Strip default config, add our own
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the entire static site
COPY . /usr/share/nginx/html

# Cloud Run listens on $PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "sed -i \"s/listen 8080/listen ${PORT}/g\" /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

### 2. Add `nginx.conf`

```nginx
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # SPA-style fallback (we only have one HTML file but this is safe)
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Long-cache hashed assets; never cache index.html
  location ~* \.(css|js|jsx|woff2?|ttf|svg|png|jpg)$ {
    expires 1h;
    add_header Cache-Control "public, max-age=3600";
  }
  location = /index.html {
    add_header Cache-Control "no-store";
  }

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
```

### 3. Add `.dockerignore`

```
.git
node_modules
*.md
.DS_Store
```

### 4. Build & deploy

```bash
# One-shot from source — Cloud Build packages and pushes to Artifact Registry, then deploys.
gcloud run deploy gemini-live-demo \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080
```

Your URL will look like `https://gemini-live-demo-XXXXXXXX-uc.a.run.app`.

### 5. (Optional) Inject the API key at runtime via Secret Manager

For an on-stage demo, the cleanest path is to NOT bake the key in — users still paste their own. But if you want to ship a stage build with the key embedded:

```bash
# Store the key
echo -n "YOUR_AI_STUDIO_KEY" | gcloud secrets create gemini-key --data-file=-

# Render it into the page at build time via a sed step in Cloud Build,
# or expose a /config endpoint from a tiny sidecar. Avoid committing the key.
```

---

## Updating the model

The model id is set in each scenario file at the top of the `useLiveSession` call:

```js
model: "models/gemini-live-2.5-flash-preview",
```

When **Gemini Live 3.1 Flash** is available, replace that string with the new id (likely `models/gemini-live-3.1-flash` or similar — check https://ai.google.dev/gemini-api/docs/models). Files to edit:

- `scenario-architect.jsx`
- `scenario-survey.jsx`
- `scenario-code.jsx`
- `scenario-translate.jsx`

Or pull the id into a single `config.js` constant if you want one knob.

---

## File map

```
.
├── index.html                  # Shell + CDN scripts (React, Babel, Mermaid, JSZip)
├── styles.css                  # Google Cloud + Gemini-gradient design tokens
├── audio.js                    # Mic capture (16k) + playback queue (24k)
├── audio-worklet.js            # PCM capture worklet
├── gemini-live.js              # WebSocket client for the Live API
├── components.jsx              # Shared UI (AppBar, Waveform, Transcript, etc.)
├── gcp-icons.jsx               # MermaidDiagram component (GCP-themed)
├── hub.jsx                     # Landing dashboard with 4 scenario cards
├── scenario-architect.jsx      # A: Solutions Architect (voice + Mermaid diagrams)
├── scenario-survey.jsx         # B: Visual Survey (camera + report tabs)
├── scenario-code.jsx           # C: Pair with Cody (4-phase build + live preview)
├── scenario-translate.jsx      # D: Live Translation (15 languages)
└── app.jsx                     # Router / setup card
```

---

## Function-calling contract

Each scenario gives Gemini a small toolset. Highlights:

**Architect (`scenario-architect.jsx`)**
- `create_architecture_diagram({ title, description, mermaid })` — renders a Mermaid flowchart on screen. Each call is preserved as a new diagram version, navigable with ← / →.

**Cody (`scenario-code.jsx`)** — full build flow
- `propose_architecture({ version, title, description, mermaid })`
- `approve_architecture({ version })`
- `start_build()`
- `write_file({ filename, language, content, summary })`
- `update_file({ filename, content, summary })` — used during the live-edit preview phase
- `show_preview()`

**Survey (`scenario-survey.jsx`)**
- `update_survey({ product_name, brand, expiry_visible, cap_intact, … })`
- `request_photo({ label, reason })` — captures a still from the camera

**Translate (`scenario-translate.jsx`)**
- No tools — uses Live API's `inputAudioTranscription` + `outputAudioTranscription` + `speechConfig.languageCode`.

---

## Mermaid theming

Every diagram inherits Google Cloud-styled classDefs (injected automatically if missing):

| Class | Used for | Color |
|-------|----------|-------|
| `compute`     | Cloud Run, Functions, GKE, App Engine | Blue (#1A73E8) |
| `data`        | BigQuery, Firestore, Spanner, SQL, GCS, Bigtable | Yellow (#F9AB00) |
| `messaging`   | Pub/Sub, Eventarc, Scheduler, Tasks | Green (#34A853) |
| `ai`          | Vertex AI, Gemini, Vision, Speech, Translate | Purple (#9B72CB) |
| `networking`  | Load Balancing, CDN, API Gateway, Armor | Red (#EA4335) |
| `user`        | End users, browsers, mobile clients | Grey |
| `external`    | Third-party APIs, on-prem systems | Dashed grey |

Models are instructed to apply them via `class node1,node2 compute`.

---

## Permissions

Each scenario asks for permissions on launch:

| Scenario | Mic | Camera |
|----------|-----|--------|
| Architect | ✅ | — |
| Survey    | ✅ | ✅ |
| Cody      | ✅ | — |
| Translate | ✅ | — |

---

## On-stage tips

- Run on **Chrome** for the most reliable AudioWorklet + getUserMedia behavior.
- Hard-wire your mic; the AEC/NS filters in the browser are tuned for laptops, not stage mics.
- Pre-warm the WebSocket: open each scenario for a second before going live so the connection chip is green.
- If a scenario gets stuck, hit **Esc** to return to the hub and re-enter — each scenario tears down its WebSocket on exit.

---

## License

Built for the Google Summit Gemini Live demo. Use freely.
