// diagram.jsx — Mermaid renderer themed for Google Cloud
// (file is still called gcp-icons.jsx for backward-compat with index.html)

// GCP-themed Mermaid template snippet that the model is told to include in every diagram
const GCP_MERMAID_THEME = `
classDef compute fill:#E8F0FE,stroke:#1A73E8,color:#174EA6,stroke-width:1.5px;
classDef data fill:#FEF7E0,stroke:#F9AB00,color:#A66400,stroke-width:1.5px;
classDef messaging fill:#E6F4EA,stroke:#34A853,color:#0D652D,stroke-width:1.5px;
classDef ai fill:#F3E8FD,stroke:#9B72CB,color:#4F3676,stroke-width:1.5px;
classDef networking fill:#FCE8E6,stroke:#EA4335,color:#A50E0E,stroke-width:1.5px;
classDef user fill:#F1F3F4,stroke:#5F6368,color:#202124,stroke-width:1.5px;
classDef external fill:#FFFFFF,stroke:#80868B,color:#5F6368,stroke-width:1.5px,stroke-dasharray:4 3;
`.trim();

// Render a Mermaid string into an SVG
let __mmdId = 0;
function MermaidDiagram({ code }) {
  const ref = React.useRef(null);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    if (!ref.current || !window.mermaid || !code) return;
    let cancelled = false;
    const id = "mmd-" + (++__mmdId);
    // ensure theme classes are present so models don't have to repeat them
    let src = code.trim();
    if (!/classDef\s+compute/i.test(src)) src += "\n" + GCP_MERMAID_THEME;

    window.mermaid.render(id, src).then(({ svg, bindFunctions }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = svg;
      bindFunctions?.(ref.current);
      setErr(null);
    }).catch((e) => {
      if (!cancelled) setErr(e?.message || String(e));
    });
    return () => { cancelled = true; };
  }, [code]);

  if (err) {
    return (
      <div style={{ padding: 16, background: "var(--surface-2)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>Diagram syntax error — showing source:</div>
        <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap" }}>{code}</pre>
      </div>
    );
  }
  return <div ref={ref} className="mermaid-host" style={{ width: "100%", overflow: "auto", textAlign: "center" }} />;
}

// Compatibility shim — old code referenced <ArchDiagram diagram={...}>.
// New diagrams use { mermaid }. Old structured ones fall back to a stringified placeholder.
function ArchDiagram({ diagram }) {
  if (!diagram) return null;
  if (diagram.mermaid) return <MermaidDiagram code={diagram.mermaid} />;
  // Legacy fallback — generate Mermaid from services/connections if present
  if (diagram.services) {
    let m = "flowchart TD\n";
    diagram.services.forEach((s) => {
      m += `  ${s.id}["${s.name}"]\n`;
    });
    (diagram.connections || []).forEach((c) => {
      m += `  ${c.from} -->${c.label ? `|${c.label}|` : ""} ${c.to}\n`;
    });
    return <MermaidDiagram code={m} />;
  }
  return null;
}

Object.assign(window, { MermaidDiagram, ArchDiagram, GCP_MERMAID_THEME });
