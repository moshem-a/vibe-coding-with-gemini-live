// scenario-interview.jsx — Online interview practice with a Gemini-powered interviewer.
// User picks a role (+ optional level & style); Gemini Live runs a realistic
// voice interview (welcome → 4-6 role-specific questions with follow-ups →
// reverse Q&A → structured feedback via tool call → wrap-up).

const INTERVIEW_ROLES = [
  { id: "swe-backend",  name: "Software Engineer — Backend",   icon: "code",     category: "Engineering" },
  { id: "swe-frontend", name: "Software Engineer — Frontend",  icon: "code",     category: "Engineering" },
  { id: "devops",       name: "DevOps / SRE",                  icon: "settings", category: "Engineering" },
  { id: "cloud-arch",   name: "Google Cloud Architect",        icon: "diagram",  category: "Engineering" },
  { id: "data-sci",     name: "Data Scientist",                icon: "sparkle",  category: "Data" },
  { id: "ml-eng",       name: "Machine Learning Engineer",     icon: "bolt",     category: "Data" },
  { id: "pm",           name: "Product Manager",               icon: "chat",     category: "Product" },
  { id: "ux",           name: "UX / UI Designer",              icon: "diagram",  category: "Product" },
  { id: "sales",        name: "Sales Manager",                 icon: "speaker",  category: "Go-to-market" },
  { id: "marketing",    name: "Marketing Manager",             icon: "globe",    category: "Go-to-market" },
];

const INTERVIEW_LEVELS = [
  { id: "junior", name: "Junior",            desc: "0–2 years" },
  { id: "mid",    name: "Mid-level",         desc: "2–5 years" },
  { id: "senior", name: "Senior",            desc: "5–10 years" },
  { id: "staff",  name: "Staff / Principal", desc: "10+ years" },
];

const INTERVIEW_STYLES = [
  { id: "behavioral", name: "Behavioral", desc: "STAR stories, past experiences" },
  { id: "technical",  name: "Technical",  desc: "Skills, system design, problem solving" },
  { id: "mixed",      name: "Mixed",      desc: "Most realistic — both" },
];

function interviewPrompt(roleName, levelId, styleId) {
  const levelGuidance = {
    junior: "junior candidate (0-2 years) — assume limited industry experience; keep questions grounded and offer occasional gentle scaffolding when they get stuck",
    mid:    "mid-level candidate (2-5 years) — expect ownership of features and moderate technical depth",
    senior: "senior candidate (5-10 years) — expect strong technical judgment, leadership stories, and trade-off thinking",
    staff:  "staff/principal candidate (10+ years) — expect deep architectural reasoning, org-level influence stories, and strategic thinking"
  };
  const styleGuidance = {
    behavioral: "Focus on behavioral questions in STAR format (Situation / Task / Action / Result). Probe for specifics. Ask 1-2 follow-ups per story. Look for ownership, learning, and impact.",
    technical:  "Focus on technical depth — core skills, problem solving, and one system-design question appropriate to the role and level. Push for trade-offs and alternatives.",
    mixed:      "Mix behavioral and technical roughly 50/50. Always start with one behavioral warm-up before any technical question."
  };
  const level = levelGuidance[levelId] || levelGuidance.mid;
  const style = styleGuidance[styleId] || styleGuidance.mixed;

  return `You are a seasoned, professional interviewer conducting a real job interview for a ${roleName} role.

CANDIDATE PROFILE: ${level}.

INTERVIEW STYLE: ${style}

VIDEO: The candidate's webcam is on and you receive their video frames. Use this sparingly and only when it adds real signal: if they look confused or stuck for several seconds, you may gently check in ("would you like a moment?"). Do NOT comment on appearance, clothing, lighting, or background. Do NOT narrate what you see ("I can see you smiling"). If their video is dark, frozen, or absent for >15s, calmly ask them to check the camera once and otherwise continue.

LANGUAGE: Detect the candidate's spoken language from their first reply and conduct the ENTIRE interview in that language. Default to English if their first reply is ambiguous. Once the language is set, do not switch unless the candidate switches first.

STRUCTURE — follow this order:
1. Warm welcome (~10 seconds): greet the candidate, state the role you'll be interviewing for, and briefly outline what the next 15-20 minutes will look like. End with: "Tell me a bit about yourself and what drew you to this role."
2. MAIN QUESTIONS (4-6 total) — tailored to the role and level. ONE question at a time. Wait for the answer. Ask 1-2 natural follow-ups when the answer is interesting or vague. Move on when you have enough signal.
3. REVERSE Q&A: ask "What questions do you have for me about the role or the team?" Answer briefly and realistically, the way a hiring manager would.
4. WRAP-UP: thank the candidate, mention next steps ("you'll hear back within a week"), and END with a warm closing sentence. BEFORE the closing sentence, call the provide_feedback tool exactly once with structured, honest feedback.

HARD RULES:
- ONE question per turn. Never stack two questions in one response.
- Keep replies concise — 1-3 sentences for questions, 2-4 sentences for follow-ups.
- Be warm but professional. No filler ("um", "you know"). No flattery ("great answer!"). React naturally to substance.
- For behavioral answers, listen for STAR. Push gently if they jump straight to the result without setup.
- For technical answers, probe trade-offs ("what would change at 10x scale?", "what are you giving up?").
- If the candidate is silent for 5-6+ seconds, ask "would you like a moment to think, or should I rephrase?"
- Do NOT give your evaluation DURING the interview. Stay neutral. The evaluation happens in provide_feedback at the end.
- Do NOT mention that this is an AI, Gemini, or a simulation. You are the interviewer.

QUESTION BANK GUIDANCE (pick a tailored mix based on role/level/style):
- Behavioral: "Tell me about a time you disagreed with a teammate and how you resolved it." / "Walk me through your most impactful project — your specific role and the outcome." / "Describe a time you missed a deadline. What did you learn?" / "Tell me about feedback that changed how you work."
- Technical (role-dependent): system design at level-appropriate scope, debugging-under-pressure, choosing between approaches, what they'd build if starting fresh.
- Senior+: include one org/leadership question (mentoring, influencing without authority, strategy).

When the candidate signals they have no more questions (or after their reverse Q&A), call provide_feedback with the structured result, then say a warm closing sentence and stop.

Begin now with the warm welcome.`;
}

const INTERVIEW_TOOLS = [{
  functionDeclarations: [{
    name: "provide_feedback",
    description: "Call EXACTLY ONCE at the end of the interview, immediately before your closing sentence. Provides structured feedback shown to the candidate after the call. Be honest, specific, and constructive — like a real hiring-manager debrief.",
    parameters: {
      type: "object",
      properties: {
        overall_recommendation: { type: "string", description: "One of: strong_hire, hire, lean_hire, lean_no_hire, no_hire. Be honest." },
        summary:                { type: "string", description: "2-3 sentence overall summary of the interview." },
        strengths:              { type: "array", items: { type: "string" }, description: "3-5 specific strengths observed, each one sentence." },
        areas_to_improve:       { type: "array", items: { type: "string" }, description: "2-4 specific gaps or growth areas, each one constructive sentence." },
        signal_questions:       { type: "array", items: { type: "string" }, description: "Notes on which questions revealed the most signal (one line each)." }
      },
      required: ["overall_recommendation", "summary", "strengths", "areas_to_improve"]
    }
  }]
}];

function ScenarioInterview({ apiKey, onExit }) {
  const [stage, setStage] = useState("setup"); // setup | live | done
  const [role, setRole] = useState(INTERVIEW_ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [level, setLevel] = useState(INTERVIEW_LEVELS[1]); // mid
  const [style, setStyle] = useState(INTERVIEW_STYLES[2]); // mixed
  const [turns, setTurns] = useState([]);
  const [muted, setMuted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [camError, setCamError] = useState(null);
  const [, force] = useState(0);

  const micRef = useRef(null);
  const playerRef = useRef(null);
  const userBufRef = useRef("");
  const aiBufRef = useRef("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const effectiveRoleName = (customRole.trim() || role.name);

  const live = useLiveSession({
    apiKey,
    model: "models/gemini-3.1-flash-live-preview",
    systemInstruction: interviewPrompt(effectiveRoleName, level.id, style.id),
    voice: "Charon",
    tools: INTERVIEW_TOOLS,
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
        if (fc.name === "provide_feedback") {
          setFeedback(fc.args || {});
          responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
        } else {
          responses.push({ id: fc.id, name: fc.name, response: { ok: false, error: "unknown tool" } });
        }
      }
      if (responses.length) live.session.current?.sendToolResponse(responses);
    }
  });

  const startInterview = () => {
    setStage("live");
    setTurns([]);
    setFeedback(null);
    setSessionKey((k) => k + 1);
  };

  // Connect when stage becomes "live"; tear down on exit
  useEffect(() => {
    if (stage !== "live") return;
    let mounted = true;
    let frameInterval;
    (async () => {
      // Open the candidate's front camera before connecting so we have video frames ready.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setCamError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.error("camera", e);
        setCamError(e?.message || "Camera unavailable");
      }

      playerRef.current = new window.GLAudio.AudioPlayer();
      const session = await live.connect();
      if (!mounted || !session) return;

      const mic = new window.GLAudio.MicCapture();
      micRef.current = mic;
      mic.addEventListener("chunk", (e) => session.sendAudio(e.detail.b64));
      try { await mic.start(); } catch (e) { console.error(e); }

      // Stream candidate-facing video frames at ~1 fps so the interviewer can pick up nonverbal cues.
      frameInterval = setInterval(() => {
        const v = videoRef.current, c = canvasRef.current;
        if (!v || !c || v.videoWidth === 0) return;
        const max = 640;
        const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
        c.width  = Math.round(v.videoWidth  * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        const b64 = c.toDataURL("image/jpeg", 0.6).split(",")[1];
        try { session.sendImage(b64, "image/jpeg"); } catch (_) {}
      }, 1000);

      session.sendText(
        `Begin the interview for the ${effectiveRoleName} role (${level.name} level, ${style.name} style). The candidate's webcam is on — you receive their video. Start now with your warm welcome.`,
        true
      );
    })();
    return () => {
      mounted = false;
      clearInterval(frameInterval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
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

  const toggleMute = () => { const m = !muted; setMuted(m); micRef.current?.mute(m); };

  const endInterview = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micRef.current?.stop();
    playerRef.current?.stop();
    live.disconnect();
    setStage("done");
  };

  const restart = () => {
    setStage("setup");
    setTurns([]);
    setFeedback(null);
    setShowTranscript(false);
    userBufRef.current = "";
    aiBufRef.current = "";
  };

  // ── Setup screen ──────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div>
        <AppBar crumb="Online Interview" onHome={onExit} />
        <div className="interview-setup">
          <h1>Practice an online interview</h1>
          <p className="sub">
            Pick a role and level. Gemini Live plays a seasoned interviewer —
            warm welcome, role-specific questions, natural follow-ups, candidate Q&A,
            and structured feedback at the end.
          </p>

          <section className="iv-section">
            <h3>Role</h3>
            <div className="iv-grid">
              {INTERVIEW_ROLES.map((r) => (
                <button
                  key={r.id}
                  className={"iv-card" + (role.id === r.id && !customRole.trim() ? " selected" : "")}
                  onClick={() => { setRole(r); setCustomRole(""); }}
                >
                  <div className="iv-card-icon"><Icon name={r.icon} size={22} /></div>
                  <div className="iv-card-name">{r.name}</div>
                  <div className="iv-card-cat">{r.category}</div>
                </button>
              ))}
            </div>
            <label className="iv-custom">
              <span>Or type a custom role</span>
              <input
                type="text"
                placeholder="e.g. Solutions Engineer, Game Designer, Embedded Firmware Engineer"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
            </label>
          </section>

          <section className="iv-section">
            <h3>Seniority</h3>
            <div className="iv-row">
              {INTERVIEW_LEVELS.map((l) => (
                <button
                  key={l.id}
                  className={"iv-pill" + (level.id === l.id ? " selected" : "")}
                  onClick={() => setLevel(l)}
                >
                  <div className="iv-pill-name">{l.name}</div>
                  <div className="iv-pill-desc">{l.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="iv-section">
            <h3>Interview style</h3>
            <div className="iv-row">
              {INTERVIEW_STYLES.map((s) => (
                <button
                  key={s.id}
                  className={"iv-pill" + (style.id === s.id ? " selected" : "")}
                  onClick={() => setStyle(s)}
                >
                  <div className="iv-pill-name">{s.name}</div>
                  <div className="iv-pill-desc">{s.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <div className="iv-actions">
            <div className="iv-summary">
              Interviewing for <strong>{effectiveRoleName}</strong> ·
              <strong> {level.name}</strong> ·
              <strong> {style.name}</strong> style
            </div>
            <button className="btn btn-gradient" onClick={startInterview}>
              Start interview <Icon name="arrow" size={16} color="white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Feedback / done screen ────────────────────────────────────────
  if (stage === "done") {
    return (
      <div>
        <AppBar crumb="Interview · Feedback" onHome={onExit} />
        <div className="interview-feedback">
          <h1>Interview wrapped</h1>
          <p className="sub">
            {feedback
              ? "Here's the structured feedback the interviewer recorded after your session."
              : "The session ended before the interviewer recorded structured feedback. Try again to complete a full evaluation."}
          </p>

          <div className="iv-feedback-card">
            <div className="iv-feedback-head">
              <div>
                <div className="iv-feedback-label">Role</div>
                <div className="iv-feedback-value">{effectiveRoleName}</div>
              </div>
              <div>
                <div className="iv-feedback-label">Level</div>
                <div className="iv-feedback-value">{level.name}</div>
              </div>
              <div>
                <div className="iv-feedback-label">Style</div>
                <div className="iv-feedback-value">{style.name}</div>
              </div>
              {feedback && feedback.overall_recommendation && (
                <div>
                  <div className="iv-feedback-label">Recommendation</div>
                  <div className={"iv-rec rec-" + feedback.overall_recommendation}>
                    {recLabel(feedback.overall_recommendation)}
                  </div>
                </div>
              )}
            </div>

            {feedback && feedback.summary && (
              <div className="iv-feedback-block">
                <h4>Summary</h4>
                <p>{feedback.summary}</p>
              </div>
            )}

            {feedback && feedback.strengths && feedback.strengths.length > 0 && (
              <div className="iv-feedback-block">
                <h4>Strengths</h4>
                <ul>{feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {feedback && feedback.areas_to_improve && feedback.areas_to_improve.length > 0 && (
              <div className="iv-feedback-block">
                <h4>Areas to improve</h4>
                <ul>{feedback.areas_to_improve.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}

            {feedback && feedback.signal_questions && feedback.signal_questions.length > 0 && (
              <div className="iv-feedback-block">
                <h4>Notable moments</h4>
                <ul>{feedback.signal_questions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="iv-actions">
            <button className="btn btn-secondary" onClick={restart}>New interview</button>
            <button className="btn btn-ghost" onClick={onExit}>Back to home</button>
          </div>

          {turns.length > 0 && (
            <details className="iv-transcript-details">
              <summary>Full transcript ({turns.length} turns)</summary>
              <div className="iv-transcript">
                {turns.map((t, i) => (
                  <div key={i} className={"iv-bubble " + t.role}>
                    <div className="who">{t.role === "user" ? "You" : "Interviewer"}</div>
                    <div>{t.text}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  // ── Live interview screen ─────────────────────────────────────────
  const aiLevel   = playerRef.current?.getLevel?.() ?? 0;
  const userLevel = micRef.current?.level ?? 0;
  const aiTalking   = aiLevel   > 0.02;
  // Mic also hears the interviewer through the speakers — gate user-talking on AI being silent
  // so echo from Gemini's voice doesn't trigger the camera halo.
  const userTalking = !muted && !aiTalking && userLevel > 0.06;
  const cameraTalker = userTalking ? "user" : "idle";
  const cameraIntensity = userTalking ? Math.min(1, userLevel * 1.6) : 0;

  return (
    <div>
      <AppBar
        crumb={`Interviewing · ${effectiveRoleName}`}
        onHome={onExit}
        right={<ConnChip state={live.state} />}
      />
      <div className="interview-live">
        <header className="iv-live-head">
          <div>
            <div className="iv-live-role">{effectiveRoleName}</div>
            <div className="iv-live-meta">{level.name} · {style.name} style</div>
          </div>
          <button className="btn btn-secondary" onClick={endInterview}>End interview</button>
        </header>

        <div className="iv-stage">
          <div
            className="iv-camera-wrap"
            data-talking={cameraTalker}
            style={{ "--iv-intensity": cameraIntensity.toFixed(3) }}
          >
            <div className="iv-camera-frame">
              <video ref={videoRef} className="iv-camera" playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {camError && (
                <div className="iv-camera-error">
                  <Icon name="camera" size={28} color="var(--text-tertiary)" />
                  <div>Camera unavailable</div>
                  <div className="iv-camera-error-sub">Allow camera access and reload.</div>
                </div>
              )}
              <div className="iv-camera-label">You</div>
            </div>
          </div>

          <div className={"iv-interviewer-orb " + (aiTalking ? "talking" : "")}>
            <div className="orb-core" />
            <div className="orb-ring r1" />
            <div className="orb-ring r2" />
            <div className="orb-ring r3" />
            <div className="orb-label">Interviewer</div>
          </div>
        </div>

        <footer className="iv-live-footer">
          <button className={"mic-btn " + (muted ? "muted" : "")} onClick={toggleMute} style={{ width: 64, height: 64 }}>
            {!muted && live.state === "live" && <span className="halo" />}
            <Icon name={muted ? "micOff" : "mic"} size={24} color={muted ? "var(--text-secondary)" : "white"} />
          </button>

          <div className="iv-live-status">
            <div className="iv-live-status-line">
              {live.state === "live"     ? (muted ? "Mic muted — unmute to speak"
                                                  : (aiTalking ? "Interviewer is speaking…"
                                                              : (userTalking ? "You're speaking…"
                                                                            : "Listening — answer naturally"))) :
               live.state === "connecting" ? "Connecting interviewer…" :
               live.state === "error"    ? "Connection error" :
                                            "Disconnected"}
            </div>
            <div className="iv-live-status-hint">
              Powered by Gemini 3.1 Flash Live · <span className="kbd">Esc</span> to exit
            </div>
          </div>

          <button
            className={"btn btn-ghost iv-toggle-transcript" + (showTranscript ? " on" : "")}
            onClick={() => setShowTranscript((s) => !s)}
            title={showTranscript ? "Hide conversation" : "Show conversation"}
          >
            <Icon name="chat" size={16} /> {showTranscript ? "Hide conversation" : "Show conversation"}
          </button>
        </footer>

        {showTranscript && (
          <aside className="iv-transcript-drawer">
            <div className="iv-transcript-drawer-head">
              <div>Conversation</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowTranscript(false)} title="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="iv-transcript-drawer-body">
              {turns.length === 0
                ? <div className="iv-transcript-empty">The conversation will appear here.</div>
                : turns.map((t, i) => (
                    <div key={i} className={"iv-bubble " + t.role}>
                      <div className="who">{t.role === "user" ? "You" : "Interviewer"}</div>
                      <div>{t.text}</div>
                    </div>
                  ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function recLabel(rec) {
  return ({
    strong_hire:  "Strong hire",
    hire:         "Hire",
    lean_hire:    "Lean hire",
    lean_no_hire: "Lean no-hire",
    no_hire:      "No hire"
  })[rec] || rec;
}

window.ScenarioInterview = ScenarioInterview;
