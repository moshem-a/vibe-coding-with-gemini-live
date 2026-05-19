// app.jsx — root component & router
const LS_KEY = "geminilive_api_key";
const INJECTED_KEY = (typeof window !== "undefined" && window.__GEMINI_API_KEY) || "";

function App() {
  const [apiKey, setApiKey] = useState(() => INJECTED_KEY || localStorage.getItem(LS_KEY) || localStorage.getItem("googlelive_api_key") || "");
  const [route, setRoute] = useState("hub"); // hub | architect | survey | code | translate | settings
  const [showSettings, setShowSettings] = useState(false);

  const saveKey = (k) => {
    setApiKey(k);
    if (k && k !== "DEMO") localStorage.setItem(LS_KEY, k);
    else localStorage.removeItem(LS_KEY);
  };

  if (!apiKey) {
    return (
      <>
        <AppBar />
        <SetupCard onSave={saveKey} />
      </>
    );
  }

  if (showSettings) {
    return (
      <>
        <AppBar onHome={() => setShowSettings(false)} />
        <div className="setup">
          <h2>Settings</h2>
          <p>Your Gemini API key is stored locally in this browser only.</p>
          <label>API key</label>
          <input
            type="password"
            value={apiKey === "DEMO" ? "" : apiKey}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="AIza…"
          />
          <p className="hint">
            Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com</a>
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => setShowSettings(false)}>Done</button>
            <button className="btn btn-ghost" onClick={() => { saveKey(""); setShowSettings(false); }}>
              Clear key
            </button>
          </div>
        </div>
      </>
    );
  }

  const exit = () => setRoute("hub");

  if (route === "architect") return <ScenarioArchitect apiKey={apiKey} onExit={exit} />;
  if (route === "survey")    return <ScenarioSurvey    apiKey={apiKey} onExit={exit} />;
  if (route === "code")      return <ScenarioCode      apiKey={apiKey} onExit={exit} />;
  if (route === "translate") return <ScenarioTranslate apiKey={apiKey} onExit={exit} />;

  return <Hub onPick={setRoute} onSettings={() => setShowSettings(true)} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
