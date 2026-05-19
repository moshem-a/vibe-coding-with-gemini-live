// hub.jsx — landing dashboard with 4 scenario cards
const SCENARIOS = [
  {
    id: "architect",
    name: "Solutions Architect",
    accent: "#4285F4",
    tags: ["voice", "diagrams", "GCP"],
    desc: "Have a real-time voice conversation with a Gemini-powered Google Cloud architect. It runs discovery, suggests an architecture, and renders diagrams as you talk.",
    icon: "sparkle",
    glyphBg: "linear-gradient(135deg, #4285F4, #9B72CB)"
  },
  {
    id: "survey",
    name: "Visual Product Survey",
    accent: "#EA4335",
    tags: ["camera", "vision", "report"],
    desc: "Share your camera. Gemini guides you through a checklist on a real product — a soda bottle, a SKU, a returned item — captures photos at the right moments, and fills in a structured report.",
    icon: "cam",
    glyphBg: "linear-gradient(135deg, #EA4335, #F9AB00)"
  },
  {
    id: "code",
    name: "Live Code & Architecture",
    accent: "#34A853",
    tags: ["code", "diagrams", "stream"],
    desc: "Describe a service out loud. Gemini drafts the architecture and writes the boilerplate — Cloud Run, Pub/Sub, BigQuery — in real time, with the diagram updating as it talks.",
    icon: "code",
    glyphBg: "linear-gradient(135deg, #34A853, #1A73E8)"
  },
  {
    id: "translate",
    name: "Live Translation",
    accent: "#FBBC04",
    tags: ["voice", "multilingual", "stream"],
    desc: "Speak in any language. Gemini transcribes in real time and streams the translation into the language of your choice — a useful party trick for an international audience.",
    icon: "globe",
    glyphBg: "linear-gradient(135deg, #FBBC04, #EA4335)"
  }
];

function Hub({ onPick, onSettings }) {
  return (
    <div>
      <AppBar
        right={
          <button className="btn btn-ghost" onClick={onSettings} title="Settings">
            <Icon name="settings" size={18} /> Settings
          </button>
        }
      />
      <div className="hub">
        <h1>
          Demo suite for{" "}
          <span style={{ background: "var(--gemini-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Gemini Live
          </span>
        </h1>
        <p className="sub">
          Four live scenarios powered by Gemini 3.1 Flash. Voice in, voice out, vision and tool-calling — all streaming. Pick a scenario and run the demo end-to-end.
        </p>
        <div className="hub-grid">
          {SCENARIOS.map((s) => (
            <div key={s.id} className="scenario-card" onClick={() => onPick(s.id)}>
              <div className="glyph" style={{ background: s.glyphBg }}>
                <Icon name={s.icon} size={28} color="white" />
              </div>
              <div className="badge">
                <span className="swatch" style={{ background: s.accent }} />
                Scenario · {s.id}
              </div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div className="footer">
                <div className="tags">
                  {s.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
                <div className="start">
                  Start <Icon name="arrow" size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>
            <Icon name="bolt" size={16} color="#F9AB00" />
            Press <span className="kbd">Esc</span> in any scenario to return here.
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
            Built for Google Summit · Live demo
          </div>
        </div>
      </div>
    </div>
  );
}

window.Hub = Hub;
window.SCENARIOS = SCENARIOS;
