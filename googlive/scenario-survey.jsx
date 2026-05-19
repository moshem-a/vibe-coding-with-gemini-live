// scenario-survey.jsx — Visual product survey with camera + Gemini Live vision
const SURVEY_SYSTEM_PROMPT = `You are Vera, a friendly product-audit assistant for retailers and CPG companies. The user is standing in front of a product (often a soda bottle or other beverage) and is sharing their camera with you. Your job: run a quick, conversational quality + correct-use audit, including coaching the user through opening the bottle properly.

YOU CAN SEE THE LIVE CAMERA FEED. Comment on what you actually see.

Procedure:
1. Greet the user warmly. Ask them to hold the product up to the camera.
2. Walk through the audit one beat at a time. ONE step at a time:
   a. Front label — identify product/brand/size.
   b. Back label / nutrition panel.
   c. Cap or seal — confirm intact before opening.
3. NOW THE OPENING DEMONSTRATION (instead of an expiry-date check):
   - Ask the user: "Please show me how you open the bottle — twist the cap slowly so I can see your hand and the seal." (Mirror the user's language.)
   - Watch the live camera as they open it. Look for: a clean twist that breaks the tamper-evident ring, both hands controlling the bottle (no spillage / no thumbs over the spout), the cap fully removed and held up to show the broken seal.
   - If they do it correctly, praise them warmly and call update_survey with opening_demonstrated: "yes", opening_correct: "yes", opening_notes: a one-line description of what you observed.
   - If they do something wrong (e.g. squeezing the bottle, fingers over the spout, struggling, no visible seal break), GENTLY coach them: explain what to do differently and ask them to try again. Then update opening_correct: "no" with notes about what went wrong, and after they retry update again.
   - If they refuse or it's unclear from the camera, set opening_demonstrated: "unclear".
4. As you observe each detail, call update_survey (product name, brand, size, cap_intact, label_intact, condition, opening_demonstrated, opening_correct, opening_notes). NEVER ask about expiry dates.
5. When you want a clean still saved to the report, call request_photo with a short label like "Front label", "Cap before opening", or "Seal broken correctly". The user will then take the picture.
6. Speak briefly between steps — under 15 seconds per turn. Be warm and observant ("Nice — clean break on the tamper ring.").
7. When the audit feels complete, call update_survey with status: "complete" and a one-line overall_finding summary.

Default to speaking and writing in Hebrew (עברית). If the user speaks another language, mirror their language for the rest of the conversation.

Keep your tone like a helpful colleague doing a quick walkthrough, not a robot reading a checklist.`;

const SURVEY_TOOLS = [{
  functionDeclarations: [
    {
      name: "update_survey",
      description: "Update the structured audit report with what you've observed.",
      parameters: {
        type: "object",
        properties: {
          product_name:          { type: "string" },
          brand:                 { type: "string" },
          category:              { type: "string", description: "e.g. soda, water, energy drink" },
          size:                  { type: "string", description: "e.g. 500ml, 12oz" },
          cap_intact:            { type: "string", enum: ["yes", "no", "unclear"], description: "Was the cap/seal intact BEFORE the opening demo?" },
          label_intact:          { type: "string", enum: ["yes", "no", "unclear"] },
          opening_demonstrated:  { type: "string", enum: ["yes", "no", "unclear"], description: "Did the user actually demonstrate opening the bottle on camera?" },
          opening_correct:       { type: "string", enum: ["yes", "no", "unclear"], description: "Was the opening technique correct: clean tamper-ring break, two-hand grip, no spill, no fingers on spout?" },
          opening_notes:         { type: "string", description: "Short description of what you observed during the opening demo (e.g. 'clean break, two-hand grip, no spillage' or 'thumb over spout, please retry')." },
          condition:             { type: "string", description: "overall condition, e.g. 'pristine', 'dented', 'leaking'" },
          notes:                 { type: "string", description: "free-form additional observations" },
          overall_finding:       { type: "string", description: "one-line summary of the audit" },
          status:                { type: "string", enum: ["in_progress", "complete"] }
        }
      }
    },
    {
      name: "request_photo",
      description: "Ask the system to capture a still frame of what's currently in the camera. Use after the user has positioned the product clearly.",
      parameters: {
        type: "object",
        properties: {
          label:  { type: "string", description: "Short label, e.g. 'Front label', 'Expiry date'" },
          reason: { type: "string", description: "Why this photo matters" }
        },
        required: ["label"]
      }
    }
  ]
}];

const REPORT_DEFAULT = {
  product_name: "", brand: "", category: "", size: "",
  cap_intact: "", label_intact: "",
  opening_demonstrated: "", opening_correct: "", opening_notes: "",
  condition: "", notes: "", overall_finding: "",
  status: "in_progress"
};

function ScenarioSurvey({ apiKey, onExit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const micRef = useRef(null);
  const playerRef = useRef(null);
  const userBufRef = useRef("");
  const aiBufRef = useRef("");
  const [report, setReport] = useState(REPORT_DEFAULT);
  const [captures, setCaptures] = useState([]); // { id, dataUrl, label, ts }
  const [activeCap, setActiveCap] = useState(null);
  const [turns, setTurns] = useState([]);
  const [activeTab, setActiveTab] = useState("camera");
  const [latestQuestion, setLatestQuestion] = useState("");
  const [muted, setMuted] = useState(false);
  const [, force] = useState(0);

  const captureFrame = useCallback((label) => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) return null;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    const cap = { id: "cap-" + Date.now(), dataUrl, label: label || "Photo", ts: Date.now() };
    setCaptures((prev) => [...prev, cap]);
    setActiveCap(cap.id);
    // flash effect
    const sh = document.querySelector(".shutter");
    if (sh) { sh.classList.remove("flash"); void sh.offsetWidth; sh.classList.add("flash"); }
    return cap;
  }, []);

  const live = useLiveSession({
    apiKey,
    model: "models/gemini-3.1-flash-live-preview",
    systemInstruction: SURVEY_SYSTEM_PROMPT,
    voice: "Kore",
    tools: SURVEY_TOOLS,
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
      setLatestQuestion(aiBufRef.current);
      if (finished) aiBufRef.current = "";
    },
    onInterrupted: () => {
      playerRef.current?.stop();
      if (aiBufRef.current) { setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false)); aiBufRef.current = ""; }
    },
    onTurnComplete: () => {
      if (aiBufRef.current) { setTurns((p) => upsertStreaming(p, "ai", aiBufRef.current, false)); aiBufRef.current = ""; }
    },
    onToolCall: (tc) => {
      const responses = [];
      for (const fc of (tc.functionCalls || [])) {
        if (fc.name === "update_survey") {
          setReport((prev) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(fc.args || {}).filter(([, v]) => v !== undefined && v !== ""))
          }));
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        }
        if (fc.name === "request_photo") {
          const cap = captureFrame(fc.args?.label || "Photo");
          responses.push({ id: fc.id, name: fc.name, response: { ok: !!cap, capture_id: cap?.id } });
        }
      }
      if (responses.length) live.session.current?.sendToolResponse(responses);
    }
  });

  // Camera + mic + session
  useEffect(() => {
    let stopped = false;
    let frameInterval;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "environment" },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error("camera", e);
      }
      playerRef.current = new window.GLAudio.AudioPlayer();
      const session = await live.connect();
      if (stopped || !session) return;

      const mic = new window.GLAudio.MicCapture();
      micRef.current = mic;
      mic.addEventListener("chunk", (e) => session.sendAudio(e.detail.b64));
      try { await mic.start(); } catch (e) { console.error("mic", e); }

      // Stream video frames at ~1 fps to Gemini
      frameInterval = setInterval(() => {
        const v = videoRef.current, c = canvasRef.current;
        if (!v || !c || v.videoWidth === 0) return;
        const max = 768;
        const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
        c.width = v.videoWidth * scale;
        c.height = v.videoHeight * scale;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL("image/jpeg", 0.6);
        const b64 = dataUrl.split(",")[1];
        session.sendImage(b64, "image/jpeg");
      }, 1000);

      session.sendText("Hi, I'm here with the product. Ready when you are.", true);
    })();
    return () => {
      stopped = true;
      clearInterval(frameInterval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      micRef.current?.stop();
      live.disconnect();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => { const m = !muted; setMuted(m); micRef.current?.mute(m); };

  const aiLevel = () => playerRef.current?.getLevel?.() ?? 0;
  const userLevel = () => micRef.current?.level ?? 0;

  const completion = useMemo(() => {
    const keys = ["product_name", "brand", "cap_intact", "label_intact", "opening_demonstrated", "opening_correct", "condition"];
    const filled = keys.filter((k) => report[k]).length;
    return Math.round((filled / keys.length) * 100);
  }, [report]);

  return (
    <div>
      <AppBar
        crumb="Visual Product Survey"
        onHome={onExit}
        right={<ConnChip state={live.state} />}
      />
      <div className="scenario">
        {/* LEFT — transcript & status */}
        <div className="panel">
          <div className="panel-head">
            <h2>Audit with Vera</h2>
            <div className="sub">Camera-driven · {completion}% complete</div>
            <div style={{ marginTop: 12, height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: completion + "%", background: "var(--gemini-gradient)", transition: "width .4s" }} />
            </div>
          </div>

          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500, letterSpacing: ".06em" }}>YOU</div>
                <Waveform getLevel={userLevel} active={!muted && live.state === "live"} bars={12} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500, letterSpacing: ".06em" }}>VERA</div>
                <Waveform getLevel={aiLevel} active={live.state === "live"} bars={12} />
              </div>
            </div>
          </div>

          <Transcript turns={turns} />

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
                {captures.length} photo{captures.length !== 1 ? "s" : ""} captured
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onExit}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* RIGHT — tabs */}
        <div className="stage">
          <div className="tabs">
            <button className={"tab" + (activeTab === "camera" ? " active" : "")} onClick={() => setActiveTab("camera")}>
              <Icon name="cam" size={14} /> Live camera
            </button>
            <button className={"tab" + (activeTab === "report" ? " active" : "")} onClick={() => setActiveTab("report")}>
              <Icon name="check" size={14} /> Report
            </button>
            <button className={"tab" + (activeTab === "form" ? " active" : "")} onClick={() => setActiveTab("form")}>
              <Icon name="diagram" size={14} /> Checklist
              <span className="count">{completion}%</span>
            </button>
            <button className={"tab" + (activeTab === "transcript" ? " active" : "")} onClick={() => setActiveTab("transcript")}>
              <Icon name="chat" size={14} /> Transcript
              <span className="count">{turns.length}</span>
            </button>
          </div>

          <div className="stage-body" style={{ display: activeTab === "camera" ? "flex" : "block", flexDirection: "column" }}>
            {activeTab === "camera" && (
              <div className="camera-stage" style={{ flex: 1 }}>
                <div className="camera-frame">
                  <video ref={videoRef} playsInline muted style={{ display: streamRef.current ? "block" : "none" }} />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  {!streamRef.current && <div className="placeholder">Waiting for camera permission…</div>}

                  <div className="hud-top">
                    {latestQuestion && (
                      <div className="question-card">
                        <div className="who">
                          <span className="conn-chip live" style={{ padding: "0 4px", background: "transparent", border: "none", color: "#34A853" }}>
                            <span className="dot" style={{ width: 6, height: 6 }} />
                          </span>
                          VERA
                        </div>
                        {latestQuestion}
                      </div>
                    )}
                    <div className="rec-chip">
                      <span className="red" /> LIVE · Gemini sees the camera
                    </div>
                  </div>

                  <div className="hud-bottom">
                    <button className="shutter" onClick={() => captureFrame("Manual")} title="Capture photo" />
                  </div>
                </div>

                <div className="capture-strip">
                  {captures.length === 0 ? (
                    <div className="empty">No captures yet — Vera will request photos as the audit progresses, or tap the shutter.</div>
                  ) : (
                    captures.map((c) => (
                      <div key={c.id} className={"cap" + (activeCap === c.id ? " active" : "")} onClick={() => setActiveCap(c.id)}>
                        <img src={c.dataUrl} alt={c.label} />
                        <div className="lbl">{c.label}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "report" && <ReportView report={report} captures={captures} />}
            {activeTab === "form" && <FormView report={report} />}
            {activeTab === "transcript" && (
              <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
                <h2 style={{ margin: "0 0 16px", fontWeight: 500 }}>Full transcript</h2>
                <div className="transcript">
                  {turns.map((t, i) => (
                    <div key={i} className={"bubble " + t.role}>
                      <div className="who">{t.role === "user" ? "You" : "Vera"}</div>
                      <div>{t.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportView({ report, captures }) {
  return (
    <div className="report">
      <h2>{report.product_name || "Product audit"}</h2>
      <div className="meta">
        {report.brand && <>{report.brand} · </>}
        {report.size && <>{report.size} · </>}
        {report.category}
        {report.status === "complete" && (
          <span style={{ marginLeft: 8, color: "var(--gc-green)", fontWeight: 500 }}>
            <Icon name="check" size={14} color="#34A853" /> Audit complete
          </span>
        )}
      </div>

      {report.overall_finding && (
        <div className="card" style={{ padding: 18, marginBottom: 24, background: "linear-gradient(135deg, rgba(66,133,244,.06), rgba(155,114,203,.06))", borderColor: "transparent" }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6, fontWeight: 500 }}>
            <Icon name="sparkle" size={14} color="#9B72CB" style={{ verticalAlign: "middle", marginRight: 4 }} />
            Vera's summary
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{report.overall_finding}</div>
        </div>
      )}

      <div className="report-grid">
        <Field label="Product" value={report.product_name} />
        <Field label="Brand" value={report.brand} />
        <Field label="Category" value={report.category} />
        <Field label="Size" value={report.size} />
        <Field label="Cap / seal intact (before opening)" value={report.cap_intact} />
        <Field label="Label intact" value={report.label_intact} />
        <Field label="Opening demonstrated" value={report.opening_demonstrated} />
        <Field label="Opening done correctly" value={report.opening_correct} />
      </div>

      {report.opening_notes && (
        <div className="field" style={{ marginTop: 16 }}>
          <div className="lbl">Opening observation</div>
          <div className="val">{report.opening_notes}</div>
        </div>
      )}
      {report.condition && (
        <div className="field" style={{ marginTop: 16 }}>
          <div className="lbl">Overall condition</div>
          <div className="val">{report.condition}</div>
        </div>
      )}
      {report.notes && (
        <div className="field" style={{ marginTop: 16 }}>
          <div className="lbl">Notes</div>
          <div className="val">{report.notes}</div>
        </div>
      )}

      {captures.length > 0 && (
        <>
          <h3 style={{ margin: "32px 0 12px", fontWeight: 500, fontSize: 16 }}>Captured photos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {captures.map((c) => (
              <div key={c.id} className="card" style={{ overflow: "hidden" }}>
                <img src={c.dataUrl} alt={c.label} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <div className="lbl">{label}</div>
      <div className={"val " + (!value ? "empty" : "")}>{value || "—"}</div>
    </div>
  );
}

function FormView({ report }) {
  const rows = [
    { k: "product_name", label: "Product identifiable" },
    { k: "brand", label: "Brand visible" },
    { k: "cap_intact", label: "Cap / seal intact (before opening)", yesNo: true },
    { k: "label_intact", label: "Label intact", yesNo: true },
    { k: "opening_demonstrated", label: "User demonstrated opening on camera", yesNo: true },
    { k: "opening_correct", label: "Opening performed correctly", yesNo: true },
    { k: "condition", label: "Overall condition assessed" }
  ];
  return (
    <div className="report">
      <h2>Audit checklist</h2>
      <div className="meta">Auto-filled by Vera as the conversation progresses.</div>
      <div className="card" style={{ padding: "8px 18px" }}>
        {rows.map((r) => {
          const v = report[r.k];
          let state = "na";
          if (r.yesNo) {
            if (v === "yes") state = "yes";
            else if (v === "no") state = "no";
          } else if (v) state = "yes";
          return (
            <div key={r.k} className="check-row">
              <div className={"check " + state}>
                {state === "yes" && <Icon name="check" size={12} color="white" />}
                {state === "no"  && <Icon name="x"     size={12} color="white" />}
              </div>
              <div style={{ flex: 1 }}>{r.label}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{v || "Pending"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.ScenarioSurvey = ScenarioSurvey;
