// scenario-architect.jsx — Voice call with a GCP Solutions Architect
const ARCH_SYSTEM_PROMPT = `You are Aria, a senior Google Cloud solutions architect helping a product manager or developer design a system on GCP.

Your style:
- Warm, conversational, concise. Use short sentences. Talk like a real architect — never read a slide deck.
- Run a discovery conversation. Ask focused questions about scale, latency, team size, budget, data, compliance. ONE question at a time.
- After 2–4 discovery questions, propose an initial architecture and CALL the create_architecture_diagram tool to draw it. Then walk the user through it briefly.
- As the conversation evolves, call create_architecture_diagram again to update or branch the design. Each new diagram is preserved so the user can navigate back.
- Be opinionated. Recommend specific GCP services (Cloud Run, Pub/Sub, BigQuery, Firestore, Vertex AI, etc.) and say why.
- Keep spoken answers under ~25 seconds. Brevity is a feature.

When you call create_architecture_diagram, the diagram is rendered with Mermaid. Pass a flowchart in Mermaid syntax in the 'mermaid' field.

Mermaid rules:
- Always start with 'flowchart TD' (top-down) or 'flowchart LR' (left-right). Prefer TD for tall stacks, LR for pipelines.
- Use 5–9 nodes for clarity. Use clear short labels.
- Use these node shapes by category:
    user["👤 User"]           rectangular for clients
    api("Cloud Run / API")    rounded for compute services
    bus[/"Pub/Sub"/]          parallelogram for messaging
    db[("BigQuery")]          cylinder for data stores
    ai{{"Vertex AI"}}         hexagon for AI/ML
    ext(["External API"])     stadium for external systems
- Assign each node to one of these pre-defined classes (already in the theme):
    compute     — Cloud Run, Cloud Functions, App Engine, GKE, Compute Engine
    data        — BigQuery, Firestore, Cloud SQL, Spanner, Bigtable, Cloud Storage, Memorystore
    messaging   — Pub/Sub, Eventarc, Cloud Scheduler, Cloud Tasks
    ai          — Vertex AI, Gemini, Speech-to-Text, Vision API, Translation API
    networking  — Cloud Load Balancing, Cloud CDN, API Gateway, Cloud Armor
    user        — end users, browsers, mobile clients
    external    — third-party APIs, on-prem systems
  Apply with 'class node1,node2 compute' lines after the edges.
- Use labeled edges where helpful: A -->|publish| B
- Always include a user/client node at the top of the flow.

Example:
  flowchart TD
    user["👤 Web user"]
    lb("Cloud Load Balancing")
    api("Cloud Run · API")
    bus[/"Pub/Sub"/]
    df("Dataflow")
    bq[("BigQuery")]
    fs[("Firestore")]
    user --> lb --> api
    api -->|publish| bus --> df --> bq
    api --> fs
    class user user
    class lb networking
    class api compute
    class bus messaging
    class df compute
    class bq,fs data

Give each diagram a clear title like "MVP architecture — order ingestion v1".

Default to speaking and writing in Hebrew (עברית). If the user speaks another language, mirror their language for the rest of the conversation.

Begin by greeting the user warmly and asking what they want to build.`;

const ARCH_TOOLS = [{
  functionDeclarations: [{
    name: "create_architecture_diagram",
    description: "Render or update a Google Cloud architecture diagram on the user's screen. Pass a Mermaid flowchart string.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for this diagram version" },
        description: { type: "string", description: "1–2 sentence summary of what this architecture does" },
        mermaid: { type: "string", description: "Full Mermaid flowchart definition. Use the GCP-themed classDefs documented in the system instruction." }
      },
      required: ["title", "mermaid"]
    }
  }]
}];

function ScenarioArchitect({ apiKey, onExit }) {
  const [turns, setTurns] = useState([]);
  const [diagrams, setDiagrams] = useState([]);
  const [diagramIdx, setDiagramIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const micRef = useRef(null);
  const playerRef = useRef(null);
  const userBufRef = useRef("");
  const aiBufRef = useRef("");
  const [, force] = useState(0);

  const live = useLiveSession({
    apiKey,
    model: "models/gemini-3.1-flash-live-preview",
    systemInstruction: ARCH_SYSTEM_PROMPT,
    voice: "Aoede",
    tools: ARCH_TOOLS,
    responseModalities: ["AUDIO"],
    onAudio: ({ buffer }) => playerRef.current?.enqueue(buffer),
    onInputTranscript: ({ text, finished }) => {
      userBufRef.current += text;
      setTurns((prev) => upsertStreaming(prev, "user", userBufRef.current, !finished));
      if (finished) userBufRef.current = "";
    },
    onOutputTranscript: ({ text, finished }) => {
      aiBufRef.current += text;
      setTurns((prev) => upsertStreaming(prev, "ai", aiBufRef.current, !finished));
      if (finished) aiBufRef.current = "";
    },
    onInterrupted: () => {
      playerRef.current?.stop();
      // finalize whatever AI was saying
      if (aiBufRef.current) {
        setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false));
        aiBufRef.current = "";
      }
    },
    onTurnComplete: () => {
      if (aiBufRef.current) {
        setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false));
        aiBufRef.current = "";
      }
    },
    onToolCall: async (toolCall) => {
      const responses = [];
      for (const fc of (toolCall.functionCalls || [])) {
        if (fc.name === "create_architecture_diagram") {
          const d = { ...fc.args, _ts: Date.now() };
          setDiagrams((prev) => {
            const next = [...prev, d];
            setDiagramIdx(next.length - 1);
            return next;
          });
          responses.push({ id: fc.id, name: fc.name, response: { ok: true, message: "Diagram rendered to the user's screen." } });
        }
      }
      if (responses.length && live.session.current) {
        live.session.current.sendToolResponse(responses);
      }
    },
    onError: (e) => console.error("Live session error:", e)
  });

  // Start session
  useEffect(() => {
    let mounted = true;
    (async () => {
      playerRef.current = new window.GLAudio.AudioPlayer();
      const session = await live.connect();
      if (!mounted || !session) return;
      const mic = new window.GLAudio.MicCapture();
      micRef.current = mic;
      mic.addEventListener("chunk", (e) => {
        session.sendAudio(e.detail.b64);
      });
      try { await mic.start(); } catch (err) { console.error("mic", err); }
      // Kick off
      session.sendText("Hi, I'm ready to start.", true);
    })();
    return () => {
      mounted = false;
      micRef.current?.stop();
      live.disconnect();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  // Drive waveform animation tick
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 80);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    micRef.current?.mute(m);
  };

  const current = diagrams[diagramIdx];
  const aiLevel = () => playerRef.current?.getLevel?.() ?? 0;
  const userLevel = () => micRef.current?.level ?? 0;

  return (
    <div>
      <AppBar
        crumb="Solutions Architect"
        onHome={onExit}
        right={<ConnChip state={live.state} />}
      />
      <div className="scenario">
        {/* LEFT — voice + transcript */}
        <div className="panel">
          <div className="panel-head">
            <h2>Live call with Aria</h2>
            <div className="sub">Senior GCP solutions architect · streaming voice</div>
          </div>

          <div style={{ padding: "20px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase" }}>You</div>
                <Waveform getLevel={userLevel} active={!muted && live.state === "live"} bars={16} />
              </div>
              <div style={{ width: 1, height: 40, background: "var(--border-soft)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase" }}>Gemini</div>
                <Waveform getLevel={aiLevel} active={live.state === "live"} bars={16} />
              </div>
            </div>
          </div>

          <Transcript turns={turns} />

          <div className="panel-foot">
            <button className={"mic-btn " + (muted ? "muted" : "")} onClick={toggleMute} title={muted ? "Unmute" : "Mute"}>
              {!muted && live.state === "live" && <span className="halo" />}
              <Icon name={muted ? "micOff" : "mic"} size={28} color={muted ? "var(--text-secondary)" : "white"} />
            </button>
            <div style={{ flex: 1, paddingLeft: 12 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {live.state === "live" ? (muted ? "Microphone muted" : "Listening…") :
                 live.state === "connecting" ? "Connecting to Gemini Live…" :
                 live.state === "error" ? "Connection error" : "Disconnected"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Tap mic to {muted ? "speak" : "mute"} · <span className="kbd">Esc</span> exits
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onExit} title="End call">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* RIGHT — diagram stage */}
        <div className="stage">
          <div className="stage-head">
            <Icon name="diagram" size={18} color="#1A73E8" />
            <div className="title">{current ? current.title : "Architecture canvas"}</div>
            <div className="spacer" />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {diagrams.length > 0 ? `${diagramIdx + 1} / ${diagrams.length}` : "—"}
            </div>
          </div>

          <div className="diagram-stage">
            <div className="diagram-canvas">
              {current ? (
                <div className="diagram-card">
                  <h3>{current.title}</h3>
                  {current.description && <div className="desc">{current.description}</div>}
                  <ArchDiagram diagram={current} />
                </div>
              ) : (
                <div className="diagram-empty">
                  <div className="ic"><Icon name="diagram" size={36} color="#1A73E8" /></div>
                  <div style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 360 }}>
                    Tell Aria what you want to build. She'll sketch the architecture here as the call progresses.
                  </div>
                  <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", fontSize: 13, color: "var(--text-tertiary)" }}>
                    <div>Try: <i>"I want to build a real-time analytics dashboard for IoT sensors."</i></div>
                    <div>Try: <i>"Help me design a multi-tenant SaaS backend on GCP."</i></div>
                  </div>
                </div>
              )}
            </div>

            <div className="diagram-nav">
              <button className="btn btn-secondary btn-icon" disabled={diagramIdx <= 0} onClick={() => setDiagramIdx(i => Math.max(0, i - 1))}>
                <Icon name="arrowLeft" size={18} />
              </button>
              <button className="btn btn-secondary btn-icon" disabled={diagramIdx >= diagrams.length - 1} onClick={() => setDiagramIdx(i => Math.min(diagrams.length - 1, i + 1))}>
                <Icon name="arrow" size={18} />
              </button>
              <div className="dots">
                {diagrams.map((_, i) => (
                  <div key={i} className={"d" + (i === diagramIdx ? " active" : "")} onClick={() => setDiagramIdx(i)} style={{ cursor: "pointer" }} />
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Diagrams are saved as Aria iterates. Use <span className="kbd">←</span> <span className="kbd">→</span> to browse.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: maintain a streaming bubble per role
function upsertStreaming(prev, role, text, streaming) {
  const last = prev[prev.length - 1];
  if (last && last.role === role && last.streaming) {
    const copy = prev.slice(0, -1);
    copy.push({ role, text, streaming });
    return copy;
  }
  return [...prev, { role, text, streaming }];
}

window.ScenarioArchitect = ScenarioArchitect;
window.upsertStreaming = upsertStreaming;
