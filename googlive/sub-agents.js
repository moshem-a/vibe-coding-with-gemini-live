// sub-agents.js — Browser client for Designer + QA sub-agents and image gen.
//
// Originally routed through a Cloud Run proxy in front of Vertex AI Agent
// Engine. Agent Engine stream_query proved flaky in this environment so the
// sub-agents now call Gemini directly against generativelanguage.googleapis.com.
// Primary model is gemini-3.5-flash; if it errors (e.g. unavailable in region
// or quota), we fall back to gemini-3.1-pro-preview with the same prompts.
// Image generation (nano-banana / imagen-4) was always browser-direct.
//
// Loaded by index.html before the React/Babel scripts; exposes window.SubAgents.

(function () {
  const SESSION_ID =
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? "tab-" + crypto.randomUUID().slice(0, 8)
      : "tab-" + Math.random().toString(36).slice(2, 10));

  const SUBAGENT_MODEL_PRIMARY  = "gemini-3.5-flash";
  const SUBAGENT_MODEL_FALLBACK = "gemini-3.1-pro-preview";

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

  const EDITOR_PROMPT =
    "You are the Editor sub-agent for a prototype-building tool. " +
    "You receive the FULL current index.html of a single-file prototype and a short change request " +
    "(optionally with a Designer recommendation). " +
    "Return the COMPLETE new index.html with the requested change applied — same overall structure, " +
    "all unrelated content / scripts / styles preserved verbatim. " +
    "CRITICAL RULES: " +
    "(1) Preserve every __ASSET_*__ placeholder string exactly as-is (these are image tokens the host substitutes). " +
    "(2) Preserve all <script>, <style>, and inline JS unless the change explicitly targets them. " +
    "(3) Preserve the multi-view SPA structure (window.showView, window.goBack, the <section data-view=...> blocks). " +
    "(4) Output ONLY the raw HTML — no markdown code fences, no explanations, no '```html', no leading prose. " +
    "(5) The output MUST be a complete valid HTML document starting with <!DOCTYPE html> or <html. " +
    "(6) Do NOT shorten or summarize the document. Output every line, even unchanged ones.";

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

  async function _callOneModel({ model, key, systemPrompt, message, responseMime, temperature, maxOutputTokens }) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      encodeURIComponent(key);
    const generationConfig = {
      responseMimeType: responseMime || "application/json",
      temperature: typeof temperature === "number" ? temperature : 0.4,
    };
    if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const err = new Error("sub-agent " + model + " " + res.status + ": " + errBody.slice(0, 200));
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    const isJson = (responseMime || "application/json") === "application/json";
    return { text, parsed: isJson ? _coerceJson(text) : text, modelUsed: model };
  }

  async function _callGemini({ apiKey, systemPrompt, userMessage, contextHtml, contextMaxChars, responseMime, temperature, maxOutputTokens }) {
    const key = _getApiKey(apiKey);
    if (!key) throw new Error("sub-agent: GEMINI_API_KEY missing");
    const maxCtx = typeof contextMaxChars === "number" ? contextMaxChars : 8000;
    const message = contextHtml
      ? userMessage + "\n\n--- HTML context" + (maxCtx > 0 ? " (truncated)" : "") + " ---\n" +
        (maxCtx > 0 ? _truncate(contextHtml, maxCtx) : contextHtml)
      : userMessage;
    const callOpts = { key, systemPrompt, message, responseMime, temperature, maxOutputTokens };
    try {
      return await _callOneModel({ model: SUBAGENT_MODEL_PRIMARY, ...callOpts });
    } catch (primaryErr) {
      console.warn(
        "[sub-agent] primary model " + SUBAGENT_MODEL_PRIMARY +
        " failed, falling back to " + SUBAGENT_MODEL_FALLBACK + ":",
        primaryErr.message
      );
      try {
        window.dispatchEvent(new CustomEvent("subagent:fallback", {
          detail: { primary: SUBAGENT_MODEL_PRIMARY, fallback: SUBAGENT_MODEL_FALLBACK, error: primaryErr.message }
        }));
      } catch (_) {}
      try {
        return await _callOneModel({ model: SUBAGENT_MODEL_FALLBACK, ...callOpts });
      } catch (fallbackErr) {
        fallbackErr.message =
          "Both sub-agent models failed. Primary (" + SUBAGENT_MODEL_PRIMARY + "): " +
          primaryErr.message + " | Fallback (" + SUBAGENT_MODEL_FALLBACK + "): " + fallbackErr.message;
        throw fallbackErr;
      }
    }
  }

  // Public API. Return shape mirrors what scenario-code.jsx already consumes
  // ({result, text, engine_resource_name}) so no caller changes are needed.
  async function runSubAgent({ role, userMessage, contextHtml, apiKey }) {
    const systemPrompt =
      role === "designer"  ? DESIGNER_PROMPT  :
      role === "developer" ? DEVELOPER_PROMPT :
                             QA_PROMPT;
    const { text, parsed, modelUsed } = await _callGemini({ apiKey, systemPrompt, userMessage, contextHtml });
    return {
      role,
      engine_resource_name: null, // direct Gemini call — no Agent Engine resource
      result: parsed,
      text,
      model: modelUsed,
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

  // Editor sub-agent: rewrites the full index.html with a requested change applied.
  // Bypasses the voice model entirely so Gemini Live never has to re-emit thousands
  // of HTML tokens through tool args. Returns { html, modelUsed }. Throws on
  // truncation / non-HTML output / sub-agent failure.
  async function runEditor({ currentHtml, changeRequest, designerRecommendation, apiKey }) {
    if (!currentHtml || typeof currentHtml !== "string") {
      throw new Error("runEditor: currentHtml is required");
    }
    if (!changeRequest || typeof changeRequest !== "string") {
      throw new Error("runEditor: changeRequest is required");
    }
    const parts = ["Change request: " + changeRequest];
    if (designerRecommendation) {
      const rec = typeof designerRecommendation === "string"
        ? designerRecommendation
        : JSON.stringify(designerRecommendation);
      parts.push("Designer recommendation (apply this): " + rec);
    }
    parts.push("Return the FULL updated index.html with that change applied. Preserve everything else verbatim, including all __ASSET_*__ placeholders, <script>, <style>, and the multi-view SPA structure.");
    const userMessage = parts.join("\n\n");

    const { text, modelUsed } = await _callGemini({
      apiKey,
      systemPrompt: EDITOR_PROMPT,
      userMessage,
      contextHtml: currentHtml,
      contextMaxChars: 0,           // Editor needs the full HTML, not a truncated excerpt
      responseMime: "text/plain",   // raw HTML, not JSON
      temperature: 0.2,             // deterministic edits
      maxOutputTokens: 32768,       // big prototypes are ~8-15k tokens
    });

    let html = (text || "").trim();
    // Strip code fences the model may add despite the prompt
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    }
    // Find first '<' just in case the model prefixed prose
    const lt = html.indexOf("<");
    if (lt > 0) html = html.slice(lt);

    if (!html.startsWith("<")) {
      throw new Error("Editor returned non-HTML output (first 120 chars): " + html.slice(0, 120));
    }
    const minLength = Math.floor(currentHtml.length * 0.8);
    if (html.length < minLength) {
      throw new Error(
        "Editor truncated the HTML: " + html.length + " chars returned, expected ≥ " +
        minLength + " (80% of " + currentHtml.length + "). Likely model output limit. Try a smaller change."
      );
    }
    return {
      html,
      modelUsed,
      sessionUserId: SESSION_ID,
      engine_resource_name: null,
    };
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
    runEditor,
    runSubAgent,
    generateImage,
    SESSION_ID,
    model: SUBAGENT_MODEL_PRIMARY,
    fallbackModel: SUBAGENT_MODEL_FALLBACK,
  };
})();
