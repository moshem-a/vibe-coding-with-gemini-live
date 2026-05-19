// scenario-translate.jsx — Live two-way translation
const LANGUAGES = [
  { code: "en-US", name: "English",    flag: "🇺🇸" },
  { code: "es-US", name: "Spanish",    flag: "🇪🇸" },
  { code: "fr-FR", name: "French",     flag: "🇫🇷" },
  { code: "de-DE", name: "German",     flag: "🇩🇪" },
  { code: "it-IT", name: "Italian",    flag: "🇮🇹" },
  { code: "pt-BR", name: "Portuguese", flag: "🇧🇷" },
  { code: "hi-IN", name: "Hindi",      flag: "🇮🇳" },
  { code: "ja-JP", name: "Japanese",   flag: "🇯🇵" },
  { code: "ko-KR", name: "Korean",     flag: "🇰🇷" },
  { code: "cmn-CN", name: "Mandarin",  flag: "🇨🇳" },
  { code: "ar-XA", name: "Arabic",     flag: "🇸🇦" },
  { code: "he-IL", name: "Hebrew",     flag: "🇮🇱" },
  { code: "nl-NL", name: "Dutch",      flag: "🇳🇱" },
  { code: "tr-TR", name: "Turkish",    flag: "🇹🇷" },
  { code: "ru-RU", name: "Russian",    flag: "🇷🇺" }
];

function translatePrompt(srcName, tgtName) {
  return `You are a real-time interpreter. The user will speak in ${srcName}. Your ONLY job is to repeat what they say, translated into ${tgtName}.

Rules:
- Translate the meaning, not word-for-word. Make it sound natural and idiomatic in ${tgtName}.
- Translate EVERYTHING the user says, including questions, casual remarks, and side comments.
- Do NOT answer questions. Do NOT add commentary, greetings, or filler. Do NOT say "the user said". Just produce the translation in ${tgtName}.
- Speak ONLY in ${tgtName}. Never in ${srcName} or any other language.
- If the user says nothing translatable (silence, noise), say nothing.
- Match the speaker's tone — formal stays formal, casual stays casual.`;
}

function ScenarioTranslate({ apiKey, onExit }) {
  const [src, setSrc] = useState("en-US");
  const [tgt, setTgt] = useState("he-IL");
  const [srcText, setSrcText] = useState("");
  const [tgtText, setTgtText] = useState("");
  const [srcStreaming, setSrcStreaming] = useState(false);
  const [tgtStreaming, setTgtStreaming] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sessionKey, setSessionKey] = useState(0); // bump to restart session
  const micRef = useRef(null);
  const playerRef = useRef(null);
  const srcBufRef = useRef("");
  const tgtBufRef = useRef("");
  const [, force] = useState(0);

  const srcLang = LANGUAGES.find(l => l.code === src) || LANGUAGES[0];
  const tgtLang = LANGUAGES.find(l => l.code === tgt) || LANGUAGES[1];

  const live = useLiveSession({
    apiKey,
    model: "models/gemini-3.1-flash-live-preview",
    systemInstruction: translatePrompt(srcLang.name, tgtLang.name),
    voice: "Charon",
    responseModalities: ["AUDIO"],
    languageCode: tgt,
    onAudio: ({ buffer }) => playerRef.current?.enqueue(buffer),
    onInputTranscript: ({ text, finished }) => {
      srcBufRef.current += text;
      setSrcText(srcBufRef.current);
      setSrcStreaming(!finished);
      if (finished) srcBufRef.current = "";
    },
    onOutputTranscript: ({ text, finished }) => {
      tgtBufRef.current += text;
      setTgtText(tgtBufRef.current);
      setTgtStreaming(!finished);
      if (finished) tgtBufRef.current = "";
    },
    onInterrupted: () => {
      playerRef.current?.stop();
      setSrcStreaming(false); setTgtStreaming(false);
    },
    onTurnComplete: () => {
      setSrcStreaming(false); setTgtStreaming(false);
    }
  });

  // Connect / reconnect on language change
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
    })();
    return () => {
      mounted = false;
      micRef.current?.stop();
      playerRef.current?.stop();
      live.disconnect();
    };
  }, [sessionKey]); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);
  useEffect(() => { const id = setInterval(() => force((x) => x + 1), 100); return () => clearInterval(id); }, []);

  const restart = () => {
    setSrcText(""); setTgtText("");
    srcBufRef.current = ""; tgtBufRef.current = "";
    setSessionKey(k => k + 1);
  };

  const swap = () => {
    const a = src, b = tgt;
    setSrc(b); setTgt(a);
    setSrcText(""); setTgtText("");
    srcBufRef.current = ""; tgtBufRef.current = "";
    setSessionKey(k => k + 1);
  };

  const toggleMute = () => { const m = !muted; setMuted(m); micRef.current?.mute(m); };

  return (
    <div>
      <AppBar crumb="Live Translation" onHome={onExit} right={<ConnChip state={live.state} />} />
      <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
        {/* Language picker bar */}
        <div style={{ height: 64, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, background: "var(--surface)", borderBottom: "1px solid var(--border-soft)" }}>
          <LangPick value={src} onChange={(v) => { setSrc(v); setSrcText(""); setTgtText(""); srcBufRef.current=""; tgtBufRef.current=""; setSessionKey(k=>k+1); }} label="You speak" />
          <button className="btn btn-secondary btn-icon" onClick={swap} title="Swap languages">
            <Icon name="swap" size={18} />
          </button>
          <LangPick value={tgt} onChange={(v) => { setTgt(v); setSrcText(""); setTgtText(""); srcBufRef.current=""; tgtBufRef.current=""; setSessionKey(k=>k+1); }} label="Translate to" />
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={restart}>
            Clear
          </button>
        </div>

        <div className="translate-stage" style={{ flex: 1 }}>
          <div className="lang-pane">
            <div className="lang-head">
              <div className="lang-name">{srcLang.flag} {srcLang.name} · source</div>
              <Icon name="mic" size={16} color={muted ? "#80868B" : "#1A73E8"} />
            </div>
            <div className={"lang-text" + (srcStreaming ? " streaming" : "")}>
              {srcText || <span style={{ color: "var(--text-tertiary)" }}>Start speaking in {srcLang.name}…</span>}
            </div>
            <div style={{ marginTop: 16 }}>
              <Waveform getLevel={() => micRef.current?.level ?? 0} active={!muted && live.state === "live"} bars={24} />
            </div>
          </div>
          <div className="lang-pane">
            <div className="lang-head">
              <div className="lang-name">{tgtLang.flag} {tgtLang.name} · translation</div>
              <Icon name="speaker" size={16} color="#9B72CB" />
            </div>
            <div className={"lang-text" + (tgtStreaming ? " streaming" : "")}>
              {tgtText || <span style={{ color: "var(--text-tertiary)" }}>Translation will stream here…</span>}
            </div>
            <div style={{ marginTop: 16 }}>
              <Waveform getLevel={() => playerRef.current?.getLevel?.() ?? 0} active={live.state === "live"} bars={24} />
            </div>
          </div>
        </div>

        <div style={{ height: 88, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, background: "var(--surface)", borderTop: "1px solid var(--border-soft)" }}>
          <button className={"mic-btn " + (muted ? "muted" : "")} onClick={toggleMute} style={{ width: 64, height: 64 }}>
            {!muted && live.state === "live" && <span className="halo" />}
            <Icon name={muted ? "micOff" : "mic"} size={24} color={muted ? "var(--text-secondary)" : "white"} />
          </button>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {live.state === "live" ? (muted ? "Microphone muted" : `Speak in ${srcLang.name}`) :
               live.state === "connecting" ? "Setting up interpreter…" :
               live.state === "error" ? "Connection error" : "Disconnected"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Powered by Gemini 3.1 Flash Live · <span className="kbd">Esc</span> to exit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LangPick({ value, onChange, label }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
      <select className="lang-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag}  {l.name}</option>)}
      </select>
    </label>
  );
}

window.ScenarioTranslate = ScenarioTranslate;
