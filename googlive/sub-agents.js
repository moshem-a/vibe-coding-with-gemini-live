// sub-agents.js — Browser client for Designer + QA sub-agents and image gen.
//
// Originally routed through a Cloud Run proxy in front of Vertex AI Agent
// Engine. Agent Engine stream_query proved flaky in this environment so the
// sub-agents now call gemini-3.1-pro-preview directly against
// generativelanguage.googleapis.com — same model, same prompts, no proxy.
// Image generation (nano-banana / imagen-4) was always browser-direct.
//
// Loaded by index.html before the React/Babel scripts; exposes window.SubAgents.

(function () {
  const SESSION_ID =
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? "tab-" + crypto.randomUUID().slice(0, 8)
      : "tab-" + Math.random().toString(36).slice(2, 10));

  const SUBAGENT_MODEL = "gemini-3.1-pro-preview";

  const DESIGNER_PROMPT =
    "You are the Designer sub-agent for a prototype-building tool. " +
    "Given a question about visual design and an optional snippet of the current HTML, " +
    "return a crisp visual recommendation. Use Google Cloud / Material Design 3 sensibilities: " +
    "generous whitespace, large rounded corners (16-24px), subtle elevation, " +
    "vivid-but-restrained gradients (Google Blue → Purple → Pink → Yellow lineage). " +
    "Hebrew users are common — prefer typography that pairs well with עברית. " +
    "Respond ONLY in this JSON schema (no prose, no code fences): " +
    '{"palette":["#hex", ...], "typography":{"heading":"...","body":"..."}, ' +
    '"recommendations":["..."], "css_snippet":"optional CSS string"}';

  const QA_PROMPT =
    "You are the QA sub-agent for a prototype-building tool. " +
    "Review the supplied HTML for missing/broken interactions, semantic structure, " +
    "accessibility (alt text, labels, contrast), and UX. Be terse. " +
    "Respond ONLY in this JSON schema (no prose, no code fences): " +
    '{"issues":[{"severity":"high|med|low","area":"...","message":"..."}], "ok": true|false}. ' +
    "Set ok=true only if no high/med severity issues remain.";

  const DEVELOPER_PROMPT =
    "You are the Developer sub-agent for a prototype-building tool. " +
    "Given an engineering question and optional code context, recommend the simplest " +
    "vanilla-JS approach that fits a single-file index.html prototype. Prefer native " +
    "browser APIs, plain DOM, and zero dependencies. Call out anything fragile or that " +
    "won't work cross-browser. Be terse. Respond ONLY in this JSON schema " +
    "(no prose, no code fences): " +
    '{"approach":"one-line description", ' +
    '"code_snippet":"short JS snippet that demonstrates the pattern", ' +
    '"considerations":["..."], "risks":["..."]}';

  function _truncate(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    return s.slice(0, n) + "\n…[truncated " + (s.length - n) + " chars]…";
  }

  const _JSON_BLOCK = /\{[\s\S]*\}/;
  function _coerceJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) {}
    const m = text.match(_JSON_BLOCK);
    if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
    return text;
  }

  function _getApiKey(explicit) {
    return (
      explicit ||
      (typeof window !== "undefined" && (window.__GEMINI_API_KEY || window.GEMINI_API_KEY)) ||
      ""
    );
  }

  async function _callGemini({ apiKey, systemPrompt, userMessage, contextHtml }) {
    const key = _getApiKey(apiKey);
    if (!key) throw new Error("sub-agent: GEMINI_API_KEY missing");
    const message = contextHtml
      ? userMessage + "\n\n--- HTML context (truncated) ---\n" + _truncate(contextHtml, 8000)
      : userMessage;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      SUBAGENT_MODEL +
      ":generateContent?key=" +
      encodeURIComponent(key);
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error("sub-agent " + res.status + ": " + errBody.slice(0, 200));
    }
    const data = await res.json();
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    return { text, parsed: _coerceJson(text) };
  }

  // Public API. Return shape mirrors what scenario-code.jsx already consumes
  // ({result, text, engine_resource_name}) so no caller changes are needed.
  async function runSubAgent({ role, userMessage, contextHtml, apiKey }) {
    const systemPrompt =
      role === "designer"  ? DESIGNER_PROMPT  :
      role === "developer" ? DEVELOPER_PROMPT :
                             QA_PROMPT;
    const { text, parsed } = await _callGemini({ apiKey, systemPrompt, userMessage, contextHtml });
    return {
      role,
      engine_resource_name: null, // direct Gemini call — no Agent Engine resource
      result: parsed,
      text,
      session_user_id: SESSION_ID,
    };
  }

  async function runDesigner({ question, currentHtml, apiKey }) {
    return runSubAgent({
      role: "designer",
      userMessage: question || "Suggest visual decisions for this UI.",
      contextHtml: currentHtml,
      apiKey,
    });
  }

  async function runQA({ html, apiKey }) {
    return runSubAgent({
      role: "qa",
      userMessage: "Review this prototype HTML and return your QA findings.",
      contextHtml: html,
      apiKey,
    });
  }

  async function runDeveloper({ question, currentHtml, apiKey }) {
    return runSubAgent({
      role: "developer",
      userMessage: question || "Suggest the simplest engineering approach.",
      contextHtml: currentHtml,
      apiKey,
    });
  }

  // ---- Image generation -----------------------------------------------------

  // Only LOGOS get logo styling. Content images (hero, card1, avatar, …) keep
  // their subject-specific prompt intact and just receive a light quality nudge.
  // Forcing "vector-style app logo" on every image was producing icon-style
  // car logos when the model asked for a photo of a car, etc.
  function _enrichPrompt(prompt, style, tokenId) {
    const stylePart = style ? " Style: " + style + "." : "";
    const id = (tokenId || "").toLowerCase();
    const isLogo = id === "logo" || id === "brand" || id === "icon";
    if (isLogo) {
      return (
        prompt + "." + stylePart +
        " Square app logo / brand mark, centered composition on transparent or solid background, no text unless requested, suitable for a web app header."
      );
    }
    if (id === "avatar") {
      return (
        prompt + "." + stylePart +
        " Square portrait, head-and-shoulders framing, natural lighting, suitable for a user profile picture."
      );
    }
    // Generic content image (hero / card / illustration / empty / etc).
    // Trust the model's subject-specific prompt; only nudge quality.
    return (
      prompt + "." + stylePart +
      " High quality, sharp focus, professional composition, no text overlays, no watermarks. Render exactly the subject described — do NOT substitute a logo or icon."
    );
  }

  async function _generateNanoBanana({ apiKey, prompt }) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=" +
      encodeURIComponent(apiKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) throw new Error("nano-banana " + res.status + ": " + (await res.text()).slice(0, 200));
    const data = await res.json();
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const imgPart = parts.find((p) => p && p.inlineData && p.inlineData.data);
    if (!imgPart) throw new Error("nano-banana returned no image part");
    const mime = imgPart.inlineData.mimeType || "image/png";
    return "data:" + mime + ";base64," + imgPart.inlineData.data;
  }

  async function _generateImagen4({ apiKey, prompt }) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=" +
      encodeURIComponent(apiKey);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
    });
    if (!res.ok) throw new Error("imagen-4 " + res.status + ": " + (await res.text()).slice(0, 200));
    const data = await res.json();
    const pred = (data.predictions || [])[0];
    if (!pred || !pred.bytesBase64Encoded) throw new Error("imagen-4 returned no image bytes");
    const mime = pred.mimeType || "image/png";
    return "data:" + mime + ";base64," + pred.bytesBase64Encoded;
  }

  async function generateImage({ apiKey, prompt, style, model, tokenId }) {
    const key = _getApiKey(apiKey);
    if (!key) throw new Error("generateImage: apiKey is required");
    const enriched = _enrichPrompt(prompt, style, tokenId);
    const chosen = (model || "nano-banana-pro-preview").replace(/^models\//, "");
    if (chosen.startsWith("imagen-4")) {
      return _generateImagen4({ apiKey: key, prompt: enriched });
    }
    return _generateNanoBanana({ apiKey: key, prompt: enriched });
  }

  window.SubAgents = {
    runDesigner,
    runQA,
    runDeveloper,
    runSubAgent,
    generateImage,
    SESSION_ID,
    model: SUBAGENT_MODEL,
  };
})();
