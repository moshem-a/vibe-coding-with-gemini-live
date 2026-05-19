// components.jsx — shared UI primitives
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Icons ────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor", style }) => {
  const s = { width: size, height: size, ...style };
  const stroke = { stroke: color, fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    mic:        <><rect x="9" y="3" width="6" height="11" rx="3" {...stroke} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...stroke} /></>,
    micOff:     <><line x1="3" y1="3" x2="21" y2="21" {...stroke} /><rect x="9" y="3" width="6" height="8" rx="3" {...stroke} /><path d="M19 11a7 7 0 0 1-.7 3M5 11a7 7 0 0 0 10.3 6.2M12 18v3" {...stroke} /></>,
    arrow:      <polyline points="9 6 15 12 9 18" {...stroke} />,
    arrowLeft:  <polyline points="15 6 9 12 15 18" {...stroke} />,
    close:      <><line x1="6" y1="6" x2="18" y2="18" {...stroke} /><line x1="18" y1="6" x2="6" y2="18" {...stroke} /></>,
    chat:       <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" {...stroke} />,
    cam:        <><rect x="3" y="6" width="14" height="12" rx="2" {...stroke} /><path d="M17 10l4-2v8l-4-2z" {...stroke} /></>,
    code:       <><polyline points="16 18 22 12 16 6" {...stroke} /><polyline points="8 6 2 12 8 18" {...stroke} /></>,
    globe:      <><circle cx="12" cy="12" r="9" {...stroke} /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" {...stroke} /></>,
    play:       <polygon points="6 4 20 12 6 20 6 4" fill={color} stroke="none" />,
    stop:       <rect x="6" y="6" width="12" height="12" rx="2" fill={color} stroke="none" />,
    sparkle:    <><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round"/></>,
    settings:   <><circle cx="12" cy="12" r="3" {...stroke} /><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...stroke} /></>,
    camera:     <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...stroke} /><circle cx="12" cy="13" r="4" {...stroke} /></>,
    check:      <polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    x:          <><line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={3} strokeLinecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={3} strokeLinecap="round"/></>,
    swap:       <><polyline points="17 1 21 5 17 9" {...stroke} /><path d="M3 11V9a4 4 0 0 1 4-4h14" {...stroke} /><polyline points="7 23 3 19 7 15" {...stroke} /><path d="M21 13v2a4 4 0 0 1-4 4H3" {...stroke} /></>,
    speaker:    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={color} stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" {...stroke} /></>,
    diagram:    <><rect x="3" y="3" width="6" height="6" rx="1" {...stroke} /><rect x="15" y="3" width="6" height="6" rx="1" {...stroke} /><rect x="9" y="15" width="6" height="6" rx="1" {...stroke} /><path d="M6 9v3h12V9M12 12v3" {...stroke} /></>,
    bolt:       <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={color} strokeWidth={1.5} fill={color} fillOpacity=".15" strokeLinejoin="round"/>,
  };
  return <svg viewBox="0 0 24 24" style={s}>{paths[name]}</svg>;
};

// ─── App bar ──────────────────────────────────────────────────────
function AppBar({ crumb, right, onHome }) {
  return (
    <div className="appbar">
      <div className="logo" onClick={onHome} style={{ cursor: onHome ? "pointer" : "default" }}>
        <div className="mark">G</div>
        <div>Gemini Live <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>· Demo Suite</span></div>
      </div>
      {crumb && <div className="crumb">/ <b>{crumb}</b></div>}
      <div className="spacer" />
      {right}
      <div className="pill"><span className="dot" /> Gemini 3.1 Flash · Live</div>
    </div>
  );
}

// ─── Waveform (driven by an external level 0-1, or by an analyser fn) ──
function Waveform({ getLevel, active = true, bars = 28 }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const tick = () => {
      const el = ref.current;
      if (!el) { raf = requestAnimationFrame(tick); return; }
      const lv = active ? Math.min(1, (getLevel?.() ?? 0) * 4) : 0;
      const childs = el.children;
      const now = performance.now() / 200;
      for (let i = 0; i < childs.length; i++) {
        const phase = Math.sin(now + i * 0.5) * 0.5 + 0.5;
        const center = 1 - Math.abs((i - (bars - 1) / 2) / ((bars - 1) / 2));
        const h = 6 + lv * 44 * (0.4 + 0.6 * phase) * (0.5 + 0.5 * center);
        childs[i].style.height = h + "px";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [getLevel, active, bars]);
  return (
    <div ref={ref} className={"wave" + (active ? "" : " silent")}>
      {Array.from({ length: bars }, (_, i) => <div key={i} className="bar" />)}
    </div>
  );
}

// ─── Transcript bubble list ──────────────────────────────────────
function Transcript({ turns }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);
  return (
    <div ref={scrollRef} className="panel-body">
      {turns.length === 0 ? (
        <div className="empty">
          <div className="ic"><Icon name="sparkle" size={28} color="#1A73E8" /></div>
          <div>Start the call to begin the conversation.</div>
        </div>
      ) : (
        <div className="transcript">
          {turns.map((t, i) => (
            <div key={i} className={"bubble " + t.role + (t.streaming ? " streaming" : "")}>
              <div className="who">{t.role === "user" ? "You" : "Gemini"}</div>
              <div>{t.text || (t.streaming ? "" : "…")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connection chip ─────────────────────────────────────────────
function ConnChip({ state }) {
  const map = {
    idle:       { cls: "",      label: "Disconnected" },
    connecting: { cls: "",      label: "Connecting…" },
    live:       { cls: "live",  label: "Live" },
    error:      { cls: "error", label: "Error" }
  };
  const it = map[state] || map.idle;
  return (
    <div className={"conn-chip " + it.cls}>
      <span className="dot" />
      {it.label}
    </div>
  );
}

// ─── API key setup card ───────────────────────────────────────────
function SetupCard({ onSave }) {
  const [key, setKey] = useState("");
  return (
    <div className="setup">
      <h2>Connect Gemini Live</h2>
      <p>Paste your Google AI Studio API key to enable live voice, vision, and streaming. The key stays in your browser (localStorage) — it's never sent anywhere except Google.</p>
      <label>API key</label>
      <input
        type="password"
        placeholder="AIza…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoFocus
      />
      <p className="hint">Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com</a></p>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button className="btn btn-primary" disabled={!key.trim()} onClick={() => onSave(key.trim())}>
          Save & continue
        </button>
        <button className="btn btn-ghost" onClick={() => onSave("DEMO")}>
          Use demo mode (no key)
        </button>
      </div>
    </div>
  );
}

// ─── Custom hook: live session lifecycle ──────────────────────────
function useLiveSession({ apiKey, model, systemInstruction, voice, tools, responseModalities, languageCode, onText, onAudio, onInputTranscript, onOutputTranscript, onInterrupted, onTurnComplete, onToolCall, onReady, onError }) {
  const sessionRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | connecting | live | error
  const handlers = useRef({});
  handlers.current = { onText, onAudio, onInputTranscript, onOutputTranscript, onInterrupted, onTurnComplete, onToolCall, onReady, onError };

  const connect = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;
    if (!apiKey || apiKey === "DEMO") {
      setState("error");
      return null;
    }
    setState("connecting");
    const s = new window.GeminiLive.Session({
      apiKey, model, systemInstruction, voice, tools, responseModalities, languageCode
    });
    s.addEventListener("ready", () => { setState("live"); handlers.current.onReady?.(); });
    s.addEventListener("error", (e) => { setState("error"); handlers.current.onError?.(e); });
    s.addEventListener("close", () => setState("idle"));
    s.addEventListener("text", (e) => handlers.current.onText?.(e.detail));
    s.addEventListener("audio", (e) => handlers.current.onAudio?.(e.detail));
    s.addEventListener("inputTranscript", (e) => handlers.current.onInputTranscript?.(e.detail));
    s.addEventListener("outputTranscript", (e) => handlers.current.onOutputTranscript?.(e.detail));
    s.addEventListener("interrupted", () => handlers.current.onInterrupted?.());
    s.addEventListener("turnComplete", () => handlers.current.onTurnComplete?.());
    s.addEventListener("toolCall", (e) => handlers.current.onToolCall?.(e.detail));
    try {
      await s.connect();
      sessionRef.current = s;
      return s;
    } catch (e) {
      setState("error");
      handlers.current.onError?.(e);
      return null;
    }
  }, [apiKey, model, systemInstruction, voice, JSON.stringify(tools), JSON.stringify(responseModalities), languageCode]);

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setState("idle");
  }, []);

  useEffect(() => () => { sessionRef.current?.close(); sessionRef.current = null; }, []);

  return { state, connect, disconnect, session: sessionRef };
}

// ─── Export ──────────────────────────────────────────────────────
Object.assign(window, {
  Icon, AppBar, Waveform, Transcript, ConnChip, SetupCard, useLiveSession
});
