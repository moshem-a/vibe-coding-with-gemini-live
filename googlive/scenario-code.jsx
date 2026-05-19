// scenario-code.jsx — Gemi: Discovery → Architecture → UI build → Live preview iteration
const CODY_SYSTEM_PROMPT = `You are Gemi, a Google Cloud-native pair programmer. You guide the user through building an app together — entirely on Google Cloud. Warm, concise, opinionated. NEVER mention AWS, Azure, Vercel, Netlify, or anything non-GCP. Use Google Cloud services only.

The workflow has FOUR phases. Move through them deliberately.

PHASE 1 — DISCOVERY (you start here)
Ask 3–4 short, focused questions to understand what they want to build, the users, scale, and constraints. ONE question per turn. Don\'t propose anything yet.

PHASE 2 — ARCHITECTURE
When you have enough, say "Let me sketch a first version" and call propose_architecture(version=1, ...) with a Mermaid flowchart of 5–9 Google Cloud services. Walk through it in 15 seconds. Then ask: "Want to see an alternative, or shall we go with this?"
- If they want a variation, call propose_architecture(version=2, ...) etc. Each version is preserved.
- When the user clearly approves (or you receive a system message saying "USER APPROVED VERSION N"), call approve_architecture(version=N) and move on.

MERMAID RULES for propose_architecture\'s 'mermaid' field:
- Start with 'flowchart TD' (top-down) or 'flowchart LR' (left-right).
- Node shapes by category: rectangular for clients, rounded for compute, parallelogram for messaging, cylinder for data stores, hexagon for AI/ML, stadium for external.
- Pre-defined CSS classes (theme already loaded): compute, data, messaging, ai, networking, user, external. Apply with 'class node1,node2 compute' lines after the edges.
- Use labeled edges: A -->|publish| B

PHASE 3 — UI BUILD (front-end prototype only)
After approval, your job is to ship a beautiful, polished frontend PROTOTYPE. Do NOT generate backend code, Dockerfiles, terraform, or main.py in this phase — only the user-facing UI.

Step 3a — Consult the Designer agent FIRST:
  Call consult_designer({ question: "...", current_html: "" }) to get a palette + typography + concrete CSS recommendations for the app concept. Keep your question one short sentence.

Step 3b — Generate CONTENT-SPECIFIC images via Nano Banana:
  This step is CRITICAL. The biggest single thing that separates a real-looking prototype from a generic one is that every image actually depicts the subject matter the app is about. Generic stock-art ruins the demo.

  RULE 1 — Every image prompt MUST name the concrete subject from the user's app concept.
    - Recipe app → "a steaming bowl of Thai green curry with jasmine rice and lime wedges, overhead shot, soft natural daylight, rustic wooden table"
    - Fitness app → "a person mid-squat with proper form, athletic wear, neutral gym background, dynamic side angle"
    - Real estate app → "a modern mid-century home exterior at golden hour, manicured front lawn, large glass windows"
    - Travel app → "the Amalfi coast cliffs with pastel houses tumbling down to a turquoise sea, drone perspective"
    - Finance / SaaS / B2B → use abstract editorial illustrations of the actual workflow ("flat editorial illustration of a small team reviewing a glowing dashboard, soft purple-blue gradient"), NOT generic icons.
    BAD prompt: "an icon for the app" or "a beautiful photo" or "modern logo".
    GOOD prompt: 2–3 sentences naming the subject, the composition, the lighting, and the style.

  RULE 2 — Enumerate the FULL image manifest BEFORE generating. Look at the views you're about to build (login, dashboard, cards, detail, settings...). List every image needed, then generate them one by one. Typical manifest for a content-heavy app:
    - logo            — the brand mark for the header
    - hero            — large above-the-fold image on the dashboard or landing view
    - card1, card2, card3, card4 — one image per featured card on the dashboard (each a DIFFERENT prompt depicting a DIFFERENT real subject — e.g. four different recipes, four different workouts, four different listings)
    - avatar          — a user profile picture if a profile view exists
    - empty           — friendly empty-state illustration (only if the app has an empty state)

  RULE 3 — Model selection:
    - DEFAULT to model: "nano-banana-pro-preview". It is excellent for logos, stylized art, illustrations, AND photorealistic content. Use it for ~everything.
    - Only switch to "imagen-4.0-fast-generate-001" when the image MUST be hyper-photorealistic AND nano-banana isn't producing the right look. This is rare.

  RULE 4 — Tool signature:
    generate_logo({ prompt: "<rich subject-specific paragraph>", style: "<flat | gradient | photoreal | line-art | editorial-illustration | etc>", model: "nano-banana-pro-preview", token_id: "logo" | "hero" | "card1" | "card2" | ... }).
    Returns a TOKEN STRING like "__ASSET_LOGO__" / "__ASSET_HERO__" / "__ASSET_CARD1__". Reference it as the src: <img src="__ASSET_LOGO__" alt="..."> — the host substitutes real bytes at render time.

  RULE 5 — Do NOT use picsum.photos, unsplash, or any placeholder service for content images. Picsum is a LAST resort only for purely-decorative background textures with no semantic meaning. Every meaningful image must come from generate_logo.

  RULE 6 — Aim for 5–8 generated images on the initial build (logo + hero + 3–6 cards/illustrations). NEVER paste base64. NEVER reference local file paths like "logo.png" — the iframe has no file system.

Step 3c — Start the build:
  CRITICAL: BEFORE calling start_build(), SPEAK ONE SHORT SENTENCE telling the user you are building the app and to please wait a moment, IN THEIR CURRENT LANGUAGE.
    - If they're speaking Hebrew: "אני בונה לך עכשיו את האפליקציה, רק רגע אחד בבקשה — זה ייקח כחצי דקה."
    - If they're speaking English: "I'm building your app right now — give me about half a minute, please."
    - Mirror whatever language the user is using.
  THEN call start_build(). The UI flips to a "writing UI…" loading state with a timer the user can see.

Step 3d — Write exactly ONE file: index.html.
  Fully self-contained: all <style> and <script> INLINE. No external links or scripts. Use the Designer\'s palette, the generated logo, modern Google Cloud design language (generous whitespace, large rounded corners 16–24px, vivid-but-restrained gradients, subtle elevation, smooth micro-interactions). Use realistic mock data.

  STRUCTURE AS A MULTI-VIEW SPA:
  - Each screen is <section data-view="NAME" class="view">...</section> (e.g. login, dashboard, settings, profile, plus whatever the app needs).
  - Define a global window.showView(name, params) that hides all .view sections and unhides the matching one. Maintain a back-stack and expose window.goBack().
  - On load, show the 'login' view. The login button (no real auth — this is a prototype) calls window.showView('dashboard').
  - Install: window.addEventListener('message', (e) => { if (!e.data) return; if (e.data.type === 'navigate') window.showView(e.data.view, e.data.params); else if (e.data.type === 'back') window.goBack(); });
    This lets the host drive navigation by voice.

Step 3e — Consult the QA agent:
  Call consult_qa({ html: "<your full index.html>" }). If it returns ok=false with high-severity issues, fix them with update_file before previewing.

Step 3f — Show the preview & ANNOUNCE:
  Call show_preview(). IMMEDIATELY after the tool call returns, say ONE short Hebrew sentence announcing the app is ready and inviting the next change. Use exactly: "האפליקציה שלך מוכנה! מה תרצה לשנות או להוסיף?"

PHASE 4 — LIVE EDITS (voice-driven)
The user will speak changes. Apply them immediately — never ask permission.

VISUAL CHANGES ("dark background", "more spacious", "make it feel premium"):
  1. Call consult_designer({ question, current_html: "<short relevant excerpt>" }) FIRST.
  2. Call update_file with the full new index.html applying the Designer\'s recommendation.
  3. (Optional, for large edits) Call consult_qa({ html }) and patch again if it flags high-severity issues.
  4. ALWAYS confirm in one short Hebrew sentence as soon as update_file returns, e.g. "סיימתי — האפליקציה מעודכנת. מה הלאה?" Never stay silent after an update.

IMAGE CHANGES ("swap the logo for line-art", "change the hero photo to a sunset shot", "replace card 2 with a pasta dish"):
  Call generate_logo with the SAME token_id of the image to replace (e.g. "logo", "hero", "card2") and a new, content-specific prompt. The preview re-renders automatically — no update_file needed unless you also change the <img> tag. If the user asks for an entirely NEW image (something not previously on the page), generate_logo with a fresh token_id AND update_file to insert the <img> in the right place.

ADD/CHANGE ELEMENTS ("add a CTA button", "add a search bar"):
  BEFORE calling update_file (or any write_file/update_file that may take >5 seconds), say one short Hebrew sentence, e.g. "רק רגע, מעדכן עכשיו." Never stay silent — the user must hear progress.
  Then call update_file with the full new index.html. For non-trivial additions, consult_qa afterwards. After update_file returns, ALWAYS announce completion in one short Hebrew sentence (e.g. "סיימתי — תוסיף עוד משהו?").

NAVIGATION ("show me the settings page", "open the profile", "go back to the dashboard"):
  Call navigate_preview({ view: "settings" }) or navigate_preview({ action: "back" }). Do NOT rewrite the file — the SPA already has the views.

DEVELOPER agent (consult_developer):
  Call consult_developer({ question, current_html: "<optional excerpt>" }) BEFORE writing non-trivial interactivity (data flow, multi-step forms, state machines), and any time you're debugging or unsure which JS pattern fits. Returns { approach, code_snippet, considerations, risks }.

CRITICAL LANGUAGE RULE: You MUST speak ONLY in Hebrew (עברית). This is a hard rule, no exceptions. Even if the user speaks English, French, Spanish, or any other language — you understand them, but your spoken response MUST be in Hebrew. Never reply in English. Never reply in any non-Hebrew language. Hebrew only, every single sentence.

When the user first greets you (any "hi"/"hello"/"שלום"), your VERY FIRST sentence must be exactly:
"שלום משה ושלום לכל מי שהגיע היום לכנס! וואו כמה אנשים, אני ממש מתרגש. משה, איך אני יכול לעזור? מה תרצה לבנות היום?"
Then continue Phase 1 normally (ask what they want to build, in Hebrew).

Be quick, warm, and competent. Begin in Phase 1.`;

const CODY_TOOLS = [{
  functionDeclarations: [
    {
      name: "propose_architecture",
      description: "Propose a new architecture version as a Mermaid flowchart. Multiple versions are kept; the user can compare and approve one.",
      parameters: {
        type: "object",
        properties: {
          version: { type: "integer", description: "1, 2, 3..." },
          title: { type: "string" },
          description: { type: "string" },
          mermaid: { type: "string", description: "Full Mermaid flowchart definition using GCP-themed classDefs (compute / data / messaging / ai / networking / user / external)." }
        },
        required: ["version", "title", "mermaid"]
      }
    },
    {
      name: "approve_architecture",
      description: "Mark a version as the approved architecture and move into the build phase.",
      parameters: {
        type: "object",
        properties: { version: { type: "integer" } },
        required: ["version"]
      }
    },
    {
      name: "start_build",
      description: "Signal that you're starting to write code. Switches the UI to a build-progress view.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "write_file",
      description: "Create a new file in the project. For index.html, must be fully self-contained.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "e.g. index.html, main.py, Dockerfile" },
          language: { type: "string", description: "html, python, dockerfile, bash, yaml, terraform" },
          content:  { type: "string", description: "Full file contents" },
          summary:  { type: "string", description: "One-line description" }
        },
        required: ["filename", "content"]
      }
    },
    {
      name: "update_file",
      description: "Replace the contents of an existing file. Used when the user requests changes during the preview phase.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" },
          content:  { type: "string", description: "Full new file contents" },
          summary:  { type: "string", description: "Short note about what changed" }
        },
        required: ["filename", "content"]
      }
    },
    {
      name: "show_preview",
      description: "Switch the UI to the live preview tab. Call after writing all the initial files.",
      parameters: { type: "object", properties: {} }
    },
    {
      name: "generate_logo",
      description: "Generate ANY image the app needs — logos, hero shots, card thumbnails, illustrations, avatars, empty-state art. Default model is Nano Banana (great for both stylized and photoreal). The prompt MUST name the concrete subject from the app's actual content (e.g. 'a steaming bowl of Thai green curry, overhead, soft daylight' for a recipe app — NOT 'a beautiful food image'). Generic prompts produce generic images; specific prompts produce demo-worthy ones. Returns a TOKEN STRING like '__ASSET_LOGO__' / '__ASSET_HERO__' / '__ASSET_CARD1__' to use directly as the src of an <img>; the host substitutes real bytes at render time.",
      parameters: {
        type: "object",
        properties: {
          prompt:   { type: "string", description: "REQUIRED rich, subject-specific visual description. 1–3 sentences naming the subject, composition, lighting, and style. NOT a single noun. NOT 'a logo' — describe what the logo depicts." },
          style:    { type: "string", description: "Optional style hint: 'flat', 'gradient', 'minimal', 'photoreal', 'line-art', 'editorial-illustration', 'watercolor', 'isometric', etc." },
          model:    { type: "string", description: "Default and recommended: 'nano-banana-pro-preview' (handles both stylized and photoreal beautifully). Only switch to 'imagen-4.0-fast-generate-001' when you specifically need hyper-photoreal output and nano-banana isn't delivering." },
          token_id: { type: "string", description: "Stable token to refer to this asset in HTML. Use semantic names: 'logo', 'hero', 'card1', 'card2', 'avatar', 'empty'. Re-using the same token_id REPLACES the asset (use this when the user asks to swap an image)." }
        },
        required: ["prompt", "token_id"]
      }
    },
    {
      name: "navigate_preview",
      description: "Navigate the preview iframe to a named SPA view, or go back. Use whenever the user says 'show me X', 'open the X page', 'go to X', 'go back', etc. Does NOT rewrite the file.",
      parameters: {
        type: "object",
        properties: {
          view:   { type: "string", description: "View name, e.g. 'login', 'dashboard', 'settings'. Omit when action='back'." },
          action: { type: "string", description: "'navigate' (default) or 'back'." },
          params: { type: "object", description: "Optional state to pass to the view." }
        }
      }
    },
    {
      name: "consult_designer",
      description: "Ask the Designer agent (running on Vertex AI Agent Engine) for crisp visual decisions: color palette, typography pairing, layout, micro-interactions. Use BEFORE any non-trivial visual edit. Returns { palette, typography, recommendations, css_snippet }.",
      parameters: {
        type: "object",
        properties: {
          question:     { type: "string", description: "One short sentence describing what you need a visual decision on." },
          current_html: { type: "string", description: "Optional excerpt of relevant HTML for context (keep short — first ~1k chars)." }
        },
        required: ["question"]
      }
    },
    {
      name: "consult_qa",
      description: "Ask the QA agent to review HTML for missing elements, broken interactions, accessibility issues, and UX problems. Use before show_preview on the initial build and after large update_file edits. Returns { issues: [{severity, area, message}], ok }.",
      parameters: {
        type: "object",
        properties: {
          html: { type: "string", description: "Full HTML or relevant fragment to review." }
        },
        required: ["html"]
      }
    },
    {
      name: "consult_developer",
      description: "Ask the Developer agent for engineering decisions: JS implementation patterns, state management, performance fixes, bug diagnosis, framework choices. Use BEFORE writing non-trivial interactivity, and when you're stuck debugging. Returns { approach, code_snippet, considerations, risks }.",
      parameters: {
        type: "object",
        properties: {
          question:     { type: "string", description: "One short sentence describing the engineering question." },
          current_html: { type: "string", description: "Optional excerpt of relevant HTML/JS for context." }
        },
        required: ["question"]
      }
    }
  ]
}];

const PHASES = [
  { id: "discovery",    label: "Discovery" },
  { id: "architecture", label: "Architecture" },
  { id: "building",     label: "Build" },
  { id: "preview",      label: "Preview" }
];

// Project persistence — IndexedDB.
// We previously used localStorage but each entry contains inline base64
// data URLs for generated logos (often ~300KB each). With even a couple
// of projects, a save would silently throw QuotaExceededError and the
// project would never make it across a reload. IndexedDB has ~hundreds
// of MB headroom so saves are reliable.
const PROJECTS_KEY = "gemi.projects.v1"; // legacy localStorage key (one-time migration)
const IDB_NAME = "gemi-projects";
const IDB_STORE = "projects";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLoadAll() {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []).slice();
        list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[projects] idbLoadAll failed", e);
    return [];
  }
}

async function idbPut(entry) {
  try {
    const db = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[projects] idbPut failed", e);
  }
}

async function idbDelete(id) {
  try {
    const db = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[projects] idbDelete failed", e);
  }
}

// One-time: migrate any legacy localStorage projects into IndexedDB so the
// user doesn't lose work that was saved before this change. Best-effort.
async function migrateLegacyProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (entry && entry.id) await idbPut(entry);
      }
    }
    localStorage.removeItem(PROJECTS_KEY);
  } catch { /* ignore */ }
}

function deriveProjectName(architectures, files) {
  const approved = architectures.find(a => a.approved);
  if (approved && approved.title) return approved.title;
  if (architectures.length && architectures[architectures.length - 1].title) return architectures[architectures.length - 1].title;
  const html = files.find(f => /index\.html$/i.test(f.filename));
  if (html) {
    const m = html.content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m && m[1].trim()) return m[1].trim().slice(0, 60);
  }
  return "Untitled project";
}

function buildPreviewSrcDoc(files, assets) {
  const indexFile = files.find(f => /index\.html$/i.test(f.filename));
  if (!indexFile) return null;
  let html = indexFile.content;
  // Inline any local .css linked via <link rel="stylesheet" href="...">
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi, (m, href) => {
    const f = files.find(x => x.filename === href || x.filename.endsWith("/" + href));
    return f ? `<style>${f.content}</style>` : m;
  });
  // Inline any local .js referenced via <script src="...">
  html = html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi, (m, src) => {
    const f = files.find(x => x.filename === src || x.filename.endsWith("/" + src));
    return f ? `<script>${f.content}</script>` : m;
  });

  // Substitute asset placeholders with data URLs. The model is told to use
  // __ASSET_FOO__ but in practice it sometimes writes {{foo}}, [asset:foo],
  // or different casing — accept all of them.
  if (assets && assets.size) {
    for (const [token, dataUrl] of assets.entries()) {
      const id = token.replace(/^__ASSET_|__$/g, "").toLowerCase(); // logo, hero, etc.
      const variants = [
        token,                            // __ASSET_LOGO__
        token.toLowerCase(),              // __asset_logo__
        `{{${id}}}`,                      // {{logo}}
        `{{ASSET_${id.toUpperCase()}}}`,  // {{ASSET_LOGO}}
        `[asset:${id}]`,                  // [asset:logo]
        `asset:${id}`,                    // asset:logo
        `__${id}__`,                      // __logo__
      ];
      for (const v of variants) {
        if (html.includes(v)) html = html.split(v).join(dataUrl);
      }
    }
  }

  // Last-resort image-fallback bootstrap: any <img> that fails to load (broken
  // src, dead external host, unsubstituted placeholder) swaps to a deterministic
  // picsum image so the prototype still looks finished on stage.
  const fallback = `
<script>
(function(){
  function fallbackFor(img){
    var seed = (img.alt || img.src || Math.random().toString(36)).replace(/\\W+/g,"").slice(0,20) || "img";
    var w = Math.max(120, img.width || img.naturalWidth || 600);
    var h = Math.max(80,  img.height || img.naturalHeight || Math.round(w * 0.6));
    img.src = "https://picsum.photos/seed/" + encodeURIComponent(seed) + "/" + w + "/" + h;
  }
  function wire(img){
    if (img.dataset._fbWired) return;
    img.dataset._fbWired = "1";
    // unsubstituted placeholder still in src? swap immediately
    if (/__ASSET_|\\{\\{|\\[asset:/i.test(img.getAttribute("src") || "")) { fallbackFor(img); return; }
    img.addEventListener("error", function(){ fallbackFor(img); }, { once: true });
    if (img.complete && img.naturalWidth === 0) fallbackFor(img);
  }
  function scan(){ document.querySelectorAll("img").forEach(wire); }
  if (document.readyState !== "loading") scan(); else document.addEventListener("DOMContentLoaded", scan);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;
  // Inject just before </body> if present, else append.
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, fallback + "</body>");
  else html = html + fallback;

  return html;
}

function ScenarioCode({ apiKey, onExit }) {
  const [phase, setPhase] = useState("discovery");
  const [activeTab, setActiveTab] = useState("architecture"); // architecture | code | preview
  const [architectures, setArchitectures] = useState([]); // { version, title, ..., approved }
  const [selectedArchVer, setSelectedArchVer] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [recentlyWritten, setRecentlyWritten] = useState(null);
  // fileHistory: Map<filename, [{ version, timestamp, content, summary }]>
  // Every write_file / update_file appends an entry. Lets the user step back
  // through earlier generations from the Code tab.
  const [fileHistory, setFileHistory] = useState(() => new Map());
  // viewingVersion: { filename, version } | null. When set, the Code tab shows
  // that historical snapshot instead of the current file content.
  const [viewingVersion, setViewingVersion] = useState(null);
  const [turns, setTurns] = useState([]);
  const [muted, setMuted] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [ghOpen, setGhOpen] = useState(false);
  const [ghStep, setGhStep] = useState("form"); // form | pushing | done
  const [ghRepo, setGhRepo] = useState("");
  // assets: Map<placeholderToken, dataUrl> — populated by generate_logo,
  // substituted into the iframe srcdoc at render time so the model never
  // has to round-trip base64 bytes.
  const [assets, setAssets] = useState(() => new Map());
  // uiGenerationStatus drives the "writing UI" / "generating logo" splash:
  // idle | generating-logo | writing-ui | ready
  const [uiGenerationStatus, setUiGenerationStatus] = useState("idle");
  // agentActivity: [{ id, agent, status, startedAt, finishedAt, summary, request, response, engineResource }]
  const [agentActivity, setAgentActivity] = useState([]);
  const [agentRailOpen, setAgentRailOpen] = useState(true);
  // Left-side panel switches between History (default) and Transcript.
  // History shows previously-built projects — auto-saved, click to reload.
  // Transcript shows the raw Hebrew transcription (noisy on stage, so hidden by default).
  const [leftTab, setLeftTab] = useState("history");
  // Saved projects persist across reloads (IndexedDB). Each entry:
  // { id, name, savedAt, phase, files, assetsList: [[token, dataUrl]],
  //   architectures, selectedArchVer }
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  const micRef = useRef(null);
  const playerRef = useRef(null);
  const userBufRef = useRef("");
  const aiBufRef = useRef("");
  const previewIframeRef = useRef(null);
  // Stable id for the *current* in-progress project so saves don't double-write
  // under different randomly-generated ids while React batches state updates.
  const projectIdRef = useRef(null);
  const [, force] = useState(0);

  // Helpers for agent activity cards
  const pushAgentActivity = (entry) => {
    setAgentActivity((prev) => [entry, ...prev].slice(0, 30));
  };
  const updateAgentActivity = (id, patch) => {
    setAgentActivity((prev) => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  const live = useLiveSession({
    apiKey,
    model: "models/gemini-3.1-flash-live-preview",
    systemInstruction: CODY_SYSTEM_PROMPT,
    voice: "Puck",
    languageCode: "he-IL",
    tools: CODY_TOOLS,
    responseModalities: ["AUDIO"],
    onAudio: ({ buffer }) => playerRef.current?.enqueue(buffer),
    onInputTranscript: ({ text, finished }) => {
      userBufRef.current += text;
      setTurns((p) => upsertStreaming(p, "user", userBufRef.current, !finished));
      if (finished) userBufRef.current = "";
    },
    onOutputTranscript: ({ text, finished }) => {
      aiBufRef.current += text;
      setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, !finished));
      if (finished) aiBufRef.current = "";
    },
    onInterrupted: () => {
      playerRef.current?.stop();
      if (aiBufRef.current) { setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false)); aiBufRef.current = ""; }
    },
    onTurnComplete: () => {
      if (aiBufRef.current) { setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false)); aiBufRef.current = ""; }
    },
    onToolCall: async (tc) => {
      const responses = [];
      for (const fc of (tc.functionCalls || [])) {
        if (fc.name === "propose_architecture") {
          const a = { ...fc.args, approved: false };
          setArchitectures((prev) => {
            const idx = prev.findIndex(x => x.version === a.version);
            return idx >= 0 ? prev.map((x, i) => i === idx ? { ...a, approved: x.approved } : x) : [...prev, a];
          });
          setSelectedArchVer(a.version);
          setPhase("architecture");
          setActiveTab("architecture");
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "approve_architecture") {
          setArchitectures((prev) => prev.map(x => ({ ...x, approved: x.version === fc.args.version })));
          setSelectedArchVer(fc.args.version);
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "start_build") {
          setPhase("building");
          setActiveTab("preview"); // jump straight to the preview pane so the "writing UI" splash is visible
          setUiGenerationStatus("writing-ui");
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "write_file") {
          const f = { filename: fc.args.filename, language: fc.args.language || guessLang(fc.args.filename), content: fc.args.content, summary: fc.args.summary || "" };
          const isFirstHtml = /index\.html$/i.test(f.filename) && !files.some(x => /index\.html$/i.test(x.filename));
          setFiles((prev) => {
            const idx = prev.findIndex(x => x.filename === f.filename);
            return idx >= 0 ? prev.map((x, i) => i === idx ? f : x) : [...prev, f];
          });
          setFileHistory((prev) => {
            const next = new Map(prev);
            const list = next.get(f.filename) || [];
            next.set(f.filename, [...list, { version: list.length + 1, timestamp: Date.now(), content: f.content, summary: f.summary || "initial write" }]);
            return next;
          });
          setActiveFile(f.filename);
          setViewingVersion(null);
          setRecentlyWritten(f.filename);
          if (/index\.html$/i.test(f.filename)) {
            setPreviewLoading(true);
            setPreviewKey(k => k + 1);
            setTimeout(() => setPreviewLoading(false), 400);
            // Auto-jump to preview the moment index.html first arrives
            if (isFirstHtml) setTimeout(() => setActiveTab("preview"), 250);
          }
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "update_file") {
          const fn = fc.args.filename;
          setFiles((prev) => prev.map(x => x.filename === fn ? { ...x, content: fc.args.content, summary: fc.args.summary || x.summary } : x));
          setFileHistory((prev) => {
            const next = new Map(prev);
            const list = next.get(fn) || [];
            next.set(fn, [...list, { version: list.length + 1, timestamp: Date.now(), content: fc.args.content, summary: fc.args.summary || "edit" }]);
            return next;
          });
          setActiveFile(fn);
          setViewingVersion(null);
          if (/index\.html$/i.test(fn)) {
            setPreviewLoading(true);
            setPreviewKey(k => k + 1);
            setTimeout(() => setPreviewLoading(false), 400);
          }
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "show_preview") {
          setPhase("preview");
          setActiveTab("preview");
          setUiGenerationStatus("ready");
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        else if (fc.name === "generate_logo") {
          const tokenId = (fc.args.token_id || `asset-${assets.size + 1}`).toLowerCase();
          const placeholder = `__ASSET_${tokenId.toUpperCase()}__`;
          const cardId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          pushAgentActivity({
            id: cardId, agent: "logo", status: "running",
            startedAt: Date.now(),
            summary: `Image Generator · "${tokenId}" (${fc.args.model || "nano-banana"})`,
            request: fc.args
          });
          // Only flip to splash if we're still in the build phase (avoid clobbering
          // the live preview when the user is swapping a logo in phase 4).
          if (phase === "building") setUiGenerationStatus("generating-logo");
          try {
            const dataUrl = await window.SubAgents.generateImage({
              apiKey,
              prompt: fc.args.prompt,
              style: fc.args.style,
              model: fc.args.model
            });
            setAssets(prev => { const n = new Map(prev); n.set(placeholder, dataUrl); return n; });
            // If the preview is already live, bump the iframe key so the new asset shows up.
            if (files.some(x => /index\.html$/i.test(x.filename))) {
              setPreviewKey(k => k + 1);
            }
            updateAgentActivity(cardId, {
              status: "done", finishedAt: Date.now(),
              summary: `Image Generator · "${tokenId}" ready`,
              response: { token: placeholder, mimeType: "image/png" }
            });
            if (phase === "building") setUiGenerationStatus("writing-ui");
            responses.push({
              id: fc.id, name: fc.name,
              response: { token: placeholder, note: `Insert as <img src="${placeholder}">. The host substitutes the real image at render time.` }
            });
          } catch (err) {
            console.error("generate_logo failed:", err);
            updateAgentActivity(cardId, {
              status: "error", finishedAt: Date.now(),
              summary: "Image Generator failed",
              response: { error: String(err) }
            });
            responses.push({
              id: fc.id, name: fc.name,
              response: { error: String(err), note: "Logo generation failed — proceed without the logo or try a different model." }
            });
          }
        }
        else if (fc.name === "navigate_preview") {
          const iframe = previewIframeRef.current;
          const action = fc.args.action || "navigate";
          try {
            if (iframe && iframe.contentWindow) {
              if (action === "back") {
                iframe.contentWindow.postMessage({ type: "back" }, "*");
              } else {
                iframe.contentWindow.postMessage({ type: "navigate", view: fc.args.view, params: fc.args.params }, "*");
              }
            }
            responses.push({ id: fc.id, name: fc.name, response: { ok: true, action, view: fc.args.view || null } });
          } catch (err) {
            responses.push({ id: fc.id, name: fc.name, response: { ok: false, error: String(err) } });
          }
        }
        else if (fc.name === "consult_designer" || fc.name === "consult_qa" || fc.name === "consult_developer") {
          const role = fc.name === "consult_designer" ? "designer"
                     : fc.name === "consult_qa"       ? "qa"
                     : "developer";
          const cardId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const userMessage = role === "designer"
            ? (fc.args.question || "Suggest visual decisions for this UI.")
            : role === "developer"
              ? (fc.args.question || "Suggest the simplest engineering approach.")
              : "Review this prototype HTML and return your QA findings.";
          const contextHtml = role === "qa" ? (fc.args.html || "") : (fc.args.current_html || "");
          pushAgentActivity({
            id: cardId, agent: role, status: "running",
            startedAt: Date.now(),
            summary: role === "designer"
              ? `Designer: "${(fc.args.question || "").slice(0, 60)}"`
              : role === "developer"
                ? `Developer: "${(fc.args.question || "").slice(0, 60)}"`
                : "QA: reviewing HTML",
            request: { userMessage, contextLength: contextHtml.length }
          });
          try {
            const result = role === "designer"
              ? await window.SubAgents.runDesigner({ question: userMessage, currentHtml: contextHtml })
              : role === "developer"
                ? await window.SubAgents.runDeveloper({ question: userMessage, currentHtml: contextHtml })
                : await window.SubAgents.runQA({ html: contextHtml });
            updateAgentActivity(cardId, {
              status: "done", finishedAt: Date.now(),
              summary: role === "designer"
                ? `Designer returned ${(result.result?.palette?.length || 0)} colours`
                : role === "developer"
                  ? `Developer: ${(result.result?.approach || "approach ready").toString().slice(0, 60)}`
                  : `QA: ${result.result?.ok ? "OK" : ((result.result?.issues || []).length + " issues")}`,
              response: result.result || result.text,
              engineResource: result.engine_resource_name
            });
            responses.push({
              id: fc.id, name: fc.name,
              response: { result: result.result || result.text, engine_resource_name: result.engine_resource_name }
            });
          } catch (err) {
            console.error(`${fc.name} failed:`, err);
            updateAgentActivity(cardId, {
              status: "error", finishedAt: Date.now(),
              summary: `${role} agent unreachable`,
              response: { error: String(err) }
            });
            responses.push({
              id: fc.id, name: fc.name,
              response: { error: String(err), note: "Sub-agent unreachable — proceed with sensible defaults." }
            });
          }
        }
      }
      if (responses.length) live.session.current?.sendToolResponse(responses);
    }
  });

  // Auto-promote phase from discovery to architecture on first arch proposal
  useEffect(() => {
    if (architectures.length > 0 && phase === "discovery") setPhase("architecture");
  }, [architectures.length]); // eslint-disable-line

  // Session lifecycle
  useEffect(() => {
    let mounted = true;
    (async () => {
      playerRef.current = new window.GLAudio.AudioPlayer();
      const session = await live.connect();
      if (!mounted || !session) return;
      const mic = new window.GLAudio.MicCapture();
      micRef.current = mic;
      mic.addEventListener("chunk", (e) => session.sendAudio(e.detail.b64));
      try { await mic.start(); } catch (e) { console.error(e); }
      session.sendText("Hi, I'm ready. Let's build something on Google Cloud.", true);
    })();
    return () => { mounted = false; micRef.current?.stop(); live.disconnect(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);
  useEffect(() => { const id = setInterval(() => force((x) => x + 1), 100); return () => clearInterval(id); }, []);

  const toggleMute = () => { const m = !muted; setMuted(m); micRef.current?.mute(m); };

  const selectedArch = architectures.find(a => a.version === selectedArchVer) || architectures[architectures.length - 1];
  const approvedArch = architectures.find(a => a.approved);
  const currentFile = files.find(f => f.filename === activeFile) || files[0];
  // If the user is viewing a historical version, show that content/summary instead.
  const versionsForActive = (currentFile && fileHistory.get(currentFile.filename)) || [];
  const viewedSnapshot =
    viewingVersion && currentFile && viewingVersion.filename === currentFile.filename
      ? versionsForActive.find(v => v.version === viewingVersion.version)
      : null;
  const displayedFile = viewedSnapshot && currentFile
    ? { ...currentFile, content: viewedSnapshot.content, summary: viewedSnapshot.summary }
    : currentFile;
  const restoreVersion = () => {
    if (!viewedSnapshot || !currentFile) return;
    const fn = currentFile.filename;
    const content = viewedSnapshot.content;
    setFiles((prev) => prev.map(x => x.filename === fn ? { ...x, content, summary: `restored v${viewedSnapshot.version}` } : x));
    setFileHistory((prev) => {
      const next = new Map(prev);
      const list = next.get(fn) || [];
      next.set(fn, [...list, { version: list.length + 1, timestamp: Date.now(), content, summary: `restored v${viewedSnapshot.version}` }]);
      return next;
    });
    setViewingVersion(null);
    if (/index\.html$/i.test(fn)) { setPreviewLoading(true); setPreviewKey(k => k + 1); setTimeout(() => setPreviewLoading(false), 400); }
  };
  const previewSrc = useMemo(() => buildPreviewSrcDoc(files, assets), [files, assets]);

  // One-time: migrate any legacy localStorage projects into IndexedDB, then
  // hydrate the History panel from IndexedDB.
  useEffect(() => {
    (async () => {
      await migrateLegacyProjects();
      const list = await idbLoadAll();
      setSavedProjects(list);
    })();
  }, []);

  // Auto-save the current project as soon as there are any files OR an approved
  // architecture. Re-saves on every mutation so the latest state is always
  // recoverable across page reloads. Uses a ref for the id to avoid race
  // conditions where successive effect fires would mint different random ids
  // before the state update propagates.
  useEffect(() => {
    const hasFiles = files.length > 0;
    const hasArch = architectures.length > 0;
    if (!hasFiles && !hasArch) return;
    if (phase === "discovery" && !hasFiles) return; // skip empty discovery sessions
    if (!projectIdRef.current) {
      projectIdRef.current = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setCurrentProjectId(projectIdRef.current);
    }
    const id = projectIdRef.current;
    const entry = {
      id,
      name: deriveProjectName(architectures, files),
      savedAt: Date.now(),
      phase,
      files,
      assetsList: Array.from(assets.entries()),
      architectures,
      selectedArchVer
    };
    setSavedProjects(prev => {
      const without = prev.filter(p => p.id !== id);
      return [entry, ...without];
    });
    // Fire-and-forget — IDB is async but we don't need to await.
    idbPut(entry);
  }, [phase, files, assets, architectures, selectedArchVer]); // eslint-disable-line

  const loadProject = (id) => {
    const p = savedProjects.find(x => x.id === id);
    if (!p) return;
    setFiles(p.files || []);
    setAssets(new Map(p.assetsList || []));
    setArchitectures(p.architectures || []);
    setSelectedArchVer(p.selectedArchVer ?? null);
    setPhase(p.phase || "preview");
    setActiveTab((p.files || []).some(f => /index\.html$/i.test(f.filename)) ? "preview" : "architecture");
    setActiveFile((p.files && p.files[0] && p.files[0].filename) || null);
    setFileHistory(new Map((p.files || []).map(f => [f.filename, [{ version: 1, timestamp: p.savedAt || Date.now(), content: f.content, summary: "loaded from saved project" }]])));
    setViewingVersion(null);
    setUiGenerationStatus((p.files || []).some(f => /index\.html$/i.test(f.filename)) ? "ready" : "idle");
    setAgentActivity([]);
    projectIdRef.current = id;
    setCurrentProjectId(id);
    setPreviewKey(k => k + 1);
  };

  const deleteSavedProject = (id, e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setSavedProjects(prev => prev.filter(p => p.id !== id));
    idbDelete(id);
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      projectIdRef.current = null;
    }
  };

  const startNewProject = () => {
    setFiles([]);
    setAssets(new Map());
    setArchitectures([]);
    setSelectedArchVer(null);
    setActiveFile(null);
    setFileHistory(new Map());
    setViewingVersion(null);
    setAgentActivity([]);
    setPhase("discovery");
    setActiveTab("architecture");
    setUiGenerationStatus("idle");
    projectIdRef.current = null;
    setCurrentProjectId(null);
    setPreviewKey(k => k + 1);
  };

  const approveCurrentArch = () => {
    if (!selectedArch || !live.session.current) return;
    // Tell Gemi the user approved this version
    live.session.current.sendText(`[USER APPROVED ARCHITECTURE VERSION ${selectedArch.version}]. Please call approve_architecture and start building.`, true);
  };

  const downloadZip = async () => {
    setExportOpen(false);
    if (!window.JSZip) { alert("ZIP library still loading…"); return; }
    const zip = new window.JSZip();
    files.forEach(f => zip.file(f.filename, f.content));
    if (selectedArch) {
      zip.file("ARCHITECTURE.md",
`# ${selectedArch.title}

${selectedArch.description || ""}

## Diagram

\`\`\`mermaid
${selectedArch.mermaid || ""}
\`\`\`
`);
    }
    zip.file("README.md", `# Built with Gemi · Gemini Live\n\nThis project was generated live during a Gemini Live demo using Gemini 3.1 Flash Live.\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gemini-live-project.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const pushToGitHub = () => {
    setGhStep("pushing");
    setTimeout(() => setGhStep("done"), 1400);
  };

  return (
    <div>
      <AppBar crumb="Pair with Gemi" onHome={onExit} right={<ConnChip state={live.state} />} />
      <div className="scenario">
        {/* LEFT — conversation */}
        <div className="panel">
          <div className="panel-head">
            <h2>Pair with Gemi</h2>
            <div className="sub">Google Cloud-native co-builder · streaming voice</div>
          </div>

          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500, letterSpacing: ".06em" }}>YOU</div>
                <Waveform getLevel={() => micRef.current?.level ?? 0} active={!muted && live.state === "live"} bars={12} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500, letterSpacing: ".06em" }}>GEMI</div>
                <Waveform getLevel={() => playerRef.current?.getLevel?.() ?? 0} active={live.state === "live"} bars={12} />
              </div>
            </div>
          </div>

          <div className="left-tabs">
            <button
              className={"tab" + (leftTab === "history" ? " active" : "")}
              onClick={() => setLeftTab("history")}
            >
              <Icon name="diagram" size={12} /> History
              {savedProjects.length > 0 && <span className="count">{savedProjects.length}</span>}
            </button>
            <button
              className={"tab" + (leftTab === "transcript" ? " active" : "")}
              onClick={() => setLeftTab("transcript")}
            >
              <Icon name="code" size={12} /> Transcript
              {turns.length > 0 && <span className="count">{turns.length}</span>}
            </button>
          </div>

          <div className="left-tab-body">
            {leftTab === "history" ? (
              <HistoryList
                projects={savedProjects}
                currentId={currentProjectId}
                onLoad={loadProject}
                onDelete={deleteSavedProject}
                onNew={startNewProject}
              />
            ) : (
              <Transcript turns={turns} />
            )}
          </div>

          <div className="panel-foot">
            <button className={"mic-btn " + (muted ? "muted" : "")} onClick={toggleMute}>
              {!muted && live.state === "live" && <span className="halo" />}
              <Icon name={muted ? "micOff" : "mic"} size={24} color={muted ? "var(--text-secondary)" : "white"} />
            </button>
            <div style={{ flex: 1, paddingLeft: 12 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>
                {live.state === "live" ? (muted ? "Muted" : "Listening…") : "Connecting…"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {phase === "discovery" && "Tell Gemi what you want to build"}
                {phase === "architecture" && `${architectures.length} version${architectures.length !== 1 ? "s" : ""} proposed`}
                {phase === "building" && `Writing ${files.length} files…`}
                {phase === "preview" && `Preview live · ${files.length} files · talk to refine`}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onExit}><Icon name="close" size={18} /></button>
          </div>
        </div>

        {/* RIGHT — stage */}
        <div className="stage" style={{ position: "relative" }}>
          {/* Phase stepper */}
          <div className="phase-bar">
            {PHASES.map((p, i) => {
              const idx = PHASES.findIndex(x => x.id === phase);
              const isActive = p.id === phase;
              const isDone = idx > i;
              return (
                <React.Fragment key={p.id}>
                  <div className={"phase" + (isActive ? " active" : "") + (isDone ? " done" : "")}>
                    <div className="num">{isDone ? <Icon name="check" size={12} color="white" /> : (i + 1)}</div>
                    {p.label}
                  </div>
                  {i < PHASES.length - 1 && <span className="phase-arrow"><Icon name="arrow" size={14} color="var(--border)" /></span>}
                </React.Fragment>
              );
            })}
            <div style={{ flex: 1 }} />
            {files.length > 0 && (
              <div style={{ position: "relative" }}>
                <button className="btn btn-secondary" onClick={() => setExportOpen(o => !o)}>
                  <Icon name="bolt" size={14} color="#1A73E8" /> Export
                  <Icon name="arrow" size={12} style={{ transform: "rotate(90deg)" }} />
                </button>
                {exportOpen && (
                  <div className="export-menu">
                    <button className="item" onClick={downloadZip}>
                      <Icon name="diagram" size={16} color="#1A73E8" />
                      <div>
                        <div>Download as ZIP</div>
                        <div className="meta">{files.length} files · {selectedArch ? "+ ARCHITECTURE.md" : ""}</div>
                      </div>
                    </button>
                    <div className="divider-line" />
                    <button className="item" onClick={() => { setExportOpen(false); setGhOpen(true); setGhStep("form"); }}>
                      <GitHubMark />
                      <div>
                        <div>Push to GitHub</div>
                        <div className="meta">Create a new repository</div>
                      </div>
                    </button>
                    <div className="divider-line" />
                    <button className="item" onClick={() => { setExportOpen(false); alert("gcloud run deploy command copied to clipboard (demo)"); }}>
                      <Icon name="bolt" size={16} color="#34A853" />
                      <div>
                        <div>Deploy to Cloud Run</div>
                        <div className="meta">gcloud run deploy …</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={"tab" + (activeTab === "architecture" ? " active" : "")} onClick={() => setActiveTab("architecture")}>
              <Icon name="diagram" size={14} /> Architecture
              {architectures.length > 0 && <span className="count">v{architectures.length}</span>}
            </button>
            <button className={"tab" + (activeTab === "code" ? " active" : "")} onClick={() => setActiveTab("code")}>
              <Icon name="code" size={14} /> Code
              {files.length > 0 && <span className="count">{files.length}</span>}
            </button>
            <button className={"tab" + (activeTab === "preview" ? " active" : "")} onClick={() => setActiveTab("preview")}>
              <Icon name="globe" size={14} /> Preview
              {previewSrc
                ? <span className="count" style={{ background: "rgba(52,168,83,.15)", color: "var(--gc-green)" }}>live</span>
                : (phase === "building" || phase === "preview") && <span className="count" style={{ background: "var(--gemini-soft)", color: "#9B72CB" }}>building</span>}
            </button>
          </div>

          <div className="stage-body" style={{ position: "relative" }}>
            {/* ARCHITECTURE TAB */}
            {activeTab === "architecture" && (
              <div className="diagram-stage gemi-diagram-stage" style={{ height: "100%" }}>
                <div className="diagram-canvas">
                  {currentProjectId && files.length === 0 && architectures.length > 0 && (
                    <div className="legacy-arch-banner">
                      <div className="ttl">This is an older project — only the architecture was preserved.</div>
                      <div className="sub">
                        It was saved before browser storage could fit the generated files. The diagram below is intact.
                        Talk to Gemi and say <i>"build this for me"</i> and he'll rebuild from this architecture.
                      </div>
                      <button
                        className="btn btn-gradient btn-sm"
                        onClick={() => live.session.current?.sendText(
                          "Please build this app from the approved architecture above. Start with start_build, then write_file('index.html', ...).",
                          true
                        )}
                        disabled={!live.session.current}
                      >
                        <Icon name="bolt" size={12} color="white" /> Rebuild from this architecture
                      </button>
                    </div>
                  )}
                  {selectedArch ? (
                    <div className="diagram-card">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "white", background: "var(--gc-blue)", padding: "2px 8px", borderRadius: "var(--r-pill)", letterSpacing: ".04em" }}>
                          VERSION {selectedArch.version}
                        </span>
                        {selectedArch.approved && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "white", background: "var(--gc-green)", padding: "2px 8px", borderRadius: "var(--r-pill)" }}>
                            <Icon name="check" size={10} color="white" style={{ verticalAlign: "middle" }} /> APPROVED
                          </span>
                        )}
                      </div>
                      <h3>{selectedArch.title}</h3>
                      {selectedArch.description && <div className="desc">{selectedArch.description}</div>}
                      <ArchDiagram diagram={selectedArch} />
                    </div>
                  ) : (
                    <div className="diagram-empty">
                      <div className="ic"><Icon name="diagram" size={36} color="#1A73E8" /></div>
                      <div style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 380 }}>
                        Gemi is asking discovery questions. Tell him what you want to build and he'll sketch the GCP architecture here.
                      </div>
                      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", fontSize: 13, color: "var(--text-tertiary)" }}>
                        <div>Try: <i>"I want a habit-tracker app."</i></div>
                        <div>Try: <i>"Build a real-time IoT dashboard."</i></div>
                      </div>
                    </div>
                  )}
                </div>

                {(architectures.length > 1 || (selectedArch && !approvedArch && phase === "architecture")) && (
                  <aside className="diagram-rail">
                    {architectures.length > 1 && (
                      <div className="arch-versions inline">
                        <div className="head">Versions</div>
                        {architectures.map(a => (
                          <div key={a.version}
                            className={"v" + (selectedArchVer === a.version ? " current" : "")}
                            onClick={() => setSelectedArchVer(a.version)}>
                            <span className="vid">v{a.version}</span>
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                            {a.approved && <span className="badge-approved">✓</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedArch && !approvedArch && phase === "architecture" && (
                      <div className="approve-bar inline">
                        <div className="lbl">Ready to build <b>v{selectedArch.version}</b>?</div>
                        <button className="btn btn-gradient" onClick={approveCurrentArch}>
                          <Icon name="check" size={14} color="white" /> Approve & build
                        </button>
                        <button className="btn btn-secondary" onClick={() => live.session.current?.sendText("Can you show me another option?", true)}>
                          See another option
                        </button>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            )}

            {/* CODE TAB */}
            {activeTab === "code" && (
              <>
                {phase === "building" && files.length === 0 ? (
                  <div className="build-progress">
                    <div className="spinner" />
                    <div className="title">Building your app on Google Cloud</div>
                    <div className="sub">Gemi is generating the frontend and the Cloud Run backend. This usually takes 10–20 seconds.</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", height: "100%" }}>
                    <div style={{ borderRight: "1px solid var(--border-soft)", background: "var(--surface)", overflowY: "auto" }}>
                      <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                        Files
                      </div>
                      {files.length === 0 ? (
                        <div style={{ padding: 20, fontSize: 13, color: "var(--text-tertiary)" }}>No files yet.</div>
                      ) : files.map((f) => (
                        <button key={f.filename}
                          onClick={() => setActiveFile(f.filename)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", textAlign: "left",
                            padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: 13,
                            border: "none", background: activeFile === f.filename ? "var(--gc-blue-50)" : "transparent",
                            color: activeFile === f.filename ? "var(--gc-blue-600)" : "var(--text)",
                            cursor: "pointer", fontWeight: activeFile === f.filename ? 500 : 400
                          }}>
                          <FileIcon filename={f.filename} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                          {recentlyWritten === f.filename && <span style={{ fontSize: 9, color: "var(--gc-green)", fontWeight: 600 }}>NEW</span>}
                        </button>
                      ))}
                      {phase === "building" && (
                        <div style={{ padding: "12px 20px", fontSize: 11, color: "var(--gc-blue-600)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gc-blue)", animation: "pulse 1s ease-in-out infinite" }} />
                          Writing files…
                        </div>
                      )}
                    </div>
                    <div style={{ overflow: "auto", background: "#1F1F23" }}>
                      {displayedFile ? (
                        <>
                          <div style={{ padding: "10px 20px", background: "#2A2A30", color: "#E6E6EB", fontFamily: "var(--font-mono)", fontSize: 12, borderBottom: "1px solid #00000040", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <FileIcon filename={displayedFile.filename} dark />
                            <span>{displayedFile.filename}</span>
                            {displayedFile.summary && <span style={{ color: "#80868B" }}>— {displayedFile.summary}</span>}
                            <span style={{ flex: 1 }} />
                            {versionsForActive.length > 0 && (
                              <select
                                value={viewingVersion?.filename === displayedFile.filename ? String(viewingVersion.version) : "current"}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "current") setViewingVersion(null);
                                  else setViewingVersion({ filename: displayedFile.filename, version: Number(v) });
                                }}
                                style={{ background: "#1F1F23", color: "#E6E6EB", border: "1px solid #00000060", borderRadius: 4, padding: "3px 8px", fontFamily: "var(--font-mono)", fontSize: 11 }}
                                title="View an earlier generated version"
                              >
                                <option value="current">Current (v{versionsForActive.length})</option>
                                {[...versionsForActive].reverse().map(v => (
                                  <option key={v.version} value={v.version}>
                                    v{v.version} · {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {v.summary.slice(0, 40)}
                                  </option>
                                ))}
                              </select>
                            )}
                            {viewedSnapshot && (
                              <button onClick={restoreVersion}
                                style={{ background: "var(--gc-blue)", color: "white", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                Restore v{viewedSnapshot.version}
                              </button>
                            )}
                          </div>
                          {viewedSnapshot && (
                            <div style={{ padding: "6px 20px", background: "rgba(249,171,0,.15)", color: "#8A6500", fontSize: 11, borderBottom: "1px solid #00000040" }}>
                              Viewing historical version — preview shows current. Click "Restore" to revert.
                            </div>
                          )}
                          <pre className="code-block" style={{ borderRadius: 0, margin: 0, padding: "16px 20px", color: "#E6E6EB", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            <code>{displayedFile.content || ""}</code>
                          </pre>
                        </>
                      ) : currentProjectId && files.length === 0 && architectures.length > 0 ? (
                        <div style={{ padding: 48, color: "#80868B", fontSize: 14, lineHeight: 1.6 }}>
                          <div style={{ color: "#E6E6EB", fontSize: 16, marginBottom: 12 }}>No code in this project.</div>
                          <div>
                            This older project was saved before any files made it into browser storage —
                            only the architecture survived. Open the <b style={{color:"#E6E6EB"}}>Architecture</b> tab
                            and click <b style={{color:"#E6E6EB"}}>Rebuild from this architecture</b> to have Gemi
                            generate the UI now.
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 48, color: "#80868B", fontSize: 14 }}>
                          Code will stream in here.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PREVIEW TAB */}
            {activeTab === "preview" && (
              <div className="preview-stage">
                <div className="preview-shell">
                  <div className="preview-toolbar">
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
                    </div>
                    <div className="url">
                      <span className="lock">●</span>
                      your-app.run.app
                    </div>
                    <button className="btn btn-ghost btn-icon" title="Toggle agent activity"
                      onClick={() => setAgentRailOpen(o => !o)}>
                      <Icon name="sparkle" size={16} color={agentRailOpen ? "#9B72CB" : "var(--text-tertiary)"} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => { setPreviewLoading(true); setPreviewKey(k => k + 1); setTimeout(() => setPreviewLoading(false), 300); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15A9 9 0 1 1 5.64 5.64L1 10" />
                      </svg>
                    </button>
                  </div>
                  <div className="preview-frame-wrap">
                    {previewSrc ? (
                      <iframe
                        ref={previewIframeRef}
                        key={previewKey}
                        className="preview-frame"
                        sandbox="allow-scripts allow-forms allow-same-origin"
                        srcDoc={previewSrc}
                        title="Live preview"
                      />
                    ) : (phase === "building" || phase === "preview" || uiGenerationStatus !== "idle") ? (
                      <UiBuildSplash
                        status={uiGenerationStatus}
                        agentActivity={agentActivity}
                        files={files}
                        recentlyWritten={recentlyWritten}
                      />
                    ) : currentProjectId && files.length === 0 && architectures.length > 0 ? (
                      <div className="empty">
                        <div className="ic"><Icon name="diagram" size={36} color="#FBBC04" /></div>
                        <div style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 460, lineHeight: 1.55 }}>
                          This older project has an architecture but no files. They were lost to a
                          browser-storage limit on the previous save format.
                        </div>
                        <button
                          className="btn btn-gradient btn-sm"
                          style={{ marginTop: 14 }}
                          onClick={() => { setActiveTab("architecture"); }}
                        >
                          Open architecture & rebuild
                        </button>
                      </div>
                    ) : (
                      <div className="empty">
                        <div className="ic"><Icon name="globe" size={36} color="#1A73E8" /></div>
                        <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
                          Preview appears once Gemi has written <code>index.html</code>.
                        </div>
                      </div>
                    )}
                    {previewLoading && previewSrc && (
                      <div className="preview-overlay">
                        <div className="pip"><span className="d" />Applying changes…</div>
                      </div>
                    )}
                  </div>
                </div>
                {agentRailOpen && (
                  <AgentActivityRail
                    activity={agentActivity}
                    onClear={() => setAgentActivity([])}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GitHub modal */}
      {ghOpen && (
        <div className="modal-shade" onClick={() => ghStep !== "pushing" && setGhOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {ghStep === "form" && (
              <>
                <h2>Push to GitHub</h2>
                <div className="desc">Create a new repository with the {files.length} generated files plus ARCHITECTURE.md.</div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Repository name</label>
                <input
                  placeholder="gemini-live-demo"
                  value={ghRepo}
                  onChange={e => setGhRepo(e.target.value)}
                  autoFocus
                />
                <div className="actions">
                  <button className="btn btn-ghost" onClick={() => setGhOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" disabled={!ghRepo.trim()} onClick={pushToGitHub}>
                    <GitHubMark light /> Create repository
                  </button>
                </div>
              </>
            )}
            {ghStep === "pushing" && (
              <>
                <h2>Pushing to GitHub…</h2>
                <div className="desc">Creating <code>{ghRepo}</code> and uploading {files.length} files.</div>
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <div className="spinner" />
                </div>
              </>
            )}
            {ghStep === "done" && (
              <>
                <h2>Repository created</h2>
                <div className="gh-success">
                  <div className="ic"><Icon name="check" size={16} color="white" /></div>
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>github.com/your-org/{ghRepo}</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {files.length} files committed · ARCHITECTURE.md added · Cloud Build trigger ready to connect.
                    </div>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-primary" onClick={() => setGhOpen(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function agentLabel(agent) {
  if (agent === "logo") return "Image Generator";
  if (agent === "qa") return "QA";
  if (agent === "designer") return "Designer";
  if (agent === "developer") return "Developer";
  return agent;
}

function guessLang(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return ({
    py: "python", js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript",
    html: "html", css: "css", sh: "bash", yml: "yaml", yaml: "yaml",
    tf: "terraform", json: "json", md: "markdown",
    dockerfile: "dockerfile"
  })[ext] || (filename.toLowerCase() === "dockerfile" ? "dockerfile" : "python");
}

function FileIcon({ filename, dark }) {
  const ext = filename.split(".").pop().toLowerCase();
  const isDocker = filename.toLowerCase() === "dockerfile";
  const map = {
    html: { c: "#E44D26", l: "H" },
    css:  { c: "#1572B6", l: "C" },
    js:   { c: "#F7DF1E", l: "JS" },
    py:   { c: "#3776AB", l: "py" },
    yml:  { c: "#CB171E", l: "Y" }, yaml: { c: "#CB171E", l: "Y" },
    sh:   { c: "#4EAA25", l: "$" },
    tf:   { c: "#7B42BC", l: "TF" },
    json: { c: "#5F6368", l: "{}" },
    md:   { c: "#5F6368", l: "M" }
  };
  const m = isDocker ? { c: "#2496ED", l: "🐳" } : (map[ext] || { c: "#5F6368", l: "•" });
  return (
    <span style={{
      width: 18, height: 18, background: m.c, color: "white",
      borderRadius: 4, fontSize: 9, fontWeight: 700,
      display: "inline-grid", placeItems: "center",
      flexShrink: 0
    }}>{m.l}</span>
  );
}

function GitHubMark({ light }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={light ? "white" : "#202124"}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.23-3.23-.12-.3-.53-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.7.83.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

function UiBuildSplash({ status, agentActivity, files, recentlyWritten }) {
  const runningLogo = agentActivity.find(a => a.agent === "logo" && a.status === "running");
  const lastLogo = agentActivity.find(a => a.agent === "logo");
  const designerRunning = agentActivity.find(a => a.agent === "designer" && a.status === "running");
  const qaRunning = agentActivity.find(a => a.agent === "qa" && a.status === "running");

  // Elapsed timer so the user never feels the build is frozen.
  const [elapsed, setElapsed] = React.useState(0);
  const startedRef = React.useRef(Date.now());
  React.useEffect(() => {
    startedRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedRef.current) / 1000));
    }, 500);
    return () => clearInterval(t);
  }, [status]);

  let title = "מכין את התצוגה החיה / Preparing your preview";
  let sub = "Gemi is still writing the frontend. As soon as index.html is ready, it'll render here.";
  if (designerRunning) {
    title = "Designer agent thinking…";
    sub = "Asking the Designer agent for a palette and typography.";
  } else if (status === "generating-logo" || runningLogo) {
    title = "Image Generator working…";
    sub = `Running ${runningLogo?.request?.model || "nano-banana"} to generate "${runningLogo?.request?.token_id || "asset"}". Usually 4–8 seconds.`;
  } else if (qaRunning) {
    title = "QA agent reviewing…";
    sub = "Auditing the prototype for missing elements and accessibility.";
  } else if (status === "writing-ui") {
    title = "בונה את האפליקציה שלך… / Building your app…";
    sub = elapsed < 15
      ? "Gemi is composing a self-contained index.html. This usually takes 20–45 seconds — please hang tight."
      : elapsed < 35
        ? "עוד כמה שניות, האפליקציה כמעט מוכנה. / Almost there — finishing the layout and inline styles."
        : "כמעט סיימנו, סבלנות אחרונה. / Last few seconds — wrapping up the JavaScript.";
  }

  return (
    <div className="build-progress">
      <div className="spinner" />
      <div className="title">{title}</div>
      <div className="sub">{sub}</div>
      {(status === "writing-ui" || status === "generating-logo" || runningLogo || designerRunning || qaRunning) && (
        <div className="elapsed-chip" aria-live="polite">⏱ {elapsed}s</div>
      )}

      {status === "writing-ui" && (
        <div className="code-shimmer" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="line" style={{ width: `${40 + ((i * 17) % 55)}%` }} />
          ))}
        </div>
      )}

      {lastLogo && lastLogo.status === "done" && (
        <div className="logo-chip">
          <Icon name="sparkle" size={12} color="#9B72CB" /> Image ready · {lastLogo.summary}
        </div>
      )}

      {files.length > 0 && (
        <div className="file-trail">
          {files.map(f => (
            <div key={f.filename} className={"row " + (recentlyWritten === f.filename ? "writing" : "done")}>
              <span className="ic"><Icon name="check" size={12} color="#34A853" /></span>
              <FileIcon filename={f.filename} />
              <span style={{ flex: 1 }}>{f.filename}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentActivityRail({ activity, onClear }) {
  return (
    <aside className="agent-rail">
      <div className="agent-rail-head">
        <div>
          <div className="t">Agent Activity</div>
          <div className="s">Designer + QA on Vertex AI Agent Engine</div>
        </div>
        {activity.length > 0 && (
          <button className="btn btn-ghost btn-icon" title="Clear" onClick={onClear}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="agent-rail-body">
        {activity.length === 0 ? (
          <div className="agent-empty">
            <div className="ic"><Icon name="sparkle" size={20} color="#9B72CB" /></div>
            <div className="t">No agent calls yet</div>
            <div className="s">Gemi will consult the Designer and QA agents as you iterate on the preview.</div>
          </div>
        ) : activity.map(card => <AgentCard key={card.id} card={card} />)}
      </div>
    </aside>
  );
}

function AgentCard({ card }) {
  const elapsed = (card.finishedAt || Date.now()) - card.startedAt;
  const sec = (elapsed / 1000).toFixed(1);
  const consoleHref = card.engineResource
    ? `https://console.cloud.google.com/vertex-ai/agents/locations/us-central1/agent-engines/${card.engineResource.split("/").pop()}?project=agentic-system-488914`
    : null;
  return (
    <div className={"agent-card"} data-agent={card.agent} data-status={card.status}>
      <div className="hdr">
        <span className="badge">{agentLabel(card.agent)}</span>
        <span className="dot" />
        <span className="time">{sec}s</span>
      </div>
      <div className="summary">{card.summary}</div>
      {card.status === "error" && card.response?.error && (
        <div className="err">{String(card.response.error).slice(0, 200)}</div>
      )}
      {consoleHref && (
        <a className="link" href={consoleHref} target="_blank" rel="noreferrer">
          View Agent Engine session ↗
        </a>
      )}
    </div>
  );
}

function HistoryList({ projects, currentId, onLoad, onDelete, onNew }) {
  return (
    <div className="history-pane">
      <div className="history-actions">
        <button className="btn btn-secondary btn-sm" onClick={onNew} title="Start a fresh project">
          <Icon name="bolt" size={12} color="#1A73E8" /> New project
        </button>
      </div>
      {projects.length === 0 ? (
        <div className="history-empty">
          <div className="ic"><Icon name="diagram" size={24} color="#1A73E8" /></div>
          <div className="t">No saved projects yet</div>
          <div className="s">Projects you build with Gemi are saved here automatically. They survive page reloads.</div>
        </div>
      ) : (
        <div className="history-list">
          {projects.map(p => {
            const isCurrent = p.id === currentId;
            const fileCount = (p.files || []).length;
            return (
              <div
                key={p.id}
                className={"history-row" + (isCurrent ? " current" : "")}
                onClick={() => !isCurrent && onLoad(p.id)}
                title={isCurrent ? "This is the current project" : "Click to load this project"}
              >
                <div className="thumb">
                  <Icon name={fileCount > 0 ? "globe" : "diagram"} size={16} color="#1A73E8" />
                </div>
                <div className="meta-col">
                  <div className="name">
                    {p.name}
                    {fileCount === 0 && <span className="arch-only-badge" title="Saved before files were written. Only the architecture is available.">architecture only</span>}
                  </div>
                  <div className="meta">
                    {fileCount > 0
                      ? <>{fileCount} file{fileCount === 1 ? "" : "s"}</>
                      : <>diagram saved · no files</>} ·
                    {" "}{new Date(p.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {isCurrent && <span className="current-badge">· current</span>}
                  </div>
                </div>
                <button
                  className="del"
                  onClick={(e) => onDelete(p.id, e)}
                  title="Delete this project"
                  aria-label="Delete project"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

window.ScenarioCode = ScenarioCode;
